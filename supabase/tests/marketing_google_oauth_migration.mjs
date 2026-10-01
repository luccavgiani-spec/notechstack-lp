// Postgres WASM isolado. Vault é stub de contrato, não prova de criptografia real.
// node supabase/tests/marketing_google_oauth_migration.mjs <pglite/dist/index.js>
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const db = new PGlite()
const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema vault;
    create table auth.users(id uuid primary key, raw_app_meta_data jsonb, banned_until timestamptz);
    insert into auth.users values ('${admin}', '{"role":"NO_ADMIN"}', null);
    create table public.marketing_cache(key text primary key, payload jsonb, expires_at timestamptz);
    alter table public.marketing_cache enable row level security;
    grant all on public.marketing_cache to service_role;
    create table public.marketing_actions(request_id text unique, actor_user_id uuid, actor_role text, kind text,
      payload jsonb, status text, result jsonb, finished_at timestamptz);
    create table vault.secrets(id uuid primary key default gen_random_uuid(), name text unique, secret text);
    create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(s text, n text) returns uuid language sql as
      'insert into vault.secrets(secret,name) values(s,n) returning id';
    create function vault.update_secret(i uuid, s text) returns void language sql as
      'update vault.secrets set secret=s where id=i';
  `)
  await db.exec(await readFile(new URL('../migrations/20261001214802_marketing_google_oauth.sql', import.meta.url), 'utf8'))
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`)
    for (const sql of ["select public.marketing_google_state_consume(repeat('a',64))",
      'select public.marketing_google_refresh_read()',
      `select public.marketing_google_connection_save('${admin}','fixture','request-test')`]) {
      await assert.rejects(db.exec(sql), /permission denied/)
    }
    await db.exec('reset role')
  }
  console.log('PASS T1-21: anon/authenticated não executam nenhuma RPC OAuth')
  await db.exec('set role service_role')
  const scalar = async sql => (await db.query(sql)).rows[0].value
  assert.equal(await scalar('select public.marketing_google_refresh_read() value'), null)
  for (const seconds of [-1, 0, 600]) {
    await db.exec(`insert into public.marketing_cache values(repeat('google_oauth_state:',1)||repeat('a',64), '{"user_id":"${admin}"}', now()+interval '${seconds} seconds')`)
    const value = await scalar("select public.marketing_google_state_consume(repeat('a',64)) value")
    assert.equal(value, seconds > 0 ? admin : null)
    assert.equal(await scalar("select public.marketing_google_state_consume(repeat('a',64)) value"), null)
    assert.equal(await scalar('select count(*)::int value from public.marketing_cache'), 0)
  }
  console.log('PASS T1-18: SQL consome state válido uma vez, rejeita expirado/limite e elimina usado')
  await db.exec(`select public.marketing_google_connection_save('${admin}','first-fixture','request-test')`)
  assert.equal(await scalar('select public.marketing_google_refresh_read() value'), 'first-fixture')
  await assert.rejects(db.exec(`select public.marketing_google_connection_save('${admin}','rolled-back-fixture','request-test')`), /unique constraint/)
  assert.equal(await scalar('select public.marketing_google_refresh_read() value'), 'first-fixture')
  await db.exec(`select public.marketing_google_connection_save('${admin}','second-fixture','request-next')`)
  assert.equal(await scalar('select public.marketing_google_refresh_read() value'), 'second-fixture')
  await db.exec('reset role')
  const rows = (await db.query('select * from public.marketing_actions')).rows
  assert.equal(rows.length, 2)
  for (const row of rows) {
    assert.equal(row.kind, 'google.conectar'); assert.equal(row.actor_role, 'NO_ADMIN'); assert.equal(row.status, 'ok')
    assert.deepEqual(row.payload, {}); assert.deepEqual(row.result, { conectado: true })
  }
  assert.equal(await scalar('select count(*)::int value from vault.secrets'), 1)
  console.log('PASS T1-21/22: criação/atualização Vault + auditoria atômicos; falha da auditoria reverte token; sem token em payload/result')
  await db.exec(`update auth.users set banned_until=now()+interval '1 day'`)
  await db.exec('set role service_role')
  await assert.rejects(db.exec(`select public.marketing_google_connection_save('${admin}','blocked-fixture','request-ban')`), /não autorizado/)
  assert.equal(await scalar('select public.marketing_google_refresh_read() value'), 'second-fixture')
  console.log('PASS T1-20: admin desligado durante consentimento não substitui token')
} finally { await db.close() }

// Prova isolada em Postgres WASM; sem rede, credenciais ou banco do projeto.
// node supabase/tests/lead_classificacao_migration.mjs <caminho absoluto do módulo @electric-sql/pglite/dist/index.js>
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const { PGlite } = await import(pathToFileURL(process.argv[2]).href)
const migration = await readFile(new URL('../migrations/20261001214638_marketing_lead_classificacao.sql', import.meta.url), 'utf8')

for (const quantidade of [9, 10, 11]) {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create table public.leads(id uuid primary key, created_at timestamptz not null);
      insert into public.leads select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
        '2026-09-15T12:00:00Z'::timestamptz from generate_series(1,${quantidade}) i;
      insert into public.leads values ('00000000-0000-4000-8000-000000000100','2026-08-31T02:59:59Z'),
        ('00000000-0000-4000-8000-000000000101','2026-09-30T03:00:00Z');
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    `)
    if (quantidade !== 10) {
      await assert.rejects(db.exec(migration), /exatamente 10/)
      await db.exec('rollback')
      assert.equal((await db.query("select to_regclass('public.lead_classificacao') as tabela")).rows[0].tabela, null)
      console.log(`PASS T2-22: ${quantidade} leads abortam sem tabela nem backfill`)
      continue
    }
    await db.exec(migration)
    const scalar = async sql => (await db.query(sql)).rows[0].n
    assert.equal(await scalar('select count(*)::int n from public.leads'), 12)
    assert.equal(await scalar("select count(*)::int n from public.lead_classificacao where classe='teste' and papel='NO_ADMIN' and motivo='confirmado pelo Lucca em 01/10/2026' and criado_em is not null"), 10)
    assert.equal(await scalar("select count(*)::int n from pg_policies where tablename='lead_classificacao'"), 0)
    assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.lead_classificacao'::regclass")).rows[0].relrowsecurity, true)
    assert.equal(await scalar("select count(*)::int n from information_schema.role_table_grants where table_name='lead_classificacao' and grantee in ('anon','authenticated','PUBLIC')"), 0)
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      for (const sql of ['select * from public.lead_classificacao', "insert into public.lead_classificacao(lead_id,classe,papel) values ('00000000-0000-4000-8000-000000000001','real','NO_ADMIN')", "update public.lead_classificacao set classe='real'", 'delete from public.lead_classificacao']) {
        await assert.rejects(db.exec(sql), /permission denied/)
      }
      await db.exec('reset role')
    }
    await db.exec('set role service_role')
    await db.exec("insert into public.lead_classificacao(lead_id,classe,papel,classificado_por) values ('00000000-0000-4000-8000-000000000001','real','NO_ADMIN','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1')")
    assert.equal(await scalar('select count(*)::int n from public.lead_classificacao'), 11)
    await assert.rejects(db.exec("update public.lead_classificacao set classe='real'"), /permission denied/)
    await assert.rejects(db.exec('delete from public.lead_classificacao'), /permission denied/)
    await assert.rejects(db.exec("insert into public.lead_classificacao(lead_id,classe,papel) values ('00000000-0000-4000-8000-000000000001','other','NO_ADMIN')"), /check constraint/)
    await assert.rejects(db.exec("insert into public.lead_classificacao(lead_id,classe,papel,motivo) values ('00000000-0000-4000-8000-000000000001','real','NO_ADMIN',repeat('x',501))"), /check constraint/)
    assert.equal((await db.query("select classe from public.lead_classificacao where lead_id='00000000-0000-4000-8000-000000000001' order by criado_em desc,id desc limit 1")).rows[0].classe, 'real')
    console.log('PASS T2-3,22,26,27: 10 testes, limites UTC, RLS, zero grants clientes, trilha aditiva, constraints e classe vigente')
  } finally { await db.close() }
}

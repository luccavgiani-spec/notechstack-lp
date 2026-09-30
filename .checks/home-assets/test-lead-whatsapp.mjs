// Node >= 22.13. Execute da raiz: node .checks/home-assets/test-lead-whatsapp.mjs
// Handler real, rede inteiramente simulada: não cria leads nem envia mensagens.
import { stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

const source = stripTypeScriptTypes(fs.readFileSync(
  process.env.LEAD_SOURCE || 'supabase/functions/send-lead-email/index.ts', 'utf8',
));

async function run(whatsapp, { emailFails = false, databaseFails = false } = {}) {
  let handler;
  const calls = [];
  const env = {
    SUPABASE_URL: 'https://database.test',
    SUPABASE_SERVICE_ROLE_KEY: 'fake-db-key',
    RESEND_API_KEY: 'fake-email-key',
    META_ACCESS_TOKEN: 'fake-meta-key',
  };
  vm.runInNewContext(source, {
    Deno: { serve: fn => { handler = fn; }, env: { get: key => env[key] } },
    console: { error() {} }, Response, Request, URL, atob, TextEncoder,
    crypto: globalThis.crypto,
    fetch: async (url, options) => {
      const body = options.body && JSON.parse(options.body);
      calls.push({ url, method: options.method, body });
      if (url === 'https://database.test/rest/v1/leads' && options.method === 'POST') {
        return Response.json(databaseFails ? { error: 'simulated failure' } : [{ id: 'test-lead' }],
          { status: databaseFails ? 500 : 201 });
      }
      if (url === 'https://database.test/rest/v1/rpc/marcar_lead' ||
          url === 'https://database.test/rest/v1/leads?id=eq.test-lead') {
        return new Response(null, { status: 204 });
      }
      if (url.startsWith('https://graph.facebook.com/v21.0/') && url.endsWith('/events?access_token=fake-meta-key')) {
        return Response.json({ events_received: 1 });
      }
      if (url === 'https://api.resend.com/emails') {
        return Response.json(emailFails ? { error: 'simulated failure' } : { id: 'test-email' },
          { status: emailFails ? 503 : 200 });
      }
      assert.fail(`Unexpected network destination: ${url}`);
    },
  });
  const response = await handler(new Request('https://function.test', {
    method: 'POST', body: JSON.stringify({
      nome: 'Teste', email: 'lead@example.invalid', whatsapp, sid: 'test-session',
    }),
  }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.saved, !databaseFails);
  assert.equal(result.emailSent, !emailFails);
  assert.equal(result.success, !databaseFails || !emailFails);
  assert.equal(result.capiStatus, 'ok_1');
  assert.equal(calls[0].url, 'https://database.test/rest/v1/leads');
  assert.equal(calls[0].body.whatsapp, typeof whatsapp === 'string' && whatsapp.trim() ? whatsapp.trim() : null);
  return {
    result,
    html: calls.find(c => c.url === 'https://api.resend.com/emails').body.html,
    meta: calls.find(c => c.url.startsWith('https://graph.facebook.com/')).body.data[0],
  };
}

const cases = [
  ['celular com máscara', '(11) 99999-9999', '5511999999999'],
  ['celular sem máscara', '11999999999', '5511999999999'],
  ['fixo com máscara', '(11) 3333-4444', '551133334444'],
  ['fixo sem máscara', '1133334444', '551133334444'],
  ['celular com +55', '+55 (11) 99999-9999', '5511999999999'],
  ['celular com 55', '5511999999999', '5511999999999'],
  ['fixo com +55', '+55 (11) 3333-4444', '551133334444'],
  ['fixo com 55', '551133334444', '551133334444'],
  ['espaços nas pontas', '  +55 (11) 99999-9999  ', '5511999999999'],
  ['DDD 55 celular', '(55) 99999-9999', '5555999999999'],
  ['DDD 55 fixo', '(55) 3333-4444', '555533334444'],
  ['DDD 55 já internacional', '+55 (55) 99999-9999', '5555999999999'],
  ['EUA explícito', '+1 (202) 555-0123', '12025550123'],
  ['Portugal explícito', '+351 912 345 678', '351912345678'],
  ['ausente', undefined, ''],
  ['null', null, ''],
  ['vazio', '', ''],
  ['somente espaços', '   ', ''],
  ['sem dígitos', 'não informado', ''],
];

for (const [name, input, expected] of cases) {
  test(name, async () => {
    const { html, meta } = await run(input);
    const links = [...html.matchAll(/href="https:\/\/wa\.me\/([^"]*)"/g)];
    if (expected) {
      assert.equal(links.length, 1);
      assert.equal(links[0][1], expected);
      assert.match(links[0][1], /^\d+$/);
      assert.equal(meta.user_data.ph[0], createHash('sha256').update(expected).digest('hex'));
    } else {
      assert.equal(links.length, 0);
      assert.equal(meta.user_data.ph, undefined);
    }
  });
}

test('falha de e-mail preserva lead e erro visível', async () => {
  const { result } = await run('+55 (11) 99999-9999', { emailFails: true });
  assert.match(result.emailError, /Resend 503/);
  assert.equal(result.leadId, 'test-lead');
});

test('falha no banco mantém notificação e erro visível', async () => {
  const { result, html } = await run('+55 (11) 99999-9999', { databaseFails: true });
  assert.match(result.saveError, /Postgrest 500/);
  assert.ok(html.includes('href="https://wa.me/5511999999999"'));
});

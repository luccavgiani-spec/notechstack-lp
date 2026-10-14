// Node >= 22.13. Execute da raiz: node .checks/seo/test-lead-test-list.mjs
// Handler real de send-lead-email com rede inteiramente simulada: não grava
// lead, não manda e-mail, não fala com o Meta. Sem dependências externas.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {stripTypeScriptTypes} from 'node:module';

const source = stripTypeScriptTypes(fs.readFileSync('supabase/functions/send-lead-email/index.ts','utf8'));
// Nenhum e-mail real: domínio .invalid reservado.
const LISTA = ' QA@Example.invalid , outro@example.invalid,';

async function run(email, extraEnv = {}) {
  let handler;
  const calls = [];
  const env = {
    SUPABASE_URL:'https://database.test', SUPABASE_SERVICE_ROLE_KEY:'fake-db-key',
    RESEND_API_KEY:'fake-email-key', META_ACCESS_TOKEN:'fake-meta-key',
    LEAD_TEST_EMAILS:LISTA, ...extraEnv,
  };
  vm.runInNewContext(source, {
    Deno:{serve:fn=>{handler=fn;},env:{get:key=>env[key]}},
    console:{error(){}}, Response, Request, URL, atob, TextEncoder, crypto:globalThis.crypto,
    fetch:async (url,options) => {
      calls.push({url,method:options.method,body:options.body&&JSON.parse(options.body)});
      if (url==='https://database.test/rest/v1/leads'&&options.method==='POST') return Response.json([{id:'lead-1'}],{status:201});
      if (url==='https://database.test/rest/v1/lead_classificacao') return new Response(null,{status:201});
      if (url==='https://database.test/rest/v1/rpc/marcar_lead'||url==='https://database.test/rest/v1/leads?id=eq.lead-1') return new Response(null,{status:204});
      if (url.startsWith('https://graph.facebook.com/v21.0/')) return Response.json({events_received:1});
      if (url==='https://api.resend.com/emails') return Response.json({id:'email-1'});
      assert.fail(`Destino de rede inesperado: ${url}`);
    },
  });
  const res = await handler(new Request('https://function.test',{method:'POST',
    body:JSON.stringify({nome:'Teste',email,whatsapp:'11999999999',sid:'test-session'})}));
  assert.equal(res.status,200);
  const result = await res.json();
  const meta = calls.find(c=>c.url.startsWith('https://graph.facebook.com/'));
  const classe = calls.filter(c=>c.url.endsWith('/rest/v1/lead_classificacao'));
  const patch = calls.find(c=>c.method==='PATCH');
  return {result,meta,classe,patch};
}

// (a) e-mail da lista, com código de teste → test_event_code na raiz + classe teste
{
  const {result,meta,classe,patch} = await run('  qa@EXAMPLE.invalid ',{META_TEST_EVENT_CODE:'TEST12345'});
  assert.ok(meta,'lead de teste com código vai ao CAPI');
  assert.equal(meta.body.test_event_code,'TEST12345');
  assert.ok(Array.isArray(meta.body.data)&&meta.body.data[0].event_name==='Lead');
  assert.equal(result.saved,true);
  assert.equal(classe.length,1);
  assert.deepEqual(classe[0].body,{lead_id:'lead-1',classe:'teste',motivo:'e-mail na LEAD_TEST_EMAILS',papel:'send-lead-email'});
  assert.equal(result.capiStatus,'teste_ok_1');
  assert.equal(patch.body.capi_status,'teste_ok_1');
  console.log('ok (a) lista + META_TEST_EVENT_CODE: test_event_code na raiz, classe teste gravada, capi_status teste_ok_1');
}

// (a2) e-mail da lista sem código → não manda ao CAPI, mas classifica
{
  const {result,meta,classe,patch} = await run('outro@example.invalid');
  assert.equal(meta,undefined,'sem código de teste o Lead não pode ir ao pixel');
  assert.equal(result.capiStatus,'teste_sem_codigo');
  assert.equal(patch.body.capi_status,'teste_sem_codigo');
  assert.equal(classe.length,1); assert.equal(classe[0].body.classe,'teste');
  console.log('ok (a2) lista sem META_TEST_EVENT_CODE: nada ao CAPI, capi_status teste_sem_codigo, classe teste gravada');
}

// (b) e-mail fora da lista → envio normal, sem test_event_code, sem classe
for (const [nome,env] of [['com código no ambiente',{META_TEST_EVENT_CODE:'TEST12345'}],['lista vazia',{LEAD_TEST_EMAILS:undefined}]]) {
  const {result,meta,classe} = await run('cliente@example.invalid',env);
  assert.ok(meta);
  assert.ok(!('test_event_code' in meta.body),'lead real não leva test_event_code');
  assert.equal(classe.length,0);
  assert.equal(result.capiStatus,'ok_1');
  console.log(`ok (b) fora da lista (${nome}): sem test_event_code, sem classe, capi_status ok_1`);
}

// (c) canalDoLead: leads.ts e normalize.ts carregados como módulos, só tipos removidos
const asUrl = src => `data:text/javascript,${encodeURIComponent(src)}`;
const normalize = asUrl(stripTypeScriptTypes(fs.readFileSync('supabase/functions/_shared/marketing/normalize.ts','utf8')));
const leadsSrc = stripTypeScriptTypes(fs.readFileSync('supabase/functions/_shared/marketing/leads.ts','utf8'))
  .replace('"./normalize.ts"',JSON.stringify(normalize));
const {canalDoLead} = await import(asUrl(leadsSrc));
const lead = utm_source => ({created_at:'2026-10-14T12:00:00Z',utm_source,utm_medium:null,gclid:null,fbclid:null});
for (const s of ['an','msg','AN',' msg ']) assert.equal(canalDoLead(lead(s)),'meta',s);
assert.equal(canalDoLead(lead('facebook')),'meta');
assert.equal(canalDoLead(lead('newsletter')),'outros');
console.log("ok (c) canalDoLead: 'an' e 'msg' -> meta (também com caixa/espaço); controles inalterados");

console.log('PASS: lista de teste via LEAD_TEST_EMAILS, test_event_code via META_TEST_EVENT_CODE, classe teste em lead_classificacao, an/msg -> meta. Nenhuma rede de produção.');

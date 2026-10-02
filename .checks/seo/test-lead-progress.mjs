// Isolated tests; no production network. Dependencies live outside the repository.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire, stripTypeScriptTypes} from 'node:module';
import path from 'node:path';
const require = createRequire(path.join(process.env.TEMP,'no-lead-progress-tests','runner.cjs'));
const {PGlite} = require('@electric-sql/pglite');
const {parseHTML} = require('linkedom');
const db = new PGlite();
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create table public.leads (sid text, modo text); grant select on public.leads to service_role;`);
await db.exec(fs.readFileSync('supabase/migrations/20260929173008_lead_rascunhos.sql','utf8'));
let handler, unavailable = false;
const backendCalls = [];
vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('supabase/functions/save-lead-progress/index.ts','utf8')), {
  Deno:{serve:fn=>handler=fn,env:{get:key=>key==='SUPABASE_URL'?'https://test.local':'test-service'}},
  Request,Response,TextEncoder,Date,
  fetch:async (url,options) => {
    backendCalls.push(url);
    if (unavailable) throw new Error('offline');
    assert.equal(url,'https://test.local/rest/v1/rpc/salvar_lead_rascunho');
    await db.exec('set role service_role');
    try { await db.query('select public.salvar_lead_rascunho($1::jsonb)',[JSON.parse(options.body).p]); }
    finally { await db.exec('reset role'); }
    return new Response('null');
  }
});
const request = body => handler(new Request('https://test.local',{method:'POST',body:JSON.stringify(body)}));
const base = {sid:'test-session-12345678',modo:'contato_home',etapa:1,versao:1,finalizado:false,respostas:{nome:'Ana'},origem:{utm_source:'google'}};
assert.equal((await request(base)).status,200);
await request({...base,etapa:2,versao:3,respostas:{nome:'Ana atualizada',whatsapp:'11999999999'}});
await request({...base,versao:2});
let row = (await db.query('select * from lead_rascunhos')).rows[0];
assert.equal(row.respostas.nome,'Ana atualizada'); assert.equal(row.etapa,2);
assert.equal((await db.query('select count(*)::int as n from leads_para_retomar')).rows[0].n,0);
await db.exec("update lead_rascunhos set atualizado_em=now()-interval '31 minutes'");
assert.equal((await db.query('select count(*)::int as n from leads_para_retomar')).rows[0].n,1);
await request({...base,versao:4,etapa:5,finalizado:true});
await request({...base,versao:5});
row = (await db.query('select * from lead_rascunhos')).rows[0];
assert.equal(row.finalizado,true); assert.equal(row.etapa,5);
assert.equal((await db.query('select count(*)::int as n from leads_para_retomar')).rows[0].n,0);
for (const role of ['anon','authenticated']) {
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query('select * from lead_rascunhos'),/permission denied/);
  await assert.rejects(db.query('select * from leads_para_retomar'),/permission denied/);
  await assert.rejects(db.query('select salvar_lead_rascunho($1::jsonb)',[base]),/permission denied/);
  await db.exec('reset role');
}
const before = backendCalls.length;
for (const invalid of [null,{...base,sid:'bad'},{...base,etapa:6},{...base,respostas:{nome:'x'.repeat(81)}},{...base,respostas:[]},{...base,finalizado:true},{...base,modo:'admin'}]) {
  assert.equal((await request(invalid)).status,400);
}
assert.equal(backendCalls.length,before);
unavailable=true; assert.equal((await request(base)).status,503); unavailable=false;
assert.equal((await handler(new Request('https://test.local'))).status,405);

// Exercise the real form script and draft client together with DOM events.
for (const filename of ['lp-narrador/cenas-lp/lp-v8.html','contato/index.html']) {
  const html=fs.readFileSync(filename,'utf8');
  assert.ok(html.indexOf('/shared/lead-progress.js') < html.indexOf('/lp-narrador/cenas-lp/historia/home-contato.js'));
  const {document,Event}=parseHTML(html);
  document.cookie='';
  const form=document.getElementById('homeLeadForm');
  const inputs=[...form.querySelectorAll('input,textarea,select')];
  form.action='https://test.local/functions/v1/send-lead-email';
  form.elements={namedItem:name=>inputs.find(input=>input.name===name)};
  for (const input of inputs) { input.setCustomValidity=()=>{}; input.checkValidity=()=>true; input.reportValidity=()=>{}; input.focus=()=>{}; if(input.tagName==='SELECT')Object.defineProperty(input,'value',{value:'Sistema sob medida',writable:true}); }
  form.dataset.mode=filename.startsWith('contato')?'contato':'contato_home';
  const timers=new Map(), listeners={}, calls=[], events=[]; let timerId=0;
  const seen=new Set();
  const window={leadSid:'browser-test-session-'+form.dataset.mode,leadOrig:{utm_source:'google'},track:(event,params,key)=>{if(key&&seen.has(event+key))return;if(key)seen.add(event+key);events.push({event,...params});}};
  const context={window,document,URL,Blob,TextEncoder,Date,console,AbortController,
    FormData:class {get(name){return form.elements.namedItem(name)?.value;}},
    setTimeout:(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;}, clearTimeout:id=>timers.delete(id),
    addEventListener:(name,fn)=>listeners[name]=fn,
    navigator:{sendBeacon:(url,body)=>{calls.push({url,beacon:body});return true;}},
    fetch:async(url,options)=>{calls.push({url,data:JSON.parse(options.body)});return new Response(JSON.stringify(url.endsWith('save-lead-progress')?{ok:true}:{success:true,saved:true}));},
    location:{href:'https://test.local/'},matchMedia:()=>({matches:true})};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('shared/lead-progress.js','utf8'),context);
  vm.runInContext(fs.readFileSync('lp-narrador/cenas-lp/historia/home-contato.js','utf8'),context);
  listeners.pagehide(); assert.equal(calls.length,0,'visiting without interaction must not create a draft');
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const set=(name,value)=>{form.elements.namedItem(name).value=value;};
  const submit=async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();};
  set('nome','Maria');
  form.elements.namedItem('nome').checkValidity=()=>false; await submit();
  assert.equal(events.filter(e=>e.event==='form_etapa').length,0,'invalid field must not advance');
  form.elements.namedItem('nome').checkValidity=()=>true; await submit();
  assert.equal(calls.at(-1).data.respostas.nome,'Maria'); assert.equal(calls.at(-1).data.etapa,1);
  assert.ok(events.some(e=>e.event==='form_etapa'&&e.passo===1));
  set('whatsapp','11987654321');
  form.elements.namedItem('whatsapp').dispatchEvent(new Event('input',{bubbles:true}));
  const autosave=[...timers.values()].find(t=>t.ms===1000); assert.ok(autosave); autosave.fn(); await settle();
  assert.equal(calls.at(-1).data.respostas.whatsapp,'11987654321');
  set('whatsapp','11987654322'); listeners.pagehide();
  assert.equal(JSON.parse(await calls.at(-1).beacon.text()).respostas.whatsapp,'11987654322');
  await submit(); set('negocio','Empresa'); await submit(); await submit(); set('descricao','Rotina e processos detalhados'); await submit();
  assert.equal(calls.filter(c=>c.url.endsWith('send-lead-email')).length,0,'unchecked consent must prevent final submission');
  assert.ok(document.getElementById('leadErro').textContent.includes('Marque'));
  assert.ok(!form.textContent.includes('Ao preencher, suas respostas são salvas'));
  const consent=document.getElementById('lead-consentimento');
  assert.ok(consent.hasAttribute('required')); assert.ok(!consent.hasAttribute('checked'));
  assert.equal(consent.closest('fieldset'),form.querySelectorAll('fieldset')[4]);
  assert.equal(form.querySelectorAll('.home-consent a').length,2);
  consent.checked=true; await submit();
  assert.ok(calls.some(c=>c.url.endsWith('save-lead-progress')&&c.data?.finalizado));
  assert.equal(events.filter(e=>e.event==='form_etapa').length,5);
  assert.ok(events.some(e=>e.event==='lead_submit'));
  const analytics=JSON.stringify(events);
  for(const value of ['Maria','119876543','Empresa','Rotina e processos']) assert.ok(!analytics.includes(value));
  // Execute the last private snapshot against the real SQL function via the handler.
  const last=calls.filter(c=>c.data&&c.url.endsWith('save-lead-progress')).at(-1).data;
  assert.equal((await request(last)).status,200);
}
await db.close();
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'));
for(const source of ['/lp-narrador/cenas-lp/lp-v7.html','/lp-narrador/cenas-lp/lp-v7.html/']) {
  assert.ok(config.redirects.some(rule=>rule.source===source&&rule.destination==='/'&&rule.permanent===true));
}
console.log('PASS: private partial saves, all 5 steps on Home/Contato, no answers in analytics, abandon beacon, completion, SQL ordering/idempotency, access denied for clients, invalid requests and backend failures. No production writes.');

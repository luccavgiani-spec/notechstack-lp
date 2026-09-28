import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const store=new Map();
function visit(path,referrer,search=''){
 const context={URL,URLSearchParams,crypto:globalThis.crypto,location:{pathname:path,hostname:'localhost',search},sessionStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{referrer,cookie:'',visibilityState:'visible'},addEventListener(){},setTimeout(){},clearTimeout(){},navigator:{},console};context.window=context;
 vm.runInNewContext(fs.readFileSync('shared/telemetria.js','utf8'),context);return context;
}
const landing=visit('/sistemas-sob-medida/','https://www.google.com/search?q=sistema');
assert.equal(landing.leadOrig.utm_medium,'organic');assert.equal(landing.leadOrig.utm_source,'google');assert.equal(landing.dataLayer[0].event,'site_visit');
const contact=visit('/contato/','https://www.notechstack.com.br/sistemas-sob-medida/');
assert.equal(contact.leadSid,landing.leadSid);assert.equal(contact.leadOrig.utm_source,'google');
store.clear();const paid=visit('/agencia/','https://www.google.com/','?utm_source=partner&utm_medium=referral');assert.equal(paid.leadOrig.utm_source,'partner');
console.log('PASS: organic attribution, session continuity to contact, explicit UTM preservation and visit event. No network.');

// Public write-only endpoint. Personal answers never enter analytics or email/CAPI.
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Content-Type':'application/json'};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {status, headers});
const limits: Record<string, number> = {nome:80,whatsapp:20,negocio:160,objetivo:160,descricao:20000,links:4000};
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return json({ok:true});
  if (req.method !== 'POST') return json({ok:false},405);
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > 128000) return json({ok:false},413);
  let p;
  try { p = JSON.parse(raw); } catch { return json({ok:false},400); }
  if (!p || typeof p.sid !== 'string' || !/^[A-Za-z0-9._-]{16,64}$/.test(p.sid)
    || !['contato','contato_home'].includes(p.modo) || !Number.isInteger(p.etapa) || p.etapa < 0 || p.etapa > 5
    || !Number.isSafeInteger(p.versao) || p.versao < 1 || p.versao > Date.now() + 86400000
    || typeof p.finalizado !== 'boolean' || (p.finalizado && p.etapa !== 5)
    || !p.respostas || typeof p.respostas !== 'object' || Array.isArray(p.respostas)) return json({ok:false},400);
  const respostas: Record<string,string> = {};
  for (const [key, limit] of Object.entries(limits)) {
    const value = p.respostas[key] ?? '';
    if (typeof value !== 'string' || value.length > limit) return json({ok:false},400);
    respostas[key] = value.trim();
  }
  if (!Object.values(respostas).some(Boolean)) return json({ok:false},400);
  const origem: Record<string,string> = {};
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','referrer']) {
    if (typeof p.origem?.[key] === 'string') origem[key] = p.origem[key].slice(0,1000);
  }
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!key || !url) return json({ok:false},503);
  try {
    const response = await fetch(`${url}/rest/v1/rpc/salvar_lead_rascunho`, {
      method:'POST',headers:{'Content-Type':'application/json',apikey:key,Authorization:`Bearer ${key}`},
      body:JSON.stringify({p:{sid:p.sid,modo:p.modo,etapa:p.etapa,versao:p.versao,finalizado:p.finalizado,respostas,origem}})
    });
    if (!response.ok) return json({ok:false},503);
    return json({ok:true});
  } catch { return json({ok:false},503); }
});

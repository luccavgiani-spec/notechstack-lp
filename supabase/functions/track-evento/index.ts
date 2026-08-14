/* Recebe os eventos de jornada da lp-v5 em LOTE e grava o percurso.

   POR QUE EM LOTE: o monitor do "Senta aí" dispara evento a cada escolha da
   árvore e a cada passo do formulário. Um POST por clique competiria com a
   digitação do terminal pela banda e pelo main thread — a experiência é o
   produto ali. O front acumula numa fila e manda a cada 3s ou no `pagehide`,
   via `sendBeacon`.

   POR QUE ESTA FUNCTION NÃO DECIDE NADA: toda a validação (formato do sid,
   lista de nomes de evento, teto por lote e por sessão, `greatest` na etapa)
   mora na função SQL `registrar_eventos`, numa transação só. Este arquivo é
   só o carteiro: recebe, confere o tamanho e entrega. Caminho de escrita
   público não pode ter a regra do lado que o cliente controla.

   Deploy: --no-verify-jwt (o navegador chama sem Authorization).
   `sendBeacon` manda como text/plain e NÃO deixa pôr header — por isso o
   Content-Type não é conferido aqui. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const MAX_BODY = 64 * 1024;   // 60 eventos com params cabem folgados

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST')    return json({ erro: 'metodo' }, 405);

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://sdeowbqmwkwseyktyemn.supabase.co';
  const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!KEY) {
    console.error('SUPABASE_SERVICE_ROLE_KEY ausente nos secrets da function');
    return json({ erro: 'config' }, 500);
  }

  const bruto = await req.text();
  if (bruto.length > MAX_BODY) return json({ erro: 'corpo_grande' }, 413);

  let p: Record<string, unknown>;
  try { p = JSON.parse(bruto); } catch { return json({ erro: 'json_invalido' }, 400); }

  /* device e user-agent saem do header, não do corpo: é dado que o cliente não
     precisa mandar e que a gente já tem de graça aqui */
  const ua = req.headers.get('user-agent') || '';
  p.user_agent = ua;
  if (!p.device) p.device = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop';

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/registrar_eventos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
      },
      body: JSON.stringify({ p }),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('registrar_eventos falhou:', r.status, JSON.stringify(out));
      return json({ erro: 'rpc', status: r.status }, 500);
    }
    return json(out);
  } catch (e) {
    console.error('track-evento falhou:', String(e));
    return json({ erro: 'rede' }, 500);
  }
});

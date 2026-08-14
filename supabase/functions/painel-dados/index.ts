/* Leitura do painel de percurso. É a ÚNICA porta de leitura das tabelas de
   jornada — `lead_sessoes` e `lead_eventos` estão com RLS ligada e sem policy,
   então nem a chave anônima enxerga nada.

   POR QUE NÃO LER DIRETO DO BANCO NO PAINEL: o painel é um HTML local, aberto
   do disco. Chave de serviço dentro de um HTML é chave publicada — basta o
   arquivo ir parar num anexo, num screenshot ou num commit. Aqui a chave fica
   no servidor e o painel se identifica com um token próprio, que só dá acesso
   de leitura e só a estas quatro consultas.

   Deploy: --no-verify-jwt + secret PAINEL_TOKEN.
   O JWT do Supabase não serve aqui porque não existe usuário — é uma
   ferramenta de uma pessoa só, autenticada por segredo compartilhado.

   Uso:
     GET ?v=funil&dias=30
     GET ?v=folhas
     GET ?v=leads&limite=50
     GET ?v=percurso&sid=<sid>
   sempre com o header `x-painel-token`. */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, x-painel-token',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

/* Comparação de tempo constante. Comparar segredo com === vaza o tamanho do
   prefixo correto pelo tempo de resposta; com poucos milhares de tentativas
   dá pra adivinhar caractere a caractere. */
function mesmoToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

const num = (v: string | null, padrao: number, teto: number) => {
  const n = parseInt(v || '', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, teto) : padrao;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const ESPERADO = Deno.env.get('PAINEL_TOKEN') || '';
  if (!ESPERADO) {
    console.error('PAINEL_TOKEN ausente nos secrets da function');
    return json({ erro: 'config' }, 500);
  }
  if (!mesmoToken(req.headers.get('x-painel-token') || '', ESPERADO)) {
    return json({ erro: 'nao_autorizado' }, 401);
  }

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://sdeowbqmwkwseyktyemn.supabase.co';
  const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!KEY) return json({ erro: 'config' }, 500);

  const u = new URL(req.url);
  const v = u.searchParams.get('v') || 'funil';

  const pg = async (caminho: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    });
    if (!r.ok) {
      const t = await r.text();
      console.error('Postgrest', r.status, caminho, t);
      throw new Error(`postgrest_${r.status}`);
    }
    return r.json();
  };

  try {
    if (v === 'funil') {
      const dias = num(u.searchParams.get('dias'), 30, 365);
      const desde = new Date(Date.now() - dias * 864e5).toISOString().slice(0, 10);
      return json(await pg(`funil_dia?dia=gte.${desde}&order=dia.desc`));
    }

    if (v === 'folhas') {
      return json(await pg('folha_desempenho?order=leads.desc,chegaram.desc'));
    }

    if (v === 'leads') {
      /* embutido pela FK lead_sessoes.lead_id → leads.id: uma viagem só,
         e o percurso já vem colado no contato */
      const limite = num(u.searchParams.get('limite'), 50, 500);
      const campos = [
        'sid', 'criada_em', 'ultima_em', 'etapa_max', 'virou_lead',
        'folha', 'nicho', 'caminho', 'modo',
        'utm_source', 'utm_medium', 'utm_campaign', 'gclid', 'fbclid',
        'referrer', 'device',
        'leads(id,nome,email,whatsapp,contexto,prazo,site,descricao,created_at,capi_status)',
      ].join(',');
      return json(await pg(
        `lead_sessoes?select=${campos}&order=ultima_em.desc&limit=${limite}`,
      ));
    }

    if (v === 'percurso') {
      const sid = (u.searchParams.get('sid') || '').trim();
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(sid)) return json({ erro: 'sid_invalido' }, 400);
      return json(await pg(
        `lead_eventos?sid=eq.${encodeURIComponent(sid)}&select=evento,params,ts&order=ts.asc&limit=400`,
      ));
    }

    return json({ erro: 'consulta_desconhecida' }, 400);
  } catch (e) {
    return json({ erro: String(e).replace(/^Error:\s*/, '') }, 500);
  }
});

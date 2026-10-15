/* Envios do diagnóstico do auditor: Meta CAPI + GA4 quando o diagnóstico é
   entregue, e o alerta por e-mail quando o teto diário estoura.

   SELF-CONTAINED DE PROPÓSITO: nada de `../_shared` (já quebrou deploy).
   TS apagável (sem enum/namespace): roda no Deno e no Node 24 dos testes.

   DEDUP META: o navegador manda fbq('trackCustom','DiagnosticoEntregue',{},
   {eventID: event_id}) com o MESMO event_id daqui; a Meta fica com uma cópia.
   GA4 SÓ POR AQUI: o navegador não manda diagnostico_entregue ao GA4, para
   não contar duas vezes.

   POLÍTICA DA META (ver meta-capi): custom_data leva só value e currency, e
   este evento não leva e-mail nem telefone.

   Nunca logar token, secret ou chave: as URLs com segredo não vão ao console. */

type Deps = { fetch: typeof fetch; env: (k: string) => string | undefined };

const PIXEL_ID  = '1753619075655271';
const GRAPH     = 'https://graph.facebook.com/v21.0';
const GA4_ID    = 'G-1YEB89RVER';
const GA4_MP    = 'https://www.google-analytics.com/mp/collect';
const RESEND    = 'https://api.resend.com/emails';
/* mesmo remetente do send-lead-email (domínio verificado na Resend) */
const REMETENTE = 'nó tech stack <leads@notechstack.com.br>';

async function postar(
  deps: Deps,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await deps.fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

/* client_id do GA4: o navegador extrai 'XXXX.YYYY' do cookie _ga. Se vier
   vazio, gera um aleatório no mesmo formato: o evento conta, mas não se liga
   à sessão do navegador (vira um usuário novo no GA4). */
function clientIdAleatorio(): string {
  const a = Math.floor(Math.random() * 2147483647);
  return `${a}.${Math.floor(Date.now() / 1000)}`;
}

type Entrada = {
  event_id: string;
  event_source_url: string;
  cache: boolean;
  fbp?: string;
  fbc?: string;
  ip?: string;
  ua?: string;
  ga_client_id?: string;
  test_event_code?: string;
};

async function enviarMeta(input: Entrada, deps: Deps): Promise<string> {
  const token = deps.env('META_ACCESS_TOKEN');
  if (!token) return 'sem_token';

  const user_data: Record<string, string> = {};
  if (input.fbp) user_data.fbp = input.fbp;
  if (input.fbc) user_data.fbc = input.fbc;
  if (input.ip)  user_data.client_ip_address = input.ip;
  if (input.ua)  user_data.client_user_agent = input.ua;

  const payload: Record<string, unknown> = {
    data: [{
      event_name: 'DiagnosticoEntregue',
      event_time: Math.floor(Date.now() / 1000),
      event_id: input.event_id,
      event_source_url: input.event_source_url,
      action_source: 'website',
      user_data,
      custom_data: { value: 0, currency: 'BRL' },
    }],
  };
  if (input.test_event_code) payload.test_event_code = input.test_event_code;

  const r = await postar(deps, `${GRAPH}/${PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`, payload);
  if (!r.ok) console.error('diagnostico: Meta CAPI não aceitou, status', r.status);
  return r.ok ? 'enviado' : 'falhou';
}

async function enviarGa4(input: Entrada, deps: Deps): Promise<string> {
  const secret = deps.env('GA4_API_SECRET');
  if (!secret) return 'sem_secret';

  const params: Record<string, unknown> = {
    event_id: input.event_id,
    cache: input.cache ? 1 : 0,
    engagement_time_msec: 1,
  };
  /* debug_mode só em teste: o evento aparece no DebugView do GA4 */
  if (input.test_event_code) params.debug_mode = 1;

  const body = {
    client_id: input.ga_client_id || clientIdAleatorio(),
    events: [{ name: 'diagnostico_entregue', params }],
  };
  /* O /mp/collect responde 2xx mesmo com payload inválido; validar com
     /debug/mp/collect é passo manual, fora deste código. */
  const r = await postar(deps, `${GA4_MP}?measurement_id=${GA4_ID}&api_secret=${encodeURIComponent(secret)}`, body);
  if (!r.ok) console.error('diagnostico: GA4 não aceitou, status', r.status);
  return r.ok ? 'enviado' : 'falhou';
}

export async function enviarDiagnosticoEntregue(
  input: Entrada,
  deps: Deps,
): Promise<{ meta: string; ga4: string }> {
  const [meta, ga4] = await Promise.all([enviarMeta(input, deps), enviarGa4(input, deps)]);
  return { meta, ga4 };
}

export async function enviarAlertaTeto(
  info: { dia: string; teto: number; destino: string },
  deps: Deps,
): Promise<string> {
  /* mesmo caminho do send-lead-email: Resend, chave RESEND_API_KEY */
  const chave = deps.env('RESEND_API_KEY');
  if (!chave) return 'sem_chave';

  const assunto = `Teto diário do auditor atingido (${info.teto} diagnósticos em ${info.dia})`;
  const r = await postar(deps, RESEND, {
    from: REMETENTE,
    to: [info.destino],
    subject: assunto,
    text: `${assunto}. Novos pedidos do dia ficam sem diagnóstico até a virada.`,
  }, { Authorization: `Bearer ${chave}` });
  if (!r.ok) console.error('diagnostico: alerta de teto não saiu, status', r.status);
  return r.ok ? 'enviado' : 'falhou';
}

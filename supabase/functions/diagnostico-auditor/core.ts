// Diagnostico gratuito do auditor de marketing (TASK-mv9tw7q71do). Contrato v1.
// Nucleo testavel: sem Deno e sem supabase-js. index.ts liga rpc/fetch/env/envios.
import { executarDiagnostico } from './diagnostico.ts';

export type EnviosDeps = { fetch: typeof fetch; env: (k: string) => string | undefined };
export type Envios = {
  enviarDiagnosticoEntregue: (
    input: {
      event_id: string; event_source_url: string; cache: boolean; fbp?: string; fbc?: string;
      ip?: string; ua?: string; ga_client_id?: string; test_event_code?: string;
    },
    deps: EnviosDeps,
  ) => Promise<{ meta: string; ga4: string }>;
  enviarAlertaTeto: (info: { dia: string; teto: number; destino: string }, deps: EnviosDeps) => Promise<string>;
};
export type Deps = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<any>;
  fetch: typeof fetch;
  env: (k: string) => string | undefined;
  now?: () => Date;
  envios: Envios;
  log?: (msg: string) => void;
};

const RE_EVENT = /^diag_[0-9a-f-]{36}$/;
const PEPPER_FIXO = 'notechstack-diag-v1-pepper-sem-salt';
const ORIGENS = new Set(['https://www.notechstack.com.br', 'https://notechstack.com.br']);

export function origemPermitida(o: string | null): string | null {
  if (!o) return null;
  if (ORIGENS.has(o)) return o;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/.test(o)) return o;
  return null;
}

function ipv4Privado(h: string): boolean {
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19));
}

// Valida e normaliza a URL alvo. null = proibida.
export function normalizarUrl(bruta: unknown): string | null {
  if (typeof bruta !== 'string') return null;
  let s = bruta.trim();
  if (!s || s.length > 2048) return null;
  if (!s.includes('://')) s = 'https://' + s;
  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const host = u.hostname.toLowerCase();
  if (host.startsWith('[') || !host.includes('.') || host.endsWith('.')) return null;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && ipv4Privado(host)) return null;
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) {
    const lk = k.toLowerCase();
    if (lk.startsWith('utm_') || lk === 'fbclid' || lk === 'gclid') u.searchParams.delete(k);
  }
  const out = u.toString();
  return out.length > 2048 ? null : out;
}

export function primeiroIp(xff: string | null): string {
  return (xff ?? '').split(',')[0].trim();
}

// Chave do usuario: IPv4 inteiro ou prefixo IPv6 /64.
export function chaveIp(ip: string): string {
  let s = ip.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (!s) return 'sem-ip';
  const m4 = s.match(/^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (m4) return m4[1];
  if (!s.includes(':')) return s;
  const partes = s.split('::');
  if (partes.length > 2) return s;
  const esq = partes[0] ? partes[0].split(':') : [];
  const dir = partes.length === 2 && partes[1] ? partes[1].split(':') : [];
  const faltam = partes.length === 2 ? 8 - esq.length - dir.length : 0;
  if (faltam < 0) return s;
  const todos = [...esq, ...Array(faltam).fill('0'), ...dir];
  if (todos.length !== 8 || !todos.every((h) => /^[0-9a-f]{1,4}$/.test(h))) return s;
  return todos.slice(0, 4).map((h) => h.padStart(4, '0')).join(':') + '::/64';
}

export async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.length > 0 && v.length <= max ? v : undefined;

export async function handle(req: Request, deps: Deps): Promise<Response> {
  const log = deps.log ?? ((m: string) => console.warn(m));
  const origin = req.headers.get('origin');
  const permitida = origemPermitida(origin);
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin' };
  if (permitida) {
    headers['Access-Control-Allow-Origin'] = permitida;
    headers['Access-Control-Allow-Headers'] = 'authorization, x-client-info, apikey, content-type';
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
  }
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

  if (origin && !permitida) return json({ status: 'erro', erro: 'origem_nao_permitida' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (req.method !== 'POST') return json({ status: 'erro', erro: 'metodo' }, 405);

  const raw = await req.text();
  if (raw.length > 16384) return json({ status: 'erro', erro: 'corpo_grande' }, 413);
  let p: any;
  try { p = JSON.parse(raw); } catch { return json({ status: 'erro', erro: 'json' }, 400); }
  if (!p || typeof p !== 'object' || p.v !== 1) return json({ status: 'erro', erro: 'versao' }, 400);
  if (typeof p.event_id !== 'string' || !RE_EVENT.test(p.event_id)) return json({ status: 'erro', erro: 'event_id' }, 400);
  if (p.consent !== 'granted' && p.consent !== 'denied') return json({ status: 'erro', erro: 'consent' }, 400);
  const pageUrl = str(p.page_url, 2048);
  if (!pageUrl || !/^https?:\/\//i.test(pageUrl)) return json({ status: 'erro', erro: 'page_url' }, 400);
  const url = normalizarUrl(p.url);
  if (!url) return json({ status: 'erro', erro: 'url_invalida' }, 400);

  const eventId: string = p.event_id;
  const consent = p.consent === 'granted';
  let utm: Record<string, string> | null = null;
  if (p.utm && typeof p.utm === 'object' && !Array.isArray(p.utm)) {
    for (const k of ['source', 'medium', 'campaign', 'content', 'term']) {
      const v = str(p.utm[k], 200);
      if (v) (utm ??= {})[k] = v;
    }
  }

  const ipBruto = primeiroIp(req.headers.get('x-forwarded-for'));
  let salt = deps.env('DIAG_IP_SALT');
  if (!salt) { log('diagnostico-auditor: DIAG_IP_SALT ausente, usando pepper fixo'); salt = PEPPER_FIXO; }
  const ipHash = await sha256(salt + chaveIp(ipBruto));
  const urlHash = await sha256(url);
  const envDeps: EnviosDeps = { fetch: deps.fetch, env: deps.env };

  const enviar = async (cache: boolean) => {
    if (!consent) return;
    try {
      const r = await deps.envios.enviarDiagnosticoEntregue({
        event_id: eventId, event_source_url: pageUrl, cache,
        fbp: str(p.fbp, 300), fbc: str(p.fbc, 500), ip: ipBruto || undefined,
        ua: req.headers.get('user-agent') ?? undefined, ga_client_id: str(p.ga_client_id, 200),
        test_event_code: str(p.test_event_code, 100),
      }, envDeps);
      await deps.rpc('diag_registrar_envio', { p_event_id: eventId, p_meta: r?.meta ?? null, p_ga4: r?.ga4 ?? null });
    } catch (e) {
      log(`diagnostico-auditor: envio falhou (${(e as Error)?.message ?? e})`);
      try { await deps.rpc('diag_registrar_envio', { p_event_id: eventId, p_meta: 'erro', p_ga4: 'erro' }); } catch { /* ignora */ }
    }
  };

  let r: any;
  try {
    r = await deps.rpc('diag_reservar', {
      p_event_id: eventId, p_ip_hash: ipHash, p_url_hash: urlHash, p_url: url, p_consent: consent,
      p_utm: utm, p_fbclid: consent ? str(p.fbclid, 500) ?? null : null,
    });
  } catch (e) {
    log(`diagnostico-auditor: diag_reservar falhou (${(e as Error)?.message ?? e})`);
    return json({ status: 'erro', erro: 'interno' }, 500);
  }

  switch (r?.resultado) {
    case 'duplicado':
      if (r.status === 'entregue') return json({ status: 'entregue', duplicado: true, cache: !!r.cache, event_id: eventId, report: r.report ?? null });
      if (r.status === 'reservado') return json({ status: 'em_andamento', duplicado: true, event_id: eventId }, 409);
      if (r.status === 'limite_usuario') return json({ status: 'limite_usuario', duplicado: true, event_id: eventId }, 429);
      if (r.status === 'teto_diario') return json({ status: 'teto_diario', duplicado: true, event_id: eventId }, 503);
      return json({ status: 'falha', duplicado: true, event_id: eventId }, 502);
    case 'cache':
      await enviar(true);
      return json({ status: 'entregue', cache: true, event_id: eventId, report: r.report });
    case 'teto_diario':
      if (r.alertar) {
        try {
          const enviado = await deps.envios.enviarAlertaTeto({ dia: String(r.dia), teto: Number(r.teto), destino: String(r.alerta_email) }, envDeps);
          await deps.rpc('diag_registrar_alerta', { p_dia: r.dia, p_tipo: 'teto_diario', p_enviado: String(enviado) });
        } catch (e) {
          log(`diagnostico-auditor: alerta de teto falhou (${(e as Error)?.message ?? e})`);
        }
      }
      return json({ status: 'teto_diario', event_id: eventId }, 503);
    case 'limite_usuario':
      return json({ status: 'limite_usuario', limite: r.limite, event_id: eventId }, 429);
    case 'reservado': {
      let report = null;
      try {
        report = await executarDiagnostico(url, { fetch: deps.fetch, now: deps.now, validarUrl: normalizarUrl });
      } catch (e) {
        log(`diagnostico-auditor: diagnostico quebrou (${(e as Error)?.message ?? e})`);
      }
      if (!report) {
        await deps.rpc('diag_concluir', { p_event_id: eventId, p_ok: false, p_report: null });
        return json({ status: 'falha', erro: 'site_inacessivel', event_id: eventId }, 502);
      }
      await deps.rpc('diag_concluir', { p_event_id: eventId, p_ok: true, p_report: report });
      await enviar(false);
      return json({ status: 'entregue', cache: false, event_id: eventId, report });
    }
    default:
      log(`diagnostico-auditor: resultado inesperado ${JSON.stringify(r)}`);
      return json({ status: 'erro', erro: 'interno' }, 500);
  }
}

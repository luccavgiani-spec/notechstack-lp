// Checagens sobre o HTML publico do site (sem LLM). TS apagavel: roda em Deno e em Node 24.
export type StatusChecagem = 'ok' | 'atencao' | 'problema' | 'nao_verificavel';
export type Checagem = { id: string; titulo: string; status: StatusChecagem; evidencia: string; recomendacao: string };
export type Report = {
  url: string;
  url_final: string;
  http_status: number;
  gerado_em: string;
  checagens: Checagem[];
  resumo: { ok: number; atencao: number; problema: number; nao_verificavel: number };
};
export type DiagDeps = {
  fetch: typeof fetch;
  now?: () => Date;
  // valida/normaliza cada destino de redirect; null = destino proibido
  validarUrl: (u: string) => string | null;
  timeoutMs?: number;
};

const LIMITE_CORPO = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const UA = 'NoTechStackAuditor/1.0 (+https://www.notechstack.com.br)';

async function lerAte(res: Response, max: number): Promise<string> {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    const falta = max - total;
    if (value.byteLength >= falta) {
      partes.push(value.subarray(0, falta));
      total += falta;
      try { await reader.cancel(); } catch { /* ignora */ }
      break;
    }
    partes.push(value);
    total += value.byteLength;
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const p of partes) { buf.set(p, off); off += p.byteLength; }
  return new TextDecoder('utf-8').decode(buf);
}

type Busca = { ok: true; status: number; html: string; urlFinal: string; ms: number } | { ok: false; erro: string };

export async function buscarSite(url: string, deps: DiagDeps): Promise<Busca> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 8000);
  const inicio = Date.now();
  try {
    let atual = url;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      const res = await deps.fetch(atual, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': UA, accept: 'text/html,application/xhtml+xml' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        try { await res.body?.cancel(); } catch { /* ignora */ }
        if (i === MAX_REDIRECTS) return { ok: false, erro: 'redirects_demais' };
        const destino = deps.validarUrl(new URL(res.headers.get('location') as string, atual).toString());
        if (!destino) return { ok: false, erro: 'redirect_proibido' };
        atual = destino;
        continue;
      }
      const ms = Date.now() - inicio;
      const html = await lerAte(res, LIMITE_CORPO);
      return { ok: true, status: res.status, html, urlFinal: atual, ms };
    }
    return { ok: false, erro: 'redirects_demais' };
  } catch (e) {
    return { ok: false, erro: ctrl.signal.aborted ? 'timeout' : 'rede' };
  } finally {
    clearTimeout(timer);
  }
}

const unicos = (re: RegExp, s: string, grupo = 0): string[] => [...new Set([...s.matchAll(re)].map((m) => m[grupo]))];

function bloqueado(status: number, html: string): boolean {
  if (status === 403 || status === 429) return true;
  return /captcha|cf-challenge|challenge-platform|Attention Required! \| Cloudflare|<title>\s*Just a moment/i.test(html);
}

export function analisar(url: string, busca: { status: number; html: string; urlFinal: string; ms: number }, agora: Date): Report {
  const { status, html, urlFinal, ms } = busca;
  const c: Checagem[] = [];
  const add = (id: string, titulo: string, st: StatusChecagem, evidencia: string, recomendacao: string) =>
    c.push({ id, titulo, status: st, evidencia, recomendacao });

  const https = urlFinal.startsWith('https://');
  add('https', 'HTTPS', https ? 'ok' : 'problema',
    https ? `Pagina final em HTTPS (${urlFinal}).` : `Pagina final sem HTTPS (${urlFinal}).`,
    https ? 'Nada a fazer.' : 'Ative HTTPS e redirecione http para https.');

  const semHtml = bloqueado(status, html) ? `O site bloqueou a leitura automatica (HTTP ${status} ou desafio anti-robo).`
    : (status < 200 || status >= 300) ? `O site respondeu HTTP ${status}.` : null;

  const ids = ['gtm', 'ga4', 'meta_pixel', 'duplicidade', 'google_ads', 'consentimento', 'meta_basicas'];
  const titulos: Record<string, string> = {
    gtm: 'Google Tag Manager', ga4: 'Google Analytics 4', meta_pixel: 'Pixel da Meta', duplicidade: 'Tags duplicadas',
    google_ads: 'Tag do Google Ads', consentimento: 'Consentimento de cookies', meta_basicas: 'Metadados basicos',
  };
  if (semHtml) {
    for (const id of ids) add(id, titulos[id], 'nao_verificavel', semHtml, 'Verificar manualmente ou liberar o acesso do auditor.');
  } else {
    const gtm = unicos(/GTM-[A-Z0-9]{4,10}\b/g, html);
    const noscript = /googletagmanager\.com\/ns\.html/i.test(html);
    if (gtm.length === 0) add('gtm', titulos.gtm, 'atencao', 'Nenhum container GTM encontrado no HTML.', 'Centralize as tags num container do Google Tag Manager.');
    else if (!noscript) add('gtm', titulos.gtm, 'atencao', `GTM ${gtm.join(', ')} sem o bloco noscript.`, 'Inclua o noscript do GTM logo apos a abertura do body.');
    else add('gtm', titulos.gtm, 'ok', `GTM ${gtm.join(', ')} com noscript.`, 'Nada a fazer.');

    const ga4 = unicos(/\bG-[A-Z0-9]{6,12}\b/g, html);
    if (ga4.length) add('ga4', titulos.ga4, 'ok', `GA4 direto no HTML: ${ga4.join(', ')}.`, 'Nada a fazer.');
    else if (gtm.length) add('ga4', titulos.ga4, 'nao_verificavel', 'Nenhum G- no HTML; pode estar dentro do GTM.', 'Confira a tag GA4 no container do GTM.');
    else add('ga4', titulos.ga4, 'problema', 'Nenhuma tag GA4 encontrada.', 'Instale o GA4 (via GTM, de preferencia).');

    const pixelIds = unicos(/fbq\(\s*['"]init['"]\s*,\s*['"](\d{6,20})['"]/g, html, 1);
    const pixel = pixelIds.length > 0 || /connect\.facebook\.net\/[^"']*fbevents\.js/i.test(html);
    if (pixel) add('meta_pixel', titulos.meta_pixel, 'ok', `Pixel no HTML${pixelIds.length ? ': ' + pixelIds.join(', ') : ''}.`, 'Nada a fazer.');
    else if (gtm.length) add('meta_pixel', titulos.meta_pixel, 'nao_verificavel', 'Pixel nao aparece no HTML; pode estar dentro do GTM.', 'Confira a tag do pixel no container do GTM.');
    else add('meta_pixel', titulos.meta_pixel, 'problema', 'Nenhum pixel da Meta encontrado.', 'Instale o pixel da Meta (via GTM, de preferencia).');

    const dup: string[] = [];
    if (gtm.length >= 2) dup.push(`${gtm.length} containers GTM`);
    if (ga4.length >= 2) dup.push(`${ga4.length} IDs GA4`);
    if (pixel && gtm.length) dup.push('pixel no HTML e GTM no site (confira se o pixel nao esta nos dois)');
    add('duplicidade', titulos.duplicidade, dup.length ? 'atencao' : 'ok',
      dup.length ? dup.join('; ') + '.' : 'Nenhuma duplicidade aparente no HTML.',
      dup.length ? 'Mantenha cada tag em um lugar so para nao contar evento em dobro.' : 'Nada a fazer.');

    const aw = unicos(/\bAW-\d{6,12}\b/g, html);
    if (aw.length) add('google_ads', titulos.google_ads, 'ok', `Google Ads: ${aw.join(', ')}.`, 'Nada a fazer.');
    else if (gtm.length) add('google_ads', titulos.google_ads, 'nao_verificavel', 'Nenhum AW- no HTML; pode estar dentro do GTM.', 'Confira a tag de conversao no GTM.');
    else add('google_ads', titulos.google_ads, 'atencao', 'Nenhuma tag do Google Ads encontrada.', 'Se anuncia no Google, instale a tag de conversao.');

    const cmp = html.match(/cookiebot|onetrust|cookieyes|usercentrics|goadopt|\badopt\b/i);
    const termo = /cookies/i.test(html);
    add('consentimento', titulos.consentimento, cmp || termo ? 'ok' : 'atencao',
      cmp ? `Plataforma de consentimento: ${cmp[0]}.` : termo ? 'Ha mencao a cookies (banner proprio?).' : 'Nenhum banner de consentimento encontrado.',
      cmp || termo ? 'Confira se as tags respeitam a escolha do visitante.' : 'Instale um banner de consentimento (LGPD) ligado ao Consent Mode.');

    const faltam: string[] = [];
    if (!/<title[^>]*>\s*[^<\s][^<]*<\/title>/i.test(html)) faltam.push('title');
    if (!/<meta[^>]+name=["']description["'][^>]*>/i.test(html)) faltam.push('description');
    if (!/<meta[^>]+property=["']og:title["'][^>]*>/i.test(html)) faltam.push('og:title');
    if (!/<meta[^>]+property=["']og:image["'][^>]*>/i.test(html)) faltam.push('og:image');
    add('meta_basicas', titulos.meta_basicas, faltam.length === 0 ? 'ok' : faltam.includes('title') ? 'problema' : 'atencao',
      faltam.length ? `Faltando: ${faltam.join(', ')}.` : 'title, description, og:title e og:image presentes.',
      faltam.length ? 'Preencha os metadados que faltam.' : 'Nada a fazer.');
  }

  add('tempo_resposta', 'Tempo de resposta', ms < 3000 ? 'ok' : ms <= 6000 ? 'atencao' : 'problema',
    `Primeira resposta em ${(ms / 1000).toFixed(1)}s.`,
    ms < 3000 ? 'Nada a fazer.' : 'Reduza o tempo de resposta do servidor (cache, CDN, hospedagem).');
  add('eventos_servidor', 'Eventos pelo servidor (CAPI / Measurement Protocol)', 'nao_verificavel',
    'Requer conectar Meta/Google.', 'Conecte as contas para verificar os eventos enviados pelo servidor.');

  const resumo = { ok: 0, atencao: 0, problema: 0, nao_verificavel: 0 };
  for (const x of c) resumo[x.status]++;
  return { url, url_final: urlFinal, http_status: status, gerado_em: agora.toISOString(), checagens: c, resumo };
}

// null = site inacessivel (DNS, rede, timeout, redirect proibido): a reserva vira falha.
export async function executarDiagnostico(url: string, deps: DiagDeps): Promise<Report | null> {
  const b = await buscarSite(url, deps);
  if (!b.ok) return null;
  return analisar(url, b, (deps.now ?? (() => new Date()))());
}

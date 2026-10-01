// Período, dinheiro e parsers das respostas das plataformas.
// Sem Deno nem rede aqui: tudo é testado pelo Vitest do app.

export type Periodo = {
  id: string;
  de: string;
  ate: string;
  dias: number;
  rotulo: string;
};

// America/Sao_Paulo não tem horário de verão desde 2019.
const OFFSET_SAO_PAULO = "-03:00";
const OFFSET_MS = 3 * 60 * 60 * 1000;
const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DIAS = 366;

export function hojeSaoPaulo(now: Date): string {
  return new Date(now.getTime() - OFFSET_MS).toISOString().slice(0, 10);
}

export function addDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dataValida(data: string): boolean {
  if (!DATA_ISO.test(data)) return false;
  return new Date(`${data}T12:00:00Z`).toISOString().slice(0, 10) === data;
}

function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000) + 1;
}

function formatar(data: string): string {
  const [a, m, d] = data.split("-");
  return `${d}/${m}/${a}`;
}

function montar(id: string, de: string, ate: string, rotulo: string): Periodo {
  return { id, de, ate, dias: diasEntre(de, ate), rotulo };
}

// `7d` e `30d` terminam ontem, como "Últimos 7 dias" do Ads Manager.
export function parsePeriodo(raw: string | null | undefined, now: Date): Periodo | null {
  const valor = (raw ?? "").trim() || "7d";
  const hoje = hojeSaoPaulo(now);
  const ontem = addDias(hoje, -1);

  if (valor === "7d") return montar("7d", addDias(ontem, -6), ontem, "Últimos 7 dias");
  if (valor === "30d") return montar("30d", addDias(ontem, -29), ontem, "Últimos 30 dias");
  if (valor === "mes-passado") {
    const primeiroDesteMes = `${hoje.slice(0, 7)}-01`;
    const ate = addDias(primeiroDesteMes, -1);
    return montar("mes-passado", `${ate.slice(0, 7)}-01`, ate, "Mês passado");
  }

  const partes = valor.split("..");
  if (partes.length !== 2) return null;
  const [de, ate] = partes;
  if (!dataValida(de) || !dataValida(ate) || de > ate || ate > hoje) return null;
  if (diasEntre(de, ate) > MAX_DIAS) return null;
  return montar(valor, de, ate, `${formatar(de)} a ${formatar(ate)}`);
}

export function periodoAnterior(p: Periodo): Periodo {
  const ate = addDias(p.de, -1);
  const de = addDias(ate, -(p.dias - 1));
  return montar(`${de}..${ate}`, de, ate, `${formatar(de)} a ${formatar(ate)}`);
}

// Dias ainda abertos mudam; períodos fechados podem ficar mais tempo em cache.
export function ttlSegundos(p: Periodo, now: Date): number {
  const ontem = addDias(hojeSaoPaulo(now), -1);
  return p.ate >= ontem ? 15 * 60 : 60 * 60;
}

export function limitesUtc(p: Periodo): { inicio: string; fimExclusivo: string } {
  return {
    inicio: new Date(`${p.de}T00:00:00${OFFSET_SAO_PAULO}`).toISOString(),
    fimExclusivo: new Date(`${addDias(p.ate, 1)}T00:00:00${OFFSET_SAO_PAULO}`).toISOString(),
  };
}

// Dinheiro sempre em centavos inteiros, para bater ao centavo com os painéis.
export function centavosDeTexto(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number.parseFloat(String(valor ?? "0"));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function centavosDeMicros(micros: unknown): number {
  const n = Number(micros ?? 0);
  return Number.isFinite(n) ? Math.round(n / 10_000) : 0;
}

export function microsDeCentavos(centavos: number): string {
  return String(Math.round(centavos) * 10_000);
}

export function inteiro(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

export function decimal(valor: unknown, casas = 2): number {
  const n = Number(valor ?? 0);
  if (!Number.isFinite(n)) return 0;
  const f = 10 ** casas;
  return Math.round(n * f) / f;
}

// ---------------------------------------------------------------- Meta Ads

export type MetaAction = { action_type: string; value: string };

// A coluna "Leads" do Ads Manager usa `lead`; os outros são o recuo quando a
// conta não devolve o agregado. A prova V1 registra qual veio de fato.
export const META_LEAD_ACTION_TYPES = [
  "lead",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.lead_grouped",
] as const;

export function metaLeads(actions: MetaAction[] | undefined): number {
  if (!actions?.length) return 0;
  for (const tipo of META_LEAD_ACTION_TYPES) {
    const achado = actions.find((a) => a.action_type === tipo);
    if (achado) return inteiro(achado.value);
  }
  return 0;
}

export type MetaInsightRow = {
  date_start?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: MetaAction[];
};

export type MetricasPagas = {
  gasto_centavos: number;
  impressoes: number;
  alcance: number | null;
  cliques: number;
  cliques_link: number | null;
  conversoes: number;
};

export function parseMetaInsight(row: MetaInsightRow): MetricasPagas {
  return {
    gasto_centavos: centavosDeTexto(row.spend),
    impressoes: inteiro(row.impressions),
    alcance: row.reach === undefined ? null : inteiro(row.reach),
    cliques: inteiro(row.clicks),
    cliques_link: row.inline_link_clicks === undefined ? null : inteiro(row.inline_link_clicks),
    conversoes: metaLeads(row.actions),
  };
}

// -------------------------------------------------------------- Google Ads

export type GoogleAdsMetrics = {
  costMicros?: string;
  clicks?: string;
  impressions?: string;
  conversions?: number | string;
};

export function parseGoogleAdsMetrics(m: GoogleAdsMetrics | undefined): MetricasPagas {
  return {
    gasto_centavos: centavosDeMicros(m?.costMicros),
    impressoes: inteiro(m?.impressions),
    alcance: null,
    cliques: inteiro(m?.clicks),
    cliques_link: null,
    conversoes: decimal(m?.conversions, 2),
  };
}

export function somarMetricas(linhas: MetricasPagas[]): MetricasPagas {
  const soma = (f: (m: MetricasPagas) => number | null) => {
    const valores = linhas.map(f);
    return valores.some((v) => v === null) && linhas.length ? null : valores.reduce<number>((a, v) => a + (v ?? 0), 0);
  };
  return {
    gasto_centavos: soma((m) => m.gasto_centavos) ?? 0,
    impressoes: soma((m) => m.impressoes) ?? 0,
    alcance: soma((m) => m.alcance),
    cliques: soma((m) => m.cliques) ?? 0,
    cliques_link: soma((m) => m.cliques_link),
    conversoes: decimal(soma((m) => m.conversoes) ?? 0, 2),
  };
}

// --------------------------------------------------------------------- GA4

export type Ga4Report = {
  dimensionHeaders?: { name: string }[];
  metricHeaders?: { name: string }[];
  rows?: { dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }[];
};

export type Ga4Linha = { dimensoes: Record<string, string>; metricas: Record<string, number> };

export function parseGa4Report(report: Ga4Report): Ga4Linha[] {
  const dims = (report.dimensionHeaders ?? []).map((h) => h.name);
  const mets = (report.metricHeaders ?? []).map((h) => h.name);
  return (report.rows ?? []).map((row) => ({
    dimensoes: Object.fromEntries(dims.map((nome, i) => [nome, row.dimensionValues?.[i]?.value ?? ""])),
    metricas: Object.fromEntries(mets.map((nome, i) => [nome, Number(row.metricValues?.[i]?.value ?? 0)])),
  }));
}

// ------------------------------------------------------------ Search Console

export type GscResposta = {
  rows?: { keys?: string[]; clicks?: number; impressions?: number; ctr?: number; position?: number }[];
};

export type GscLinha = { chave: string; cliques: number; impressoes: number; ctr: number; posicao: number };

export function parseGsc(resposta: GscResposta): GscLinha[] {
  return (resposta.rows ?? []).map((r) => ({
    chave: r.keys?.[0] ?? "",
    cliques: inteiro(r.clicks),
    impressoes: inteiro(r.impressions),
    ctr: decimal(r.ctr, 4),
    posicao: decimal(r.position, 1),
  }));
}

export type GscCrescimento = GscLinha & { cliques_antes: number; variacao: number };

// "Quais páginas mais cresceram": diferença absoluta de cliques contra o
// período anterior de mesmo tamanho.
export function paginasQueCresceram(atual: GscLinha[], anterior: GscLinha[], limite = 10): GscCrescimento[] {
  const antes = new Map(anterior.map((l) => [l.chave, l.cliques]));
  return atual
    .map((l) => ({ ...l, cliques_antes: antes.get(l.chave) ?? 0, variacao: l.cliques - (antes.get(l.chave) ?? 0) }))
    .filter((l) => l.variacao > 0)
    .sort((a, b) => b.variacao - a.variacao || b.cliques - a.cliques)
    .slice(0, limite);
}

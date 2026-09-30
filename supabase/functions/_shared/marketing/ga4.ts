// GA4 Data API: sessões e eventos-chave por canal, mais o custo do Google Ads
// vinculado (advertiserAdCost) como conferência cruzada do bloco Google Ads.

import { googleFetch } from "./google-auth.ts";
import { type Ga4Report, type Periodo, addDias, centavosDeTexto, inteiro, parseGa4Report } from "./normalize.ts";

const GA4_API = "https://analyticsdata.googleapis.com/v1beta";

export function pedidosGa4(p: Periodo) {
  const dateRanges = [{ startDate: p.de, endDate: p.ate }];
  return [
    {
      dateRanges,
      dimensions: [{ name: "sessionDefaultChannelGroup" }],
      metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "keyEvents" }],
      orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    },
    {
      dateRanges,
      dimensions: [{ name: "date" }],
      metrics: [{ name: "sessions" }, { name: "keyEvents" }],
    },
    {
      dateRanges,
      dimensions: [{ name: "eventName" }],
      metrics: [{ name: "keyEvents" }],
      orderBys: [{ metric: { metricName: "keyEvents" }, desc: true }],
      limit: 20,
    },
    {
      dateRanges,
      metrics: [{ name: "advertiserAdCost" }, { name: "advertiserAdClicks" }, { name: "advertiserAdImpressions" }],
    },
  ];
}

export async function ga4Resumo(token: string, propertyId: string, p: Periodo) {
  const resp = await googleFetch<{ reports?: Ga4Report[] }>(
    `${GA4_API}/properties/${encodeURIComponent(propertyId)}:batchRunReports`,
    token,
    { body: { requests: pedidosGa4(p) } },
  );
  const [canais, dias, eventos, anuncios] = (resp.reports ?? []).map(parseGa4Report);

  const porCanal = (canais ?? []).map((l) => ({
    canal: l.dimensoes.sessionDefaultChannelGroup || "(sem canal)",
    sessoes: inteiro(l.metricas.sessions),
    usuarios: inteiro(l.metricas.totalUsers),
    eventos_chave: inteiro(l.metricas.keyEvents),
  }));

  const porData = new Map((dias ?? []).map((l) => {
    const d = l.dimensoes.date;
    return [`${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, l.metricas];
  }));
  const por_dia: { dia: string; sessoes: number; eventos_chave: number }[] = [];
  for (let d = p.de; d <= p.ate; d = addDias(d, 1)) {
    const m = porData.get(d);
    por_dia.push({ dia: d, sessoes: inteiro(m?.sessions), eventos_chave: inteiro(m?.keyEvents) });
  }

  const ads = anuncios?.[0]?.metricas;
  // Usuários não somam entre canais (a mesma pessoa chega por mais de um); sessões e eventos somam.
  return {
    sessoes: porCanal.reduce((a, c) => a + c.sessoes, 0),
    eventos_chave: porCanal.reduce((a, c) => a + c.eventos_chave, 0),
    por_canal: porCanal,
    por_dia,
    eventos: (eventos ?? [])
      .map((l) => ({ evento: l.dimensoes.eventName, total: inteiro(l.metricas.keyEvents) }))
      .filter((e) => e.total > 0),
    google_ads_segundo_ga4: {
      gasto_centavos: centavosDeTexto(ads?.advertiserAdCost ?? 0),
      cliques: inteiro(ads?.advertiserAdClicks),
      impressoes: inteiro(ads?.advertiserAdImpressions),
    },
  };
}

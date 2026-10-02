// Search Console: cliques, impressões, consultas, páginas e as páginas que mais
// cresceram contra o período anterior. As datas do GSC são no fuso do Pacífico.

import { googleFetch } from "./google-auth.ts";
import { type GscResposta, type Periodo, addDias, paginasQueCresceram, parseGsc, periodoAnterior } from "./normalize.ts";

const GSC_API = "https://searchconsole.googleapis.com/webmasters/v3";

export function urlConsultaGsc(site: string): string {
  return `${GSC_API}/sites/${encodeURIComponent(site)}/searchAnalytics/query`;
}

export async function gscResumo(token: string, site: string, p: Periodo) {
  const url = urlConsultaGsc(site);
  const consulta = (de: string, ate: string, dimensions: string[], rowLimit: number) =>
    googleFetch<GscResposta>(url, token, { body: { startDate: de, endDate: ate, dimensions, rowLimit } });
  const anterior = periodoAnterior(p);

  const [dias, consultas, paginas, paginasAntes] = await Promise.all([
    consulta(p.de, p.ate, ["date"], 400),
    consulta(p.de, p.ate, ["query"], 25),
    consulta(p.de, p.ate, ["page"], 250),
    consulta(anterior.de, anterior.ate, ["page"], 250),
  ]);

  const porData = new Map(parseGsc(dias).map((l) => [l.chave, l]));
  const por_dia: { dia: string; cliques: number; impressoes: number }[] = [];
  for (let d = p.de; d <= p.ate; d = addDias(d, 1)) {
    const l = porData.get(d);
    por_dia.push({ dia: d, cliques: l?.cliques ?? 0, impressoes: l?.impressoes ?? 0 });
  }
  const cliques = por_dia.reduce((a, d) => a + d.cliques, 0);
  const impressoes = por_dia.reduce((a, d) => a + d.impressoes, 0);
  const listaPaginas = parseGsc(paginas);

  return {
    site,
    cliques,
    impressoes,
    ctr: impressoes ? Math.round((cliques / impressoes) * 10_000) / 10_000 : 0,
    por_dia,
    consultas: parseGsc(consultas),
    paginas: listaPaginas.slice(0, 25),
    paginas_que_cresceram: paginasQueCresceram(listaPaginas, parseGsc(paginasAntes)),
    comparado_com: { de: anterior.de, ate: anterior.ate },
  };
}

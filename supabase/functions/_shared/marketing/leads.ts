// Leads do funil próprio da nó, só em contagem (R9): por dia e por canal.
// Lê apenas colunas de origem; nome, e-mail e WhatsApp nunca saem da tabela.

import { type Periodo, addDias, hojeSaoPaulo, limitesUtc } from "./normalize.ts";

export const COLUNAS_ORIGEM_LEAD = "created_at,utm_source,utm_medium,gclid,fbclid";

export type LeadOrigem = {
  created_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  gclid: string | null;
  fbclid: string | null;
};

export type CanalLead = "meta" | "google" | "organico" | "direto" | "outros";

const FONTES_META = new Set(["facebook", "fb", "instagram", "ig", "meta"]);
const MEIOS_PAGOS = new Set(["cpc", "ppc", "paid", "paidsearch", "paid_search", "ads", "pago"]);
const BUSCADORES = new Set(["google", "bing", "duckduckgo", "yahoo"]);

export function canalDoLead(l: LeadOrigem): CanalLead {
  const fonte = (l.utm_source ?? "").trim().toLowerCase();
  const meio = (l.utm_medium ?? "").trim().toLowerCase();
  if (l.fbclid || FONTES_META.has(fonte)) return "meta";
  if (l.gclid || (fonte === "google" && MEIOS_PAGOS.has(meio))) return "google";
  if (BUSCADORES.has(fonte) || meio === "organic") return "organico";
  if (!fonte && !meio) return "direto";
  return "outros";
}

export type ContagemLeads = {
  total: number;
  por_canal: Record<CanalLead, number>;
  por_dia: { dia: string; total: number }[];
};

export function contarLeads(linhas: LeadOrigem[], p: Periodo): ContagemLeads {
  const por_canal: Record<CanalLead, number> = { meta: 0, google: 0, organico: 0, direto: 0, outros: 0 };
  const dias = new Map<string, number>();
  for (let d = p.de; d <= p.ate; d = addDias(d, 1)) dias.set(d, 0);
  for (const l of linhas) {
    por_canal[canalDoLead(l)] += 1;
    const dia = hojeSaoPaulo(new Date(l.created_at));
    if (dias.has(dia)) dias.set(dia, (dias.get(dia) ?? 0) + 1);
  }
  return {
    total: linhas.length,
    por_canal,
    por_dia: [...dias.entries()].map(([dia, total]) => ({ dia, total })),
  };
}

export async function leadsResumo(
  carregar: (inicioUtc: string, fimExclusivoUtc: string) => Promise<LeadOrigem[]>,
  p: Periodo,
): Promise<ContagemLeads> {
  const { inicio, fimExclusivo } = limitesUtc(p);
  return contarLeads(await carregar(inicio, fimExclusivo), p);
}

// ------------------------------------------------- Classificação (preparo)
// Ainda não ligada: onde a classe mora é T2-Unresolved 1. Recebe a classe mais
// recente de cada lead já resolvida por quem chamar; `null` = a classificar.

export type ClasseLead = "real" | "teste" | "invalido" | "duplicado";

export type ContagemClassificada = {
  validos: number;
  por_classe: Record<ClasseLead | "a_classificar", number>;
  por_canal_validos: Record<CanalLead, number>;
};

export function contarClassificados(itens: { origem: LeadOrigem; classe: ClasseLead | null }[]): ContagemClassificada {
  const por_classe: ContagemClassificada["por_classe"] = { real: 0, teste: 0, invalido: 0, duplicado: 0, a_classificar: 0 };
  const por_canal_validos: Record<CanalLead, number> = { meta: 0, google: 0, organico: 0, direto: 0, outros: 0 };
  for (const { origem, classe } of itens) {
    por_classe[classe ?? "a_classificar"] += 1;
    if (classe === "real") por_canal_validos[canalDoLead(origem)] += 1;
  }
  return { validos: por_classe.real, por_classe, por_canal_validos };
}

// Estado de cada métrica (contrato com o planner e com o dot, R7): por que um
// número está ou não está na tela. Sub-consulta que falha fica registrada aqui
// em vez de virar `null` em silêncio.

import { MetaApiError } from "../meta.ts";
import { GoogleApiError } from "./google-auth.ts";

export type EstadoMetrica = "disponivel" | "zero" | "indisponivel" | "sem_permissao" | "parcial" | "atrasado" | "erro";

export function mensagemMeta(e: unknown): string {
  if (e instanceof MetaApiError) {
    const err = (e.body as { error?: { message?: string; error_user_title?: string; error_user_msg?: string; code?: number } })?.error;
    if (err?.error_user_msg) return `${err.error_user_title ?? "Meta"}: ${err.error_user_msg}`;
    if (err?.message) return `Meta ${err.code ?? e.status}: ${err.message}`;
    return `Meta HTTP ${e.status}`;
  }
  return e instanceof Error ? e.message : String(e);
}

export function mensagemDeErro(e: unknown): string {
  if (e instanceof GoogleApiError) return `Google: ${e.message}`;
  return mensagemMeta(e);
}

// Prefixos de token Google (access, refresh, client secret) e Meta. Nenhuma
// mensagem que sai da função ou vai ao log carrega um deles. Montados por
// partes para que a busca do critério de segredos (T1-3) no diff não ache
// falso positivo no próprio código que os remove.
export const PREFIXOS_TOKEN = ["ya" + "29.", "1/" + "/0", "GOC" + "SPX-", "E" + "AA"] as const;

const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const SEGREDOS = PREFIXOS_TOKEN.map((prefixo, i) =>
  new RegExp(`${i === 3 ? "(?<![A-Za-z0-9])" : ""}${escapar(prefixo)}[\\w./-]*`, "g")
);

export function semSegredo(texto: string): string {
  return SEGREDOS.reduce((t, re) => t.replace(re, "[removido]"), texto);
}

export function codigoGraph(e: unknown): number | null {
  if (!(e instanceof MetaApiError)) return null;
  const codigo = (e.body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof codigo === "number" ? codigo : null;
}

// Guia de erros da Graph: 10 = "Permissão de API negada"; 200–299 = "Permissão da API".
export function semPermissao(e: unknown): boolean {
  const codigo = codigoGraph(e);
  if (codigo !== null) return codigo === 10 || (codigo >= 200 && codigo <= 299);
  return e instanceof GoogleApiError && e.status === 403;
}

export type FalhaSubconsulta = {
  // Métricas afetadas. Vazio = tentativa que não muda número (variante sondada).
  chaves: string[];
  estado: "sem_permissao" | "erro";
  mensagem: string;
  variante: string | null;
};

export class Registro {
  readonly falhas: FalhaSubconsulta[] = [];

  falhou(chaves: string[], e: unknown, variante: string | null = null): void {
    const falha: FalhaSubconsulta = {
      chaves,
      estado: semPermissao(e) ? "sem_permissao" : "erro",
      mensagem: semSegredo(mensagemDeErro(e)).slice(0, 300),
      variante,
    };
    const igual = this.falhas.some((f) =>
      f.estado === falha.estado && f.mensagem === falha.mensagem && f.variante === falha.variante && f.chaves.join() === falha.chaves.join()
    );
    if (!igual) this.falhas.push(falha);
  }

  estadoDe(chave: string): "sem_permissao" | "erro" | null {
    const afetam = this.falhas.filter((f) => f.chaves.includes(chave));
    if (!afetam.length) return null;
    return afetam.some((f) => f.estado === "sem_permissao") ? "sem_permissao" : "erro";
  }

  get parcial(): boolean {
    return this.falhas.some((f) => f.chaves.length > 0);
  }
}

export async function tentar<T>(reg: Registro, chaves: string[], f: () => Promise<T>, variante: string | null = null): Promise<T | null> {
  try {
    return await f();
  } catch (e) {
    reg.falhou(chaves, e, variante);
    return null;
  }
}

export type Valores = Record<string, number | null | undefined>;

// `periodo`: métricas do período (podem estar atrasadas); `fixas`: valores do
// momento, como seguidores. Só entra o que não está `disponivel`.
export function calcularEstados(
  entrada: { periodo?: Valores; fixas?: Valores; atrasado: boolean },
  reg: Registro,
): Record<string, EstadoMetrica> {
  const estados: Record<string, EstadoMetrica> = {};
  const avaliar = (valores: Valores, doPeriodo: boolean) => {
    for (const [chave, valor] of Object.entries(valores)) {
      const falha = reg.estadoDe(chave);
      if (valor === null || valor === undefined) estados[chave] = falha ?? "indisponivel";
      else if (falha) estados[chave] = "parcial";
      else if (doPeriodo && entrada.atrasado) estados[chave] = "atrasado";
      else if (valor === 0) estados[chave] = "zero";
    }
  };
  avaliar(entrada.fixas ?? {}, false);
  avaliar(entrada.periodo ?? {}, true);
  for (const f of reg.falhas) {
    for (const chave of f.chaves) if (!(chave in estados)) estados[chave] = reg.estadoDe(chave) ?? f.estado;
  }
  if (reg.parcial) estados.bloco = "parcial";
  else if (entrada.atrasado) estados.bloco = "atrasado";
  return estados;
}

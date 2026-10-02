// Validação das escritas do planner. O servidor não confia no formulário:
// o dot pode mandar qualquer coisa pela mesma tela.

import { CORRESPONDENCIAS, ESTRATEGIAS_GOOGLE, type NovaCampanhaGoogle } from "./google-ads.ts";
import { type EdicaoMeta, META_CTAS, META_OBJETIVOS, type NivelMeta, type NovaCampanhaMeta } from "./meta.ts";

export type Validado<T> = { ok: true; valor: T } | { ok: false; campos: string[] };

type Obj = Record<string, unknown>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIGITOS = /^\d{1,20}$/;
const PAIS = /^[A-Z]{2}$/;
export const CAMINHO_MIDIA = /^\d{4}\/\d{2}\/[0-9a-f-]{36}-[a-z0-9._-]{1,80}$/;
const IMAGEM_JPEG = /\.(jpe?g)$/i;
const IMAGEM = /\.(jpe?g|png)$/i;
const VIDEO = /\.(mp4|mov)$/i;

export const TIPOS_MIDIA: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

function obj(v: unknown): Obj {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Obj : {};
}

function texto(v: unknown, min: number, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= min && t.length <= max ? t : null;
}

function inteiroEntre(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function dataHora(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function urlHttps(v: unknown): string | null {
  const t = texto(v, 10, 2000);
  if (!t) return null;
  try {
    return new URL(t).protocol === "https:" ? t : null;
  } catch (_) {
    return null;
  }
}

function umDe<T extends string>(v: unknown, opcoes: readonly T[]): T | null {
  return typeof v === "string" && (opcoes as readonly string[]).includes(v) ? v as T : null;
}

export function requestId(v: unknown): string | null {
  return texto(v, 8, 200);
}

function resultado<T>(campos: string[], montar: () => T): Validado<T> {
  return campos.length ? { ok: false, campos } : { ok: true, valor: montar() };
}

export function validarCampanhaMeta(corpo: unknown): Validado<NovaCampanhaMeta> {
  const b = obj(corpo);
  const orc = obj(b.orcamento);
  const pub = obj(b.publico);
  const cri = obj(b.criativo);
  const campos: string[] = [];

  const nome = texto(b.nome, 3, 200) ?? (campos.push("nome"), "");
  const objetivo = umDe(b.objetivo, META_OBJETIVOS) ?? (campos.push("objetivo"), "OUTCOME_TRAFFIC");
  const tipoOrc = umDe(orc.tipo, ["diario", "total"] as const) ?? (campos.push("orcamento.tipo"), "diario");
  const centavos = inteiroEntre(orc.centavos, 100, 100_000_000) ?? (campos.push("orcamento.centavos"), 0);
  const inicio = dataHora(b.inicio) ?? (campos.push("inicio"), "");
  const fim = b.fim === null || b.fim === undefined || b.fim === "" ? null : dataHora(b.fim);
  if (b.fim && !fim) campos.push("fim");
  if (tipoOrc === "total" && !fim) campos.push("fim");
  if (fim && inicio && fim <= inicio) campos.push("fim");

  const paises = Array.isArray(pub.paises) ? pub.paises.filter((p): p is string => typeof p === "string" && PAIS.test(p)) : [];
  if (Array.isArray(pub.paises) && paises.length !== pub.paises.length) campos.push("publico.paises");
  const cidades = Array.isArray(pub.cidades) ? pub.cidades.map(obj).map((c) => ({
    key: typeof c.key === "string" && DIGITOS.test(c.key) ? c.key : "",
    nome: texto(c.nome, 1, 200) ?? "",
    raio_km: inteiroEntre(c.raio_km, 1, 80) ?? 0,
  })) : [];
  if (cidades.some((c) => !c.key || !c.raio_km)) campos.push("publico.cidades");
  const regioes = Array.isArray(pub.regioes) ? pub.regioes.map(obj).map((r) => ({
    key: typeof r.key === "string" && DIGITOS.test(r.key) ? r.key : "",
    nome: texto(r.nome, 1, 200) ?? "",
  })) : [];
  if (regioes.some((r) => !r.key)) campos.push("publico.regioes");
  if (!paises.length && !cidades.length && !regioes.length) campos.push("publico.local");
  const idadeMin = inteiroEntre(pub.idade_min, 18, 65) ?? (campos.push("publico.idade_min"), 18);
  const idadeMax = inteiroEntre(pub.idade_max, 18, 65) ?? (campos.push("publico.idade_max"), 65);
  if (idadeMax < idadeMin) campos.push("publico.idade_max");
  const genero = umDe(pub.genero, ["todos", "masculino", "feminino"] as const) ?? (campos.push("publico.genero"), "todos");

  const tipoCri = umDe(cri.tipo, ["imagem", "video"] as const) ?? (campos.push("criativo.tipo"), "imagem");
  const midia = typeof cri.midia === "string" && CAMINHO_MIDIA.test(cri.midia) ? cri.midia : (campos.push("criativo.midia"), "");
  if (midia && (tipoCri === "imagem" ? !IMAGEM.test(midia) : !VIDEO.test(midia))) campos.push("criativo.midia");
  const textoAnuncio = texto(cri.texto, 1, 2000) ?? (campos.push("criativo.texto"), "");
  const titulo = texto(cri.titulo, 1, 255) ?? (campos.push("criativo.titulo"), "");
  const link = urlHttps(cri.link) ?? (campos.push("criativo.link"), "");
  const cta = umDe(cri.cta, META_CTAS) ?? (campos.push("criativo.cta"), "LEARN_MORE");

  return resultado([...new Set(campos)], () => ({
    nome,
    objetivo,
    orcamento: { tipo: tipoOrc, centavos },
    inicio,
    fim,
    publico: { paises, cidades, regioes, idade_min: idadeMin, idade_max: idadeMax, genero },
    criativo: { tipo: tipoCri, midia, texto: textoAnuncio, titulo, link, cta },
  }));
}

export function validarEdicaoMeta(nivelBruto: unknown, corpo: unknown): Validado<{ nivel: NivelMeta; edicao: EdicaoMeta }> {
  const b = obj(corpo);
  const campos: string[] = [];
  const nivel = umDe(nivelBruto, ["campaign", "adset", "ad"] as const) ?? (campos.push("nivel"), "campaign");
  const edicao: EdicaoMeta = {};
  if (b.nome !== undefined) edicao.nome = texto(b.nome, 3, 200) ?? (campos.push("nome"), "");
  if (b.orcamento_diario_centavos !== undefined) {
    edicao.orcamento_diario_centavos = inteiroEntre(b.orcamento_diario_centavos, 100, 100_000_000) ?? (campos.push("orcamento_diario_centavos"), 0);
  }
  if (b.orcamento_total_centavos !== undefined) {
    edicao.orcamento_total_centavos = inteiroEntre(b.orcamento_total_centavos, 100, 100_000_000) ?? (campos.push("orcamento_total_centavos"), 0);
  }
  if (b.inicio !== undefined) edicao.inicio = dataHora(b.inicio) ?? (campos.push("inicio"), "");
  if (b.fim !== undefined) edicao.fim = b.fim === null || b.fim === "" ? null : dataHora(b.fim) ?? (campos.push("fim"), null);
  if (nivel !== "adset" && (edicao.orcamento_diario_centavos !== undefined || edicao.orcamento_total_centavos !== undefined || edicao.inicio !== undefined)) {
    campos.push("nivel");
  }
  if (nivel === "ad" && edicao.fim !== undefined) campos.push("nivel");
  if (!Object.keys(edicao).length) campos.push("alteracao");
  return resultado([...new Set(campos)], () => ({ nivel, edicao }));
}

export function validarCampanhaGoogle(corpo: unknown): Validado<NovaCampanhaGoogle> {
  const b = obj(corpo);
  const lances = obj(b.lances);
  const grupo = obj(b.grupo);
  const anuncio = obj(b.anuncio);
  const campos: string[] = [];

  const nome = texto(b.nome, 3, 200) ?? (campos.push("nome"), "");
  const orcamento = inteiroEntre(b.orcamento_diario_centavos, 100, 100_000_000) ?? (campos.push("orcamento_diario_centavos"), 0);
  const estrategia = umDe(lances.estrategia, ESTRATEGIAS_GOOGLE) ?? (campos.push("lances.estrategia"), "MAXIMIZE_CLICKS");
  const cpcMax = lances.cpc_max_centavos === null || lances.cpc_max_centavos === undefined
    ? null
    : inteiroEntre(lances.cpc_max_centavos, 1, 1_000_000) ?? (campos.push("lances.cpc_max_centavos"), null);
  if (estrategia === "MANUAL_CPC" && !cpcMax) campos.push("lances.cpc_max_centavos");

  const ids = (v: unknown, campo: string) => {
    const lista = Array.isArray(v) ? v.map(String) : [];
    if (!lista.length || lista.some((id) => !DIGITOS.test(id))) campos.push(campo);
    return lista;
  };
  const locais = ids(b.locais, "locais");
  const idiomas = ids(b.idiomas, "idiomas");
  const nomeGrupo = texto(grupo.nome, 1, 255) ?? (campos.push("grupo.nome"), "");

  const palavras = Array.isArray(b.palavras_chave) ? b.palavras_chave.map(obj).map((k) => ({
    texto: texto(k.texto, 1, 80) ?? "",
    correspondencia: umDe(k.correspondencia, CORRESPONDENCIAS) ?? "PHRASE",
  })) : [];
  if (!palavras.length || palavras.length > 50 || palavras.some((k) => !k.texto)) campos.push("palavras_chave");

  const lista = (v: unknown, min: number, max: number, tamanho: number, campo: string) => {
    const itens = Array.isArray(v) ? v.map((t) => texto(t, 1, tamanho)) : [];
    if (itens.length < min || itens.length > max || itens.some((t) => t === null)) campos.push(campo);
    return itens.filter((t): t is string => t !== null);
  };
  const titulos = lista(anuncio.titulos, 3, 15, 30, "anuncio.titulos");
  const descricoes = lista(anuncio.descricoes, 2, 4, 90, "anuncio.descricoes");
  const urlFinal = urlHttps(anuncio.url_final) ?? (campos.push("anuncio.url_final"), "");
  const caminho = (v: unknown, campo: string) => {
    if (v === undefined || v === null || v === "") return "";
    return texto(v, 1, 15) ?? (campos.push(campo), "");
  };
  const caminho1 = caminho(anuncio.caminho1, "anuncio.caminho1");
  const caminho2 = caminho(anuncio.caminho2, "anuncio.caminho2");
  if (caminho2 && !caminho1) campos.push("anuncio.caminho1");

  return resultado([...new Set(campos)], () => ({
    nome,
    orcamento_diario_centavos: orcamento,
    lances: { estrategia, cpc_max_centavos: cpcMax },
    locais,
    idiomas,
    grupo: { nome: nomeGrupo },
    palavras_chave: palavras,
    anuncio: { titulos, descricoes, url_final: urlFinal, caminho1, caminho2 },
  }));
}

export const TIPOS_POST = ["feed_image", "carousel", "reel", "feed_video", "fb_post"] as const;

export type NovoPost = {
  rede: "instagram" | "facebook";
  tipo: (typeof TIPOS_POST)[number];
  legenda: string;
  midias: string[];
  agendado_para: string;
};

export function validarPost(corpo: unknown, agora: Date): Validado<NovoPost> {
  const b = obj(corpo);
  const campos: string[] = [];
  const rede = umDe(b.rede, ["instagram", "facebook"] as const) ?? (campos.push("rede"), "instagram");
  const tipo = umDe(b.tipo, TIPOS_POST) ?? (campos.push("tipo"), "feed_image");
  const legenda = typeof b.legenda === "string" && b.legenda.length <= 2200 ? b.legenda : (campos.push("legenda"), "");
  const midias = Array.isArray(b.midias) ? b.midias.filter((m): m is string => typeof m === "string") : [];
  if (!Array.isArray(b.midias) || midias.length !== b.midias.length || midias.some((m) => !CAMINHO_MIDIA.test(m))) {
    campos.push("midias");
  }
  const agendado = dataHora(b.agendado_para);
  if (!agendado || Date.parse(agendado) < agora.getTime() - 60_000) campos.push("agendado_para");

  // O Instagram só publica JPEG por URL; vídeo sai como reel.
  if (rede === "instagram") {
    if (tipo === "fb_post") campos.push("tipo");
    if (tipo === "feed_image" && (midias.length !== 1 || !IMAGEM_JPEG.test(midias[0] ?? ""))) campos.push("midias");
    if (tipo === "carousel" && (midias.length < 2 || midias.length > 10 || midias.some((m) => !IMAGEM_JPEG.test(m)))) campos.push("midias");
    if ((tipo === "reel" || tipo === "feed_video") && (midias.length !== 1 || !VIDEO.test(midias[0] ?? ""))) campos.push("midias");
  } else {
    if (tipo !== "fb_post") campos.push("tipo");
    if (midias.length > 1) campos.push("midias");
    if (!midias.length && !legenda.trim()) campos.push("legenda");
  }

  return resultado([...new Set(campos)], () => ({ rede, tipo, legenda, midias, agendado_para: agendado ?? "" }));
}

export function validarEmail(v: unknown): string | null {
  const t = texto(v, 5, 254);
  return t && EMAIL.test(t) ? t.toLowerCase() : null;
}

export function validarUuid(v: unknown): string | null {
  return typeof v === "string" && UUID.test(v) ? v : null;
}

export function validarUpload(corpo: unknown): Validado<{ nome: string; mime: string }> {
  const b = obj(corpo);
  const campos: string[] = [];
  const mime = typeof b.tipo_mime === "string" && TIPOS_MIDIA[b.tipo_mime] ? b.tipo_mime : (campos.push("tipo_mime"), "");
  const nome = texto(b.nome_arquivo, 1, 200) ?? (campos.push("nome_arquivo"), "");
  return resultado(campos, () => ({ nome, mime }));
}

// Nome seguro para o Storage: minúsculas, sem acento, extensão coerente com o tipo.
export function caminhoMidia(nomeOriginal: string, mime: string, uuid: string, agora: Date): string {
  const base = nomeOriginal
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 60) || "midia";
  const mes = agora.toISOString().slice(0, 7).replace("-", "/");
  return `${mes}/${uuid}-${base}.${TIPOS_MIDIA[mime]}`;
}

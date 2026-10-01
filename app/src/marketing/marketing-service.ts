import { supabase } from '../lib/supabase'

// Contrato com a Edge Function marketing-hub. O planner nunca fala com as
// plataformas nem com as tabelas: tudo passa pela função, que checa o papel.

export type Metricas = {
  gasto_centavos: number
  impressoes: number
  alcance: number | null
  cliques: number
  cliques_link: number | null
  conversoes: number
}

export type Bloco<T> =
  | { ok: true; dados: T; cache: boolean }
  | { ok: false; motivo: 'nao_configurado' | 'falha'; mensagem: string }

export type Periodo = { id: string; de: string; ate: string; dias: number; rotulo: string }

export type SerieDiaria = { dia: string } & Metricas

export type PostOrganico = {
  id: string
  rede: 'instagram' | 'facebook'
  data: string
  tipo: string
  texto: string
  link: string | null
  alcance: number | null
  visualizacoes: number | null
  interacoes: number | null
  curtidas: number | null
  comentarios: number | null
  compartilhamentos: number | null
}

export type GscLinha = { chave: string; cliques: number; impressoes: number; ctr: number; posicao: number }

export type VisaoGeral = {
  periodo: Periodo
  gerado_em: string
  blocos: {
    meta_ads: Bloco<{ total: Metricas; por_dia: SerieDiaria[] }>
    google_ads: Bloco<{ total: Metricas; por_dia: SerieDiaria[] }>
    ga4: Bloco<{
      sessoes: number
      eventos_chave: number
      por_canal: { canal: string; sessoes: number; usuarios: number; eventos_chave: number }[]
      por_dia: { dia: string; sessoes: number; eventos_chave: number }[]
      eventos: { evento: string; total: number }[]
      google_ads_segundo_ga4: { gasto_centavos: number; cliques: number; impressoes: number }
    }>
    search_console: Bloco<{
      site: string
      cliques: number
      impressoes: number
      ctr: number
      por_dia: { dia: string; cliques: number; impressoes: number }[]
      consultas: GscLinha[]
      paginas: GscLinha[]
      paginas_que_cresceram: (GscLinha & { cliques_antes: number; variacao: number })[]
      comparado_com: { de: string; ate: string }
    }>
    instagram: Bloco<{
      usuario: string | null
      seguidores: number | null
      alcance: number | null
      visualizacoes: number | null
      contas_engajadas: number | null
      interacoes: number | null
      aproximado: boolean
      posts: PostOrganico[]
    }>
    facebook: Bloco<{
      pagina: string | null
      seguidores: number | null
      visualizacoes: number | null
      interacoes: number | null
      posts: PostOrganico[]
    }>
    leads: Bloco<{
      total: number
      por_canal: Record<'meta' | 'google' | 'organico' | 'direto' | 'outros', number>
      por_dia: { dia: string; total: number }[]
    }>
  }
}

export type CampanhaResumo = {
  plataforma: 'meta' | 'google'
  id: string
  nome: string
  status: string
  status_efetivo: string | null
  objetivo: string | null
  orcamento_diario_centavos: number | null
  orcamento_total_centavos: number | null
  metricas: Metricas
}

export type ListaCampanhas = {
  periodo: Periodo
  blocos: { meta: Bloco<CampanhaResumo[]> | null; google: Bloco<CampanhaResumo[]> | null }
}

export type DetalheMeta = {
  plataforma: 'meta'
  periodo: Periodo
  campanha: { id: string; nome: string; status: string; status_efetivo: string | null; objetivo: string | null; inicio: string | null; fim: string | null }
  metricas: Metricas
  conjuntos: {
    id: string; nome: string; status: string; status_efetivo: string | null
    orcamento_diario_centavos: number | null; orcamento_total_centavos: number | null
    inicio: string | null; fim: string | null; otimizacao: string | null
  }[]
  anuncios: { id: string; nome: string; status: string; status_efetivo: string | null; conjunto_id: string | null; titulo: string | null; texto: string | null; miniatura: string | null }[]
}

export type DetalheGoogle = {
  plataforma: 'google'
  periodo: Periodo
  campanha: { id: string; nome: string; status: string; tipo: string | null; lances: string | null; orcamento_diario_centavos: number | null }
  metricas: Metricas
  locais: string[]
  idiomas: string[]
  grupos: { id: string; nome: string; status: string; cpc_centavos: number | null }[]
  palavras_chave: { grupo_id: string; texto: string; correspondencia: string; status: string }[]
  anuncios: { grupo_id: string; id: string; status: string; url_final: string | null; titulos: string[]; descricoes: string[] }[]
}

export type PostAgendado = {
  id: string
  rede: 'instagram' | 'facebook'
  tipo: 'feed_image' | 'carousel' | 'reel' | 'feed_video' | 'fb_post'
  legenda: string
  midias: string[]
  agendado_para: string
  publicado_em: string | null
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'
  id_externo: string | null
  erro: string | null
  criado_por_papel: string | null
}

export type Acao = {
  id: string
  request_id: string
  actor_user_id: string | null
  actor_role: string
  kind: string
  target: string | null
  payload: unknown
  status: 'executando' | 'ok' | 'erro'
  result: unknown
  external_ids: Record<string, string> | null
  error: string | null
  created_at: string
  finished_at: string | null
}

export type ResultadoAcao = {
  acao_id: string
  status: 'ok' | 'erro'
  resultado?: Record<string, unknown> | null
  ids_externos?: Record<string, string> | null
  erro?: string | null
  idempotente?: boolean
  convite_link?: string
}

export type Configuracao = {
  papel: string
  meta: { token: boolean; conta_anuncios: string | null; pagina: string | null; instagram: string | null }
  google: { credenciais: boolean; ads: boolean; ga4: boolean; search_console: string | null; criacao_liberada: boolean }
}

export type Agente = { id: string; email: string | null; banido: boolean; criado_em: string | null; ultimo_login: string | null }

export class ErroHub extends Error {
  readonly status: number
  readonly codigo: string
  readonly campos: string[]
  readonly acao: ResultadoAcao | null
  constructor(status: number, codigo: string, mensagem: string, campos: string[] = [], acao: ResultadoAcao | null = null) {
    super(mensagem)
    this.status = status
    this.codigo = codigo
    this.campos = campos
    this.acao = acao
  }
}

type Metodo = 'GET' | 'POST' | 'PATCH' | 'DELETE'

async function chamar<T>(metodo: Metodo, caminho: string, corpo?: unknown): Promise<T> {
  const { data, error } = await supabase.functions.invoke(`marketing-hub${caminho}`, {
    method: metodo,
    ...(corpo === undefined ? {} : { body: corpo as Record<string, unknown> }),
  })
  if (!error) return data as T
  const contexto = (error as { context?: Response }).context
  let corpoErro: Record<string, unknown> = {}
  if (contexto && typeof contexto.json === 'function') {
    corpoErro = await contexto.clone().json().catch(() => ({})) as Record<string, unknown>
  }
  const status = contexto?.status ?? 0
  // 502 de escrita: a ação foi registrada como erro e volta com o motivo da plataforma.
  if (corpoErro.acao_id) {
    const acao = corpoErro as unknown as ResultadoAcao
    throw new ErroHub(status, 'ACAO_FALHOU', acao.erro ?? 'A plataforma recusou a ação.', [], acao)
  }
  throw new ErroHub(
    status,
    String(corpoErro.error_code ?? 'FALHA'),
    String(corpoErro.mensagem ?? 'Não foi possível falar com o hub de marketing.'),
    Array.isArray(corpoErro.campos) ? corpoErro.campos.map(String) : [],
  )
}

const q = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1]))).toString()
  return s ? `?${s}` : ''
}

export const novoRequestId = () => crypto.randomUUID()

export const marketing = {
  configuracao: () => chamar<Configuracao>('GET', '/config'),
  visaoGeral: (periodo: string, fresco = false) => chamar<VisaoGeral>('GET', `/overview${q({ periodo, fresco: fresco ? '1' : undefined })}`),
  campanhas: (periodo: string) => chamar<ListaCampanhas>('GET', `/campaigns${q({ periodo })}`),
  campanhaMeta: (id: string, periodo: string) => chamar<DetalheMeta>('GET', `/campaigns/${encodeURIComponent(id)}${q({ plataforma: 'meta', periodo })}`),
  campanhaGoogle: (id: string, periodo: string) => chamar<DetalheGoogle>('GET', `/campaigns/${encodeURIComponent(id)}${q({ plataforma: 'google', periodo })}`),
  posts: (de: string, ate: string) => chamar<{ de: string; ate: string; posts: PostAgendado[] }>('GET', `/posts${q({ de, ate })}`),
  acoes: (limite = 200) => chamar<{ acoes: Acao[] }>('GET', `/actions${q({ limite: String(limite) })}`),
  locaisMeta: (busca: string) => chamar<{ locais: { key: string; nome: string; tipo: 'cidade' | 'regiao' }[] }>('GET', `/meta/locais${q({ q: busca })}`),
  locaisGoogle: (busca: string) => chamar<{ locais: { id: string; nome: string; tipo: string }[] }>('GET', `/google/locais${q({ q: busca })}`),
  agentes: () => chamar<{ agentes: Agente[] }>('GET', '/agent'),

  criarCampanhaMeta: (corpo: Record<string, unknown>) => chamar<ResultadoAcao>('POST', '/meta/campaigns', corpo),
  editarMeta: (nivel: 'campaign' | 'adset' | 'ad', id: string, corpo: Record<string, unknown>) =>
    chamar<ResultadoAcao>('PATCH', `/meta/${nivel}/${encodeURIComponent(id)}`, corpo),
  statusMeta: (nivel: 'campaign' | 'adset' | 'ad', id: string, corpo: { request_id: string; status: 'ACTIVE' | 'PAUSED' }) =>
    chamar<ResultadoAcao>('POST', `/meta/${nivel}/${encodeURIComponent(id)}/status`, corpo),
  criarCampanhaGoogle: (corpo: Record<string, unknown>) => chamar<ResultadoAcao>('POST', '/google/campaigns', corpo),
  orcamentoGoogle: (id: string, corpo: { request_id: string; orcamento_diario_centavos: number }) =>
    chamar<ResultadoAcao>('PATCH', `/google/campaigns/${encodeURIComponent(id)}`, corpo),
  statusGoogle: (id: string, corpo: { request_id: string; status: 'ENABLED' | 'PAUSED' }) =>
    chamar<ResultadoAcao>('POST', `/google/campaigns/${encodeURIComponent(id)}/status`, corpo),
  agendarPost: (corpo: Record<string, unknown>) => chamar<ResultadoAcao>('POST', '/posts', corpo),
  cancelarPost: (id: string, requestId: string) => chamar<ResultadoAcao>('DELETE', `/posts/${encodeURIComponent(id)}`, { request_id: requestId }),
  urlUpload: (nomeArquivo: string, tipoMime: string) =>
    chamar<{ caminho: string; url_upload: string; token: string }>('POST', '/media', { nome_arquivo: nomeArquivo, tipo_mime: tipoMime }),
  convidarDot: (corpo: { request_id: string; email: string }) => chamar<ResultadoAcao>('POST', '/agent/create', corpo),
  desligarDot: (corpo: { request_id: string; user_id: string }) => chamar<ResultadoAcao>('POST', '/agent/disable', corpo),
  religarDot: (corpo: { request_id: string; user_id: string }) => chamar<ResultadoAcao>('POST', '/agent/enable', corpo),
}

// Sobe o arquivo direto para o bucket privado, pela URL assinada que a função gerou.
export async function enviarMidia(arquivo: File): Promise<string> {
  const destino = await marketing.urlUpload(arquivo.name, arquivo.type)
  const { error } = await supabase.storage.from('marketing-media').uploadToSignedUrl(destino.caminho, destino.token, arquivo, {
    contentType: arquivo.type,
  })
  if (error) throw new ErroHub(0, 'UPLOAD_FALHOU', 'Não foi possível enviar o arquivo. Tente de novo.')
  return destino.caminho
}

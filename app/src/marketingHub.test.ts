import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  type AcaoRow,
  type Chamador,
  ConflitoError,
  type HubConfig,
  type MarketingStore,
  type PostRow,
  criarHandler,
} from '../../supabase/functions/marketing-hub/handler.ts'
import { limparCacheGoogle } from '../../supabase/functions/_shared/marketing/google-auth.ts'
import { PREFIXOS_TOKEN } from '../../supabase/functions/_shared/marketing/estados.ts'

const AGORA = new Date('2026-09-30T15:00:00Z')
const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const DOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const CLIENTE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'

const SESSOES: Record<string, Chamador> = {
  'admin-aal2': { userId: ADMIN, role: 'NO_ADMIN', aal: 'aal2', banido: false },
  'admin-aal1': { userId: ADMIN, role: 'NO_ADMIN', aal: 'aal1', banido: false },
  dot: { userId: DOT, role: 'MARKETING_AGENT', aal: 'aal1', banido: false },
  'dot-banido': { userId: DOT, role: 'MARKETING_AGENT', aal: 'aal1', banido: true },
  cliente: { userId: CLIENTE, role: 'CLIENT', aal: 'aal1', banido: false },
  agencia: { userId: CLIENTE, role: 'AGENCY_ADMIN', aal: 'aal1', banido: false },
}

function storeEmMemoria() {
  const acoes: AcaoRow[] = []
  const posts: PostRow[] = []
  const cache = new Map<string, unknown>()
  const banidos = new Set<string>()
  const papeis: Record<string, string> = { [DOT]: 'MARKETING_AGENT', [ADMIN]: 'NO_ADMIN' }
  const classificacoes: { lead_id: string; classe: 'real' | 'teste' | 'invalido' | 'duplicado'; motivo: string | null; classificado_por: string; papel: string }[] = []
  let n = 0
  const store: MarketingStore = {
    async cacheLer(k) { return cache.has(k) ? cache.get(k) : null },
    async cacheGravar(k, v) { cache.set(k, v) },
    async cacheLimpar(prefixo) { for (const k of [...cache.keys()]) if (k.startsWith(prefixo)) cache.delete(k) },
    async acaoIniciar(l) {
      const existente = acoes.find((a) => a.request_id === l.request_id)
      if (existente) return { existente }
      const a: AcaoRow = { id: `acao-${++n}`, status: 'executando', result: null, external_ids: null, error: null, created_at: AGORA.toISOString(), finished_at: null, ...l }
      acoes.push(a)
      return { id: a.id }
    },
    async acaoFinalizar(id, fim) { Object.assign(acoes.find((a) => a.id === id)!, { ...fim, finished_at: AGORA.toISOString() }) },
    async acoesListar(limite) { return acoes.slice(-limite).reverse() },
    async escritasOk(desde) {
      return acoes.filter((a) => a.status === 'ok' && a.created_at >= desde).map((a) => ({ kind: a.kind, payload: a.payload, created_at: a.created_at }))
    },
    async ativos() {
      return {
        clientId: 'cli-no',
        metaAds: { id: 'acc-ads', externalId: 'act_111' },
        metaPage: { id: 'acc-page', externalId: '222' },
        metaInstagram: { id: 'acc-ig', externalId: '333' },
      }
    },
    async postsListar() { return posts },
    async postInserir(l) {
      const p: PostRow = { id: `bbbbbbbb-bbbb-4bbb-8bbb-00000000000${posts.length + 1}`, published_at: null, external_post_id: null, error_message: null, publish_attempts: 0, meta_container_id: null, ...l }
      posts.push(p)
      return p
    },
    async postBuscar(id) { return posts.find((p) => p.id === id) ?? null },
    async postAtualizar(id, patch) { Object.assign(posts.find((p) => p.id === id)!, patch) },
    async postsReservarVencidos() {
      const vencidos = posts.filter((p) => p.status === 'scheduled' && p.scheduled_at <= AGORA.toISOString())
      vencidos.forEach((p) => { p.status = 'publishing' })
      return vencidos.map((p) => ({ ...p }))
    },
    async leadsOrigem() {
      return [{ classe: classificacoes.at(-1)?.classe ?? null, created_at: '2026-09-25T15:00:00Z', utm_source: 'instagram', utm_medium: 'paid', gclid: null, fbclid: null }]
    },
    async leadsListar() { return [{ id: CLIENTE, criado_em: '2026-09-25T15:00:00Z', canal: 'meta', nome: 'Fixture', email: 'fixture@example.test', classe: classificacoes.at(-1)?.classe ?? null }] },
    async leadExiste(id) { return id === CLIENTE },
    async leadClassificar(linha) { classificacoes.push(linha) },
    async cronSecretOk(s) { return s === 'segredo-do-cron' },
    async urlUpload(c) { return { signedUrl: `https://storage/upload/${c}`, token: 'tk', path: c } },
    async urlLeitura(c) { return `https://storage/sign/${c}?token=1` },
    async baixarMidia() { return new Uint8Array([65, 66, 67]) },
    async agentesListar() { return [{ id: DOT, email: 'dot@no.test', banido: banidos.has(DOT), criado_em: null, ultimo_login: null }] },
    async agentePapel(id) { return papeis[id] ?? null },
    async agenteConvidar(email) {
      if (email === 'lucca@no.test') throw new ConflitoError('Este e-mail já pertence a outra conta do sistema.')
      return { userId: DOT, link: 'https://auth/invite?token=segredo' }
    },
    async agenteBanir(id, banir) { if (banir) banidos.add(id); else banidos.delete(id) },
  }
  return { store, acoes, posts, cache, banidos, classificacoes }
}

const CONFIG_VAZIA: HubConfig = {
  metaToken: null,
  google: { clientId: null, clientSecret: null, refreshToken: null, developerToken: null, customerId: null, loginCustomerId: null, ga4PropertyId: null, gscSiteUrl: null },
  googleCriacaoLiberada: false,
  appUrl: 'https://app.notechstack.com.br',
}

function montar(config: Partial<HubConfig> = {}) {
  const mem = storeEmMemoria()
  const logs: { nivel: string; evento: string; dados?: Record<string, unknown> }[] = []
  const handler = criarHandler({
    store: mem.store,
    autenticar: async (t) => SESSOES[t] ?? null,
    config: { ...CONFIG_VAZIA, ...config },
    agora: () => AGORA,
    esperar: async () => undefined,
    uuid: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    log: (nivel, evento, dados) => { logs.push({ nivel, evento, dados }) },
  })
  const chamar = async (metodo: string, caminho: string, sessao?: string, corpo?: unknown, extra: Record<string, string> = {}) => {
    const resp = await handler(new Request(`https://x.supabase.co/functions/v1/marketing-hub${caminho}`, {
      method: metodo,
      headers: { origin: 'https://app.notechstack.com.br', ...(sessao ? { authorization: `Bearer ${sessao}` } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}), ...extra },
      body: corpo ? JSON.stringify(corpo) : undefined,
    }))
    return { status: resp.status, body: await resp.json().catch(() => null), headers: resp.headers }
  }
  return { ...mem, chamar, logs }
}

type Resposta = { status?: number; body: unknown; headers?: Record<string, string> }

function mockFetch(responder: (url: string, init?: RequestInit) => Resposta | undefined) {
  const chamadas: { url: string; method: string; body: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    let body: unknown = init?.body
    if (typeof init?.body === 'string') {
      try { body = JSON.parse(init.body) } catch { body = Object.fromEntries(new URLSearchParams(init.body)) }
    }
    chamadas.push({ url, method: init?.method ?? 'GET', body })
    const r = responder(url, init) ?? { status: 400, body: { error: { message: `sem mock ${url}` } } }
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers })
  }))
  return chamadas
}

afterEach(() => {
  vi.unstubAllGlobals()
  limparCacheGoogle()
})

describe('marketing-hub — autorização por papel (R9, AC7, AC11)', () => {
  it.each([
    [undefined, 401, 'UNAUTHENTICATED'],
    ['token-desconhecido', 401, 'UNAUTHENTICATED'],
    ['admin-aal1', 403, 'MFA_REQUIRED'],
    ['cliente', 403, 'FORBIDDEN'],
    ['agencia', 403, 'FORBIDDEN'],
    ['dot-banido', 401, 'UNAUTHENTICATED'],
  ])('sessão %s recebe %i', async (sessao, status, codigo) => {
    const { chamar } = montar()
    const r = await chamar('GET', '/overview?periodo=7d', sessao)
    expect(r.status).toBe(status)
    expect(r.body.error_code).toBe(codigo)
  })

  it.each(['admin-aal2', 'dot'])('%s lê a visão geral; bloco sem credencial aparece como não configurado', async (sessao) => {
    const { chamar } = montar()
    const r = await chamar('GET', '/overview?periodo=7d', sessao)
    expect(r.status).toBe(200)
    expect(r.body.periodo).toMatchObject({ de: '2026-09-23', ate: '2026-09-29' })
    expect(r.body.blocos.meta_ads).toMatchObject({ ok: false, motivo: 'nao_configurado' })
    expect(r.body.blocos.leads).toMatchObject({ ok: true, dados: { total: 1, por_canal: { meta: 1 } } })
    expect(JSON.stringify(r.body.blocos.leads)).not.toMatch(/nome|email|whatsapp/i)
  })

  it('o dot não mexe na própria conta: /agent é só do NO_ADMIN com aal2', async () => {
    const { chamar, banidos } = montar()
    expect((await chamar('GET', '/agent', 'dot')).status).toBe(403)
    expect((await chamar('POST', '/agent/disable', 'dot', { request_id: 'req-00000001', user_id: DOT })).status).toBe(403)
    expect((await chamar('POST', '/agent/disable', 'admin-aal1', { request_id: 'req-00000002', user_id: DOT })).status).toBe(403)
    const ok = await chamar('POST', '/agent/disable', 'admin-aal2', { request_id: 'req-00000003', user_id: DOT })
    expect(ok.status).toBe(200)
    expect(banidos.has(DOT)).toBe(true)
  })

  it('desligar nunca bane uma conta que não é do dot', async () => {
    const { chamar, banidos, acoes } = montar()
    const r = await chamar('POST', '/agent/disable', 'admin-aal2', { request_id: 'req-00000004', user_id: ADMIN })
    expect(r.status).toBe(409)
    expect(r.body.error_code).toBe('NAO_E_DOT')
    expect(banidos.size).toBe(0)
    expect(acoes[0]).toMatchObject({ kind: 'dot.desligar', status: 'erro' })
  })

  it('convite do dot devolve o link só na resposta, nunca no registro', async () => {
    const { chamar, acoes } = montar()
    const r = await chamar('POST', '/agent/create', 'admin-aal2', { request_id: 'req-00000005', email: 'Dot@No.test' })
    expect(r.status).toBe(200)
    expect(r.body.convite_link).toBe('https://auth/invite?token=segredo')
    expect(JSON.stringify(acoes)).not.toContain('segredo')
    expect(acoes[0]).toMatchObject({ kind: 'dot.criar', payload: { email: 'dot@no.test' }, status: 'ok' })
    const conflito = await chamar('POST', '/agent/create', 'admin-aal2', { request_id: 'req-00000006', email: 'lucca@no.test' })
    expect(conflito.status).toBe(409)
  })

  it('preflight libera PATCH e DELETE só para as origens da nó', async () => {
    const { chamar } = montar()
    const r = await chamar('OPTIONS', '/posts/x')
    expect(r.status).toBe(204)
    expect(r.headers.get('Access-Control-Allow-Methods')).toContain('DELETE')
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('https://app.notechstack.com.br')
  })

  it('período inválido é 422', async () => {
    const { chamar } = montar()
    expect((await chamar('GET', '/overview?periodo=2026-09-10..2026-09-01', 'dot')).status).toBe(422)
  })
  it('T2-17: resposta HTTP preserva exatamente 22 a 23 de setembro de 2026', async () => {
    const { chamar } = montar()
    const response = await chamar('GET', '/overview?periodo=2026-09-22..2026-09-23', 'dot')
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ periodo: { de: '2026-09-22', ate: '2026-09-23', dias: 2 } })
  })
  it.each(['2026-99-01..2026-09-23', '2026-09-22..2026-13-01', '2026-02-30..2026-03-01', '2026-09-00..2026-09-23'])('T2-19: data impossível %s responde 422 em vez de 500', async periodo => {
    const { chamar } = montar()
    const response = await chamar('GET', `/overview?periodo=${periodo}`, 'dot')
    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ error_code: 'PERIODO_INVALIDO' })
  })
})

const postIg = (extra: Record<string, unknown> = {}) => ({
  request_id: 'req-post-0001', rede: 'instagram', tipo: 'feed_image', legenda: 'Olá',
  midias: ['2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.jpg'], agendado_para: '2026-09-30T15:30:00Z', ...extra,
})

describe('marketing-hub — escrita com registro (R5, R6, AC8)', () => {
  it('o mesmo request_id não agenda duas vezes (duplo clique do dot)', async () => {
    const { chamar, posts, acoes } = montar()
    const a = await chamar('POST', '/posts', 'dot', postIg())
    const b = await chamar('POST', '/posts', 'dot', postIg())
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    expect(b.body.idempotente).toBe(true)
    expect(posts).toHaveLength(1)
    expect(posts[0]).toMatchObject({ account_id: 'acc-ig', status: 'scheduled', created_by: DOT, created_by_role: 'MARKETING_AGENT' })
    expect(acoes).toHaveLength(1)
    expect(acoes[0]).toMatchObject({ actor_user_id: DOT, actor_role: 'MARKETING_AGENT', kind: 'post.agendar', status: 'ok' })
  })

  it('sem request_id não escreve', async () => {
    const { chamar, posts } = montar()
    const r = await chamar('POST', '/posts', 'dot', { ...postIg(), request_id: undefined })
    expect(r.status).toBe(422)
    expect(posts).toHaveLength(0)
  })

  it('cancela post agendado; post publicado não cancela', async () => {
    const { chamar, posts } = montar()
    await chamar('POST', '/posts', 'admin-aal2', postIg())
    const id = posts[0].id
    const ok = await chamar('DELETE', `/posts/${id}`, 'admin-aal2', { request_id: 'req-cancel-01' })
    expect(ok.status).toBe(200)
    expect(posts[0].status).toBe('cancelled')
    posts[0].status = 'published'
    const tarde = await chamar('DELETE', `/posts/${id}`, 'admin-aal2', { request_id: 'req-cancel-02' })
    expect(tarde.status).toBe(409)
  })

  it('campanha Meta criada pelo dot: registro executando → ok com ids e papel', async () => {
    const chamadas = mockFetch((url) => {
      if (url.includes('/act_111/campaigns')) return { body: { id: 'c1' } }
      if (url.includes('/act_111/adsets')) return { body: { id: 's1' } }
      if (url.includes('/act_111/adimages')) return { body: { images: { bytes: { hash: 'h1' } } } }
      if (url.includes('/act_111/adcreatives')) return { body: { id: 'cr1' } }
      if (url.includes('/act_111/ads')) return { body: { id: 'a1' } }
      return undefined
    })
    const { chamar, acoes } = montar({ metaToken: 'tok-meta' })
    const r = await chamar('POST', '/meta/campaigns', 'dot', {
      request_id: 'req-meta-0001', nome: '[teste hub] leads', objetivo: 'OUTCOME_LEADS', orcamento: { tipo: 'diario', centavos: 2000 },
      inicio: '2026-10-01T12:00:00Z', publico: { paises: ['BR'], idade_min: 25, idade_max: 55, genero: 'todos' },
      criativo: { tipo: 'imagem', midia: '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-arte.jpg', texto: 'T', titulo: 'T', link: 'https://www.notechstack.com.br/', cta: 'LEARN_MORE' },
    })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ status: 'ok', ids_externos: { campaign_id: 'c1', ad_id: 'a1' }, resultado: { status_campanha: 'PAUSED' } })
    expect((chamadas[2].body as { bytes: string }).bytes).toBe('QUJD') // bytes do Storage em base64
    expect(acoes[0]).toMatchObject({ actor_role: 'MARKETING_AGENT', kind: 'meta.campanha.criar', status: 'ok', external_ids: { campaign_id: 'c1' } })
  })

  it('erro da plataforma fica registrado com a mensagem e os ids parciais', async () => {
    mockFetch((url) => {
      if (url.includes('/campaigns')) return { body: { id: 'c9' } }
      if (url.includes('/adsets')) return { status: 400, body: { error: { message: 'Invalid targeting', code: 100 } } }
      return undefined
    })
    const { chamar, acoes } = montar({ metaToken: 'tok-meta' })
    const r = await chamar('POST', '/meta/campaigns', 'admin-aal2', {
      request_id: 'req-meta-0002', nome: '[teste hub] x', objetivo: 'OUTCOME_TRAFFIC', orcamento: { tipo: 'diario', centavos: 2000 },
      inicio: '2026-10-01T12:00:00Z', publico: { paises: ['BR'], idade_min: 18, idade_max: 65, genero: 'todos' },
      criativo: { tipo: 'imagem', midia: '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-arte.jpg', texto: 'T', titulo: 'T', link: 'https://x.com.br/', cta: 'LEARN_MORE' },
    })
    expect(r.status).toBe(502)
    expect(acoes[0]).toMatchObject({ status: 'erro', error: 'Meta 100: Invalid targeting', external_ids: { campaign_id: 'c9' }, actor_role: 'NO_ADMIN' })
  })

  it('ativar campanha Meta é uma ação separada e registrada', async () => {
    const chamadas = mockFetch((url) => (url.includes('/v25.0/123456') ? { body: { success: true } } : undefined))
    const { chamar, acoes } = montar({ metaToken: 'tok-meta' })
    const r = await chamar('POST', '/meta/campaign/123456/status', 'dot', { request_id: 'req-ativar-01', status: 'ACTIVE' })
    expect(r.status).toBe(200)
    expect(chamadas[0].body).toEqual({ status: 'ACTIVE' })
    expect(acoes[0]).toMatchObject({ kind: 'meta.campaign.status', target: '123456', payload: { status: 'ACTIVE' }, actor_role: 'MARKETING_AGENT' })
  })

  it('criação Google fica atrás da flag até a prova V6', async () => {
    const { chamar } = montar()
    const r = await chamar('POST', '/google/campaigns', 'admin-aal2', { request_id: 'req-google-01' })
    expect(r.status).toBe(503)
    expect(r.body.error_code).toBe('GOOGLE_CRIACAO_BLOQUEADA')
  })

  it('upload de mídia devolve URL assinada num caminho seguro', async () => {
    const { chamar } = montar()
    const r = await chamar('POST', '/media', 'dot', { nome_arquivo: 'Arte Final.JPG', tipo_mime: 'image/jpeg' })
    expect(r.status).toBe(200)
    expect(r.body.caminho).toBe('2026/09/cccccccc-cccc-4ccc-8ccc-cccccccccccc-arte-final.jpg')
    expect((await chamar('POST', '/media', 'dot', { nome_arquivo: 'x.exe', tipo_mime: 'application/x-msdownload' })).status).toBe(422)
  })
})

describe('marketing-hub — leitura com cache', () => {
  it('segunda leitura do mesmo bloco não chama a plataforma; fresco=1 chama', async () => {
    const chamadas = mockFetch((url) => (url.includes('/insights') ? { body: { data: [] } } : undefined))
    const { chamar } = montar({ metaToken: 'tok-meta' })
    await chamar('GET', '/overview?periodo=7d', 'dot')
    const depoisDaPrimeira = chamadas.filter((c) => c.url.includes('/act_111/insights')).length
    expect(depoisDaPrimeira).toBe(2)
    await chamar('GET', '/overview?periodo=7d', 'dot')
    expect(chamadas.filter((c) => c.url.includes('/act_111/insights')).length).toBe(2)
    await chamar('GET', '/overview?periodo=7d&fresco=1', 'dot')
    expect(chamadas.filter((c) => c.url.includes('/act_111/insights')).length).toBe(4)
  })
})

describe('marketing-hub — publicador do pg_cron (R4)', () => {
  it('sem o segredo do cron não publica nada', async () => {
    const { chamar } = montar({ metaToken: 'tok-meta' })
    expect((await chamar('POST', '/internal/publish-due', undefined, {})).status).toBe(401)
    expect((await chamar('POST', '/internal/publish-due', undefined, {}, { 'x-cron-secret': 'errado' })).status).toBe(401)
    expect((await chamar('POST', '/internal/publish-due', 'admin-aal2', {})).status).toBe(401)
  })

  it('publica o vencido, grava external_post_id e registra como SISTEMA', async () => {
    mockFetch((url, init) => {
      if (url.includes('/333/media_publish')) return { body: { id: 'ig-99' } }
      if (url.includes('/333/media') && init?.method === 'POST') return { body: { id: 'cont-1' } }
      if (url.includes('/cont-1')) return { body: { status_code: 'FINISHED' } }
      return undefined
    })
    const { chamar, posts, acoes } = montar({ metaToken: 'tok-meta' })
    await chamar('POST', '/posts', 'dot', postIg({ agendado_para: '2026-09-30T14:59:30Z' }))
    const r = await chamar('POST', '/internal/publish-due', undefined, {}, { 'x-cron-secret': 'segredo-do-cron' })
    expect(r.body).toEqual({ processados: 1, publicados: 1, falhas: 0, em_processamento: 0 })
    expect(posts[0]).toMatchObject({ status: 'published', external_post_id: 'ig-99', published_at: AGORA.toISOString() })
    expect(acoes.at(-1)).toMatchObject({ actor_role: 'SISTEMA', kind: 'post.publicar', status: 'ok', actor_user_id: DOT })
  })

  it('falha volta para a fila e, na terceira, vira failed', async () => {
    mockFetch(() => ({ status: 400, body: { error: { message: 'Only photo or video can be accepted as media type.', code: 9004 } } }))
    const { chamar, posts } = montar({ metaToken: 'tok-meta' })
    await chamar('POST', '/posts', 'dot', postIg({ agendado_para: '2026-09-30T14:59:30Z' }))
    const cron = () => chamar('POST', '/internal/publish-due', undefined, {}, { 'x-cron-secret': 'segredo-do-cron' })
    await cron()
    expect(posts[0]).toMatchObject({ status: 'scheduled', publish_attempts: 1 })
    await cron()
    await cron()
    expect(posts[0]).toMatchObject({ status: 'failed', publish_attempts: 3 })
    expect(posts[0].error_message).toContain('9004')
  })

  it('reel em processamento guarda o container e não gasta tentativa', async () => {
    mockFetch((url, init) => {
      if (url.includes('/333/media') && init?.method === 'POST') return { body: { id: 'cont-r' } }
      if (url.includes('/cont-r')) return { body: { status_code: 'IN_PROGRESS' } }
      return undefined
    })
    const { chamar, posts } = montar({ metaToken: 'tok-meta' })
    await chamar('POST', '/posts', 'dot', postIg({ tipo: 'reel', midias: ['2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-v.mp4'], agendado_para: '2026-09-30T14:59:30Z' }))
    const r = await chamar('POST', '/internal/publish-due', undefined, {}, { 'x-cron-secret': 'segredo-do-cron' })
    expect(r.body.em_processamento).toBe(1)
    expect(posts[0]).toMatchObject({ status: 'scheduled', meta_container_id: 'cont-r', publish_attempts: 0 })
  })

  it('post cancelado não sai', async () => {
    const chamadas = mockFetch(() => undefined)
    const { chamar, posts } = montar({ metaToken: 'tok-meta' })
    await chamar('POST', '/posts', 'dot', postIg({ agendado_para: '2026-09-30T14:59:30Z' }))
    await chamar('DELETE', `/posts/${posts[0].id}`, 'dot', { request_id: 'req-cancel-03' })
    const r = await chamar('POST', '/internal/publish-due', undefined, {}, { 'x-cron-secret': 'segredo-do-cron' })
    expect(r.body.processados).toBe(0)
    expect(chamadas).toHaveLength(0)
  })
})

// ------------------------------------------------ T2: estados, LPV e conexões

// Prefixos reais de token nos valores de teste: nada disso pode sair numa resposta.
const [P_ACESSO, P_REFRESH, P_SEGREDO, P_META] = PREFIXOS_TOKEN
const TOKENS = {
  meta: `${P_META}tokenmeta123`,
  pagina: `${P_META}tokenpagina456`,
  acesso: `${P_ACESSO}tokenacesso`,
  refresh: `${P_REFRESH}tokenrefresh`,
  segredo: `${P_SEGREDO}segredo`,
}
const semPrefixo = (texto: string) => PREFIXOS_TOKEN.every((prefixo) => !texto.includes(prefixo))
const GOOGLE_CHEIO: HubConfig['google'] = {
  clientId: 'client-no-hub', clientSecret: TOKENS.segredo, refreshToken: TOKENS.refresh, developerToken: 'dev-token',
  customerId: '930-207-4409', loginCustomerId: '111-222-3333', ga4PropertyId: '123456', gscSiteUrl: 'sc-domain:notechstack.com.br',
}
const RECUSA_10 = { error: { message: "(#10) This endpoint requires the 'pages_read_user_content' permission or the 'Page Public Content Access' feature", type: 'OAuthException', code: 10 } }

type Plataforma = (u: URL, init?: RequestInit) => Resposta | undefined

// Respostas no formato documentado de cada API; `trocar` sobrepõe uma rota.
function plataformas(trocar: Plataforma = () => undefined) {
  return mockFetch((url, init) => {
    const u = new URL(url)
    const sobre = trocar(u, init)
    if (sobre) return sobre
    const caminho = u.pathname
    const campos = u.searchParams.get('fields') ?? ''
    if (caminho.endsWith('/act_111/insights')) {
      const linha = { spend: '172.64', impressions: '20000', reach: '9000', clicks: '1500', inline_link_clicks: '1499', actions: [{ action_type: 'landing_page_view', value: '612' }] }
      return { body: { data: u.searchParams.get('time_increment') ? [{ ...linha, date_start: '2026-09-23' }] : [linha] } }
    }
    if (caminho.endsWith('/act_111')) return { body: { id: 'act_111', currency: 'BRL', timezone_name: 'America/Sao_Paulo' }, headers: { 'facebook-api-version': 'v25.0' } }
    if (caminho.endsWith('/333/insights')) return { body: { data: [{ name: 'reach', total_value: { value: 50 } }, { name: 'views', total_value: { value: 80 } }, { name: 'accounts_engaged', total_value: { value: 7 } }, { name: 'total_interactions', total_value: { value: 9 } }] } }
    if (caminho.endsWith('/333/media')) return { body: { data: [] } }
    if (caminho.endsWith('/333')) return { body: { followers_count: 300, username: 'notechstack' } }
    if (caminho.endsWith('/222') && campos === 'access_token') return { body: { access_token: TOKENS.pagina } }
    if (caminho.endsWith('/222')) return { body: { followers_count: 40, name: 'nó' } }
    if (caminho.endsWith('/222/insights')) return { body: { data: [{ name: 'page_media_view', values: [{ value: 10 }] }, { name: 'page_post_engagements', values: [{ value: 4 }] }] } }
    if (caminho.endsWith('/222/posts')) return { body: { data: [{ id: '222_1', message: 'Post', created_time: '2026-09-20T12:00:00+0000', shares: { count: 1 }, reactions: { summary: { total_count: 5 } }, comments: { summary: { total_count: 3 } } }] } }
    if (caminho.endsWith('/me/permissions')) return { body: { data: [{ permission: 'ads_read', status: 'granted' }, { permission: 'pages_read_user_content', status: 'declined' }] } }
    if (url === 'https://oauth2.googleapis.com/token') return { body: { access_token: TOKENS.acesso, expires_in: 3600 } }
    if (url.startsWith('https://oauth2.googleapis.com/tokeninfo')) return { body: { scope: 'https://www.googleapis.com/auth/adwords https://www.googleapis.com/auth/analytics.readonly', expires_in: 3500 } }
    if (caminho.endsWith(':batchRunReports')) return { body: { reports: [{ rows: [] }, { rows: [] }, { rows: [] }, { rows: [] }] } }
    if (caminho.endsWith(':runReport')) return { body: { rows: [] } }
    if (caminho.endsWith('/searchAnalytics/query')) return { body: { rows: [] } }
    if (caminho.includes('/webmasters/v3/sites/')) return { body: { siteUrl: 'sc-domain:notechstack.com.br', permissionLevel: 'siteOwner' } }
    if (caminho.endsWith('googleAds:search')) return { body: { results: [] } }
    return undefined
  })
}

describe('marketing-hub — Facebook de 30 dias com recusa de permissão (T1-4/5)', () => {
  it('Facebook 30d com #10: bloco ok, comentários sem_permissao, variante no log sem token, outros blocos inteiros', async () => {
    plataformas((u) => (u.pathname.endsWith('/222/posts') && (u.searchParams.get('fields') ?? '').includes('comments') ? { status: 400, body: RECUSA_10 } : undefined))
    const { chamar, logs } = montar({ metaToken: TOKENS.meta })
    const r = await chamar('GET', '/overview?periodo=30d&fresco=1', 'admin-aal2')
    expect(r.status).toBe(200)
    const { facebook, meta_ads, instagram, leads } = r.body.blocos
    expect(facebook).toMatchObject({ ok: true, dados: { seguidores: 40, visualizacoes: 10 } })
    expect(facebook.dados.posts[0]).toMatchObject({ curtidas: 5, comentarios: null })
    expect(facebook.estados).toMatchObject({ 'posts.comentarios': 'sem_permissao', bloco: 'parcial' })
    expect(meta_ads).toMatchObject({ ok: true, dados: { total: { gasto_centavos: 17264 } } })
    expect(instagram).toMatchObject({ ok: true, dados: { seguidores: 300 } })
    expect(leads).toMatchObject({ ok: true, dados: { total: 1 } })
    const recusas = logs.filter((l) => l.evento === 'marketing_subconsulta_falhou' && l.dados?.chave === 'facebook')
    expect(recusas.map((l) => l.dados?.variante)).toEqual(['completa', 'sem_comentarios'])
    expect(String(recusas[0].dados?.mensagem)).toContain('pages_read_user_content')
    expect(semPrefixo(JSON.stringify(logs))).toBe(true)
  })

  it('motivo sem_permissao: Graph 200 no token da Página e Google 403 no GA4', async () => {
    plataformas((u) => {
      if (u.pathname.endsWith('/222') && u.searchParams.get('fields') === 'access_token') return { status: 400, body: { error: { message: 'Permissions error', code: 200 } } }
      if (u.pathname.endsWith(':batchRunReports')) return { status: 403, body: { error: { code: 403, message: 'User does not have sufficient permissions for this property.', status: 'PERMISSION_DENIED' } } }
      return undefined
    })
    const { chamar } = montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO })
    const r = await chamar('GET', '/overview?periodo=7d', 'dot')
    expect(r.body.blocos.facebook).toMatchObject({ ok: false, motivo: 'sem_permissao' })
    expect(r.body.blocos.ga4).toMatchObject({ ok: false, motivo: 'sem_permissao' })
    expect(r.body.blocos.meta_ads.ok).toBe(true)
  })
})

describe('marketing-hub — estados das métricas e LPV (T2-4, 6, 9, 14)', () => {
  it('meta_ads traz lpv e a conta lida da Graph; métrica disponível não entra em estados', async () => {
    plataformas()
    const { chamar } = montar({ metaToken: TOKENS.meta })
    const r = await chamar('GET', '/overview?periodo=7d', 'dot')
    const meta = r.body.blocos.meta_ads
    expect(meta.dados.total).toMatchObject({ lpv: 612, cliques: 1500, cliques_link: 1499 })
    expect(meta.dados.conta).toEqual({ id: 'act_111', moeda: 'BRL', fuso: 'America/Sao_Paulo', versao_api: 'v25.0' })
    // `conversoes` veio 0 (nenhuma ação de lead): estado zero; o resto está disponível.
    expect(meta.estados).toEqual({ conversoes: 'zero' })
  })

  it('LPV ausente no período: total null e estado indisponivel, nunca 0', async () => {
    plataformas((u) => (u.pathname.endsWith('/act_111/insights') ? { body: { data: [{ spend: '10.00', impressions: '100', reach: '90', clicks: '5', inline_link_clicks: '4', actions: [{ action_type: 'lead', value: '1' }] }] } } : undefined))
    const { chamar } = montar({ metaToken: TOKENS.meta })
    const r = await chamar('GET', '/overview?periodo=7d', 'dot')
    expect(r.body.blocos.meta_ads.dados.total.lpv).toBeNull()
    expect(r.body.blocos.meta_ads.estados).toEqual({ lpv: 'indisponivel' })
  })

  it('estados só do que não está disponível: leads 1 sem estado; Google sem alcance diz indisponivel', async () => {
    plataformas()
    const { chamar } = montar({ google: GOOGLE_CHEIO })
    const r = await chamar('GET', '/overview?periodo=7d', 'dot')
    expect(r.body.blocos.leads).toMatchObject({ ok: true, estados: {} })
    expect(r.body.blocos.google_ads.estados).toMatchObject({ alcance: 'indisponivel', cliques_link: 'indisponivel', lpv: 'indisponivel', gasto_centavos: 'zero' })
  })

  it('Instagram parcial: janela de insights que falha vira erro com motivo, não null silencioso', async () => {
    plataformas((u) => (u.pathname.endsWith('/333/insights') ? { status: 400, body: { error: { message: 'Invalid metric', code: 100 } } } : undefined))
    const { chamar, logs } = montar({ metaToken: TOKENS.meta })
    const r = await chamar('GET', '/overview?periodo=7d', 'dot')
    const ig = r.body.blocos.instagram
    expect(ig).toMatchObject({ ok: true, dados: { alcance: null, seguidores: 300 } })
    expect(ig.estados).toMatchObject({ alcance: 'erro', visualizacoes: 'erro', contas_engajadas: 'erro', interacoes: 'erro', bloco: 'parcial' })
    expect(logs.some((l) => l.evento === 'marketing_subconsulta_falhou' && l.dados?.chave === 'instagram')).toBe(true)
  })

  it('atrasado: período com hoje marca as métricas; Search Console até hoje − 3, e a Meta não', async () => {
    plataformas()
    const { chamar } = montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO })
    const comHoje = await chamar('GET', '/overview?periodo=2026-09-28..2026-09-30', 'dot')
    expect(comHoje.body.blocos.meta_ads.estados).toMatchObject({ gasto_centavos: 'atrasado', lpv: 'atrasado', bloco: 'atrasado' })
    expect(comHoje.body.blocos.leads.estados).toMatchObject({ bloco: 'atrasado' })

    const gscRecente = await chamar('GET', '/overview?periodo=2026-09-21..2026-09-27', 'dot')
    expect(gscRecente.body.blocos.search_console.estados).toMatchObject({ cliques: 'atrasado', bloco: 'atrasado' })
    expect(gscRecente.body.blocos.meta_ads.estados).not.toHaveProperty('bloco')

    const gscFechado = await chamar('GET', '/overview?periodo=2026-09-20..2026-09-26', 'dot')
    expect(gscFechado.body.blocos.search_console.estados).not.toHaveProperty('bloco')
  })

  it('cache antigo (sem estados) é ignorado; o novo guarda estados', async () => {
    const { chamar, cache } = montar()
    cache.set('leads:2026-09-23:2026-09-29', { total: 99, por_canal: {}, por_dia: [] })
    const r = await chamar('GET', '/overview?periodo=7d', 'dot')
    expect(r.body.blocos.leads).toMatchObject({ ok: true, cache: false, dados: { total: 1 }, estados: {} })
    const de = await chamar('GET', '/overview?periodo=7d', 'dot')
    expect(de.body.blocos.leads).toMatchObject({ ok: true, cache: true, dados: { total: 1 }, estados: {} })
  })
})

const IDS_CAPACIDADES = [
  'meta_ads_leitura', 'meta_ig_insights', 'meta_fb_insights', 'meta_ig_publicacao', 'meta_fb_publicacao', 'meta_ads_escrita',
  'google_oauth', 'google_ga4', 'google_search_console', 'google_ads_leitura', 'google_ads_criacao',
]
const capacidade = (body: { capacidades: { id: string }[] }, id: string) => body.capacidades.find((c) => c.id === id) as Record<string, string>

describe('marketing-hub — GET /connections (T2-10 a 13)', () => {
  it('connections lista as 11 capacidades, testando cada leitura só com chamadas de leitura', async () => {
    const chamadas = plataformas()
    const { chamar } = montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO, googleCriacaoLiberada: true })
    const r = await chamar('GET', '/connections', 'admin-aal2')
    expect(r.status).toBe(200)
    expect(r.body.capacidades.map((c: { id: string }) => c.id)).toEqual(IDS_CAPACIDADES)
    for (const c of r.body.capacidades) expect(Object.keys(c).sort()).toEqual(['correcao', 'detalhe', 'estado', 'id', 'plataforma', 'rotulo'])
    for (const id of ['meta_ads_leitura', 'meta_ig_insights', 'meta_fb_insights', 'google_oauth', 'google_ga4', 'google_search_console', 'google_ads_leitura']) {
      expect(capacidade(r.body, id).estado).toBe('ok')
    }
    // Nada é criado: nenhum POST à Meta; no Google, só token, runReport e googleAds:search (leituras).
    const posts = chamadas.filter((c) => c.method === 'POST').map((c) => new URL(c.url))
    expect(posts.some((u) => u.host === 'graph.facebook.com')).toBe(false)
    for (const u of posts) expect(['/token', '/v1beta/properties/123456:runReport', '/v25/customers/9302074409/googleAds:search']).toContain(u.pathname)
    expect(chamadas.some((c) => c.url.includes('/act_111/insights'))).toBe(true)
    expect(chamadas.some((c) => c.url.includes('/333/insights'))).toBe(true)
    expect(chamadas.some((c) => c.url.includes('/222/insights'))).toBe(true)
    expect(chamadas.some((c) => c.url.includes('/webmasters/v3/sites/sc-domain%3Anotechstack.com.br'))).toBe(true)
  })

  it('escrita só é ok com prova em marketing_actions nos últimos 30 dias', async () => {
    plataformas()
    const { chamar, acoes } = montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO, googleCriacaoLiberada: true })
    const dias = (n: number) => new Date(AGORA.getTime() - n * 86_400_000).toISOString()
    const linha = (kind: string, status: AcaoRow['status'], criado: string, payload: unknown = {}): AcaoRow => ({
      id: `a-${acoes.length}`, request_id: `r-${acoes.length}`, actor_user_id: DOT, actor_role: 'SISTEMA', kind, target: null, payload,
      status, result: null, external_ids: null, error: null, created_at: criado, finished_at: criado,
    })
    acoes.push(
      linha('post.publicar', 'ok', dias(5), { tipo: 'feed_image' }),
      linha('post.publicar', 'erro', dias(2), { tipo: 'fb_post' }),
      linha('post.agendar', 'ok', dias(1), { rede: 'facebook', tipo: 'fb_post' }),
      linha('meta.campanha.criar', 'ok', dias(31)),
      linha('google.campanha.criar', 'ok', dias(1)),
    )
    const r = await chamar('GET', '/connections', 'dot')
    expect(capacidade(r.body, 'meta_ig_publicacao').estado).toBe('ok')
    expect(capacidade(r.body, 'google_ads_criacao').estado).toBe('ok')
    for (const id of ['meta_fb_publicacao', 'meta_ads_escrita']) {
      expect(capacidade(r.body, id).estado).toBe('nao_verificado')
      expect(capacidade(r.body, id).detalhe).toContain('leitura funcionar não prova publicação')
      expect(capacidade(r.body, id).correcao).toBeTruthy()
    }
  })

  it('escopos e permissões: tokeninfo e /me/permissions; null quando a plataforma não informa', async () => {
    const chamadas = plataformas()
    const { chamar } = montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO })
    const r = await chamar('GET', '/connections', 'admin-aal2')
    expect(r.body.google_escopos).toEqual(['https://www.googleapis.com/auth/adwords', 'https://www.googleapis.com/auth/analytics.readonly'])
    expect(r.body.meta_permissoes).toEqual([{ permissao: 'ads_read', status: 'granted' }, { permissao: 'pages_read_user_content', status: 'declined' }])
    expect(chamadas.some((c) => c.url.startsWith('https://oauth2.googleapis.com/tokeninfo?access_token='))).toBe(true)

    plataformas((u) => (u.pathname.endsWith('/me/permissions') || u.pathname === '/tokeninfo' ? { status: 400, body: { error: { message: 'nope', code: 100 } } } : undefined))
    const semInfo = await montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO }).chamar('GET', '/connections?fresco=1', 'admin-aal2')
    expect(semInfo.body.google_escopos).toBeNull()
    expect(semInfo.body.meta_permissoes).toBeNull()
  })

  it.each([
    ['admin-aal2', 200],
    ['dot', 200],
    ['admin-aal1', 403],
    ['cliente', 403],
    ['agencia', 403],
    [undefined, 401],
  ])('connections por papel: %s recebe %i', async (sessao, status) => {
    plataformas()
    const { chamar } = montar()
    expect((await chamar('GET', '/connections', sessao)).status).toBe(status)
  })

  it('connections não vaza token, nem quando a plataforma ecoa um na mensagem de erro', async () => {
    plataformas((u) => {
      if (u.pathname.endsWith('/act_111/insights')) return { status: 400, body: { error: { message: `Invalid token ${TOKENS.meta}`, code: 190 } } }
      if (u.pathname.includes('/webmasters/v3/sites/')) return { status: 400, body: { error: { code: 400, message: `bad credential ${TOKENS.acesso}` } } }
      return undefined
    })
    const { chamar } = montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO })
    const r = await chamar('GET', '/connections?fresco=1', 'admin-aal2')
    expect(r.status).toBe(200)
    const texto = JSON.stringify(r.body)
    expect(texto).toContain('[removido]')
    for (const prefixo of PREFIXOS_TOKEN) expect(texto.split(prefixo)).toHaveLength(1)
    expect(capacidade(r.body, 'meta_ads_leitura').estado).toBe('erro')
    expect(capacidade(r.body, 'google_search_console').estado).toBe('erro')
  })

  it('connections diagnostica: permissão negada, falta de config e unauthorized_client', async () => {
    plataformas((u) => {
      if (u.pathname.endsWith('/act_111/insights')) return { status: 400, body: { error: { message: 'Permissions error', code: 200 } } }
      if (u.pathname.endsWith('/333/insights')) return { status: 400, body: { error: { message: '(#10) Application does not have permission for this action', code: 10 } } }
      if (u.pathname === '/token') return { status: 401, body: { error: 'unauthorized_client', error_description: 'Unauthorized' } }
      return undefined
    })
    const { chamar } = montar({ metaToken: TOKENS.meta, google: { ...GOOGLE_CHEIO, ga4PropertyId: null } })
    const r = await chamar('GET', '/connections', 'admin-aal2')
    expect(capacidade(r.body, 'meta_ads_leitura')).toMatchObject({ estado: 'sem_permissao' })
    expect(capacidade(r.body, 'meta_ig_insights')).toMatchObject({ estado: 'sem_permissao' })
    expect(capacidade(r.body, 'meta_fb_insights')).toMatchObject({ estado: 'ok' })
    const oauth = capacidade(r.body, 'google_oauth')
    expect(oauth.estado).toBe('erro')
    expect(oauth.detalhe).toContain('unauthorized_client')
    expect(oauth.correcao).toContain('no-hub')
    expect(capacidade(r.body, 'google_ga4')).toMatchObject({ estado: 'nao_configurado' })
    expect(capacidade(r.body, 'google_search_console')).toMatchObject({ estado: 'erro', detalhe: 'Não testado: o OAuth do Google falhou.' })
    expect(r.body.google_escopos).toBeNull()

    const vazio = await montar().chamar('GET', '/connections', 'dot')
    for (const id of ['meta_ads_leitura', 'meta_ig_insights', 'meta_fb_insights', 'google_oauth', 'google_ga4', 'google_search_console', 'google_ads_leitura']) {
      expect(capacidade(vazio.body, id).estado).toBe('nao_configurado')
    }
    for (const id of ['meta_ig_publicacao', 'meta_fb_publicacao', 'meta_ads_escrita', 'google_ads_criacao']) {
      expect(capacidade(vazio.body, id).estado).toBe('nao_verificado')
    }
    expect(vazio.body.meta_permissoes).toBeNull()
  })

  it('connections usa cache de 15 min; fresco=1 testa de novo', async () => {
    const chamadas = plataformas()
    const { chamar } = montar({ metaToken: TOKENS.meta, google: GOOGLE_CHEIO })
    const primeira = await chamar('GET', '/connections', 'dot')
    const n = chamadas.length
    expect(primeira.body.cache).toBe(false)
    const segunda = await chamar('GET', '/connections', 'dot')
    expect(segunda.body.cache).toBe(true)
    expect(segunda.body.capacidades).toEqual(primeira.body.capacidades)
    expect(chamadas.length).toBe(n)
    const fresca = await chamar('GET', '/connections?fresco=1', 'dot')
    expect(fresca.body.cache).toBe(false)
    expect(chamadas.length).toBeGreaterThan(n)
    // fresco=1 renova o access token de verdade (não reaproveita o do worker).
    expect(chamadas.filter((c) => c.url === 'https://oauth2.googleapis.com/token')).toHaveLength(2)
  })
})


describe('T2 classificação de leads', () => {
  it('T2-24: dot e admin aal1 não leem nem classificam leads', async () => {
    const { chamar, acoes, classificacoes } = montar()
    for (const sessao of ['dot', 'admin-aal1']) {
      expect((await chamar('GET', '/leads?periodo=30d', sessao)).status).toBe(403)
      expect((await chamar('POST', `/leads/${CLIENTE}/classificacao`, sessao, { classe: 'real', request_id: crypto.randomUUID() })).status).toBe(403)
    }
    expect(acoes).toHaveLength(0)
    expect(classificacoes).toHaveLength(0)
  })
  it('T2-1–3,23,25: reclassificação é aditiva, idempotente, auditada e só real conta como válido', async () => {
    const { chamar, acoes, classificacoes } = montar()
    const inicial = await chamar('GET', '/leads?periodo=30d', 'admin-aal2')
    expect(inicial.body.leads[0].classe).toBeNull()
    for (const classe of ['teste', 'invalido', 'duplicado', 'real']) {
      const corpo = { classe, motivo: 'fixture', request_id: crypto.randomUUID() }
      expect((await chamar('POST', `/leads/${CLIENTE}/classificacao`, 'admin-aal2', corpo)).status).toBe(200)
      expect((await chamar('POST', `/leads/${CLIENTE}/classificacao`, 'admin-aal2', corpo)).body.idempotente).toBe(true)
      const resumo = (await chamar('GET', '/overview?periodo=30d&fresco=1', 'dot')).body.blocos.leads.dados
      expect(resumo.validos).toBe(classe === 'real' ? 1 : 0)
      expect(resumo.por_canal_validos.meta).toBe(classe === 'real' ? 1 : 0)
      expect(resumo.por_classe[classe]).toBe(1)
      expect(resumo.total).toBe(1)
      expect(JSON.stringify(resumo)).not.toContain('fixture@example.test')
    }
    expect(classificacoes).toHaveLength(4)
    expect(classificacoes.every(c => c.classificado_por === ADMIN && c.papel === 'NO_ADMIN')).toBe(true)
    expect(acoes).toHaveLength(4)
    expect(acoes.every(a => a.kind === 'lead.classificar' && a.target === CLIENTE)).toBe(true)
    expect(acoes[0].payload).toEqual({ lead_id: CLIENTE, classe: 'teste', motivo: 'fixture' })
  })
  it('T2-26: valores inválidos e lead inexistente não gravam classificação nem ação', async () => {
    const { chamar, acoes, classificacoes } = montar()
    for (const [id, patch, campo] of [
      [CLIENTE, { classe: 'outro' }, 'classe'],
      [CLIENTE, { classe: ['real'] }, 'classe'],
      [CLIENTE, { classe: null }, 'classe'],
      [CLIENTE, { motivo: 'x'.repeat(501) }, 'motivo'],
      [CLIENTE, { motivo: 1 }, 'motivo'],
      [ADMIN, {}, 'lead_id'],
      ['invalido', {}, 'lead_id'],
    ] as const) {
      const r = await chamar('POST', `/leads/${id}/classificacao`, 'admin-aal2', { classe: 'real', request_id: crypto.randomUUID(), ...patch })
      expect(r.status).toBe(422)
      expect(r.body.error_code).toBe('INVALID_REQUEST')
      expect(r.body.campos).toContain(campo)
    }
    expect(acoes).toHaveLength(0)
    expect(classificacoes).toHaveLength(0)
  })
})


it('T1-3: erro de escrita remove segredos da resposta, registro e logs', async () => {
  const { chamar, store, acoes, logs } = montar()
  store.leadClassificar = async () => { throw new Error(PREFIXOS_TOKEN.map(p => `${p}sintetico`).join(' ')) }
  const r = await chamar('POST', `/leads/${CLIENTE}/classificacao`, 'admin-aal2', { classe: 'real', request_id: crypto.randomUUID() })
  expect(r.status).toBe(502)
  const canais = JSON.stringify({ resposta: r.body, acoes, logs })
  for (const prefixo of PREFIXOS_TOKEN) expect(canais).not.toContain(prefixo)
  expect(acoes[0].error).toContain('[removido]')
})

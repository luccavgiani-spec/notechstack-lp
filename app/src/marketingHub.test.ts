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
      return [{ created_at: '2026-09-25T15:00:00Z', utm_source: 'instagram', utm_medium: 'paid', gclid: null, fbclid: null }]
    },
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
  return { store, acoes, posts, cache, banidos }
}

const CONFIG_VAZIA: HubConfig = {
  metaToken: null,
  google: { clientId: null, clientSecret: null, refreshToken: null, developerToken: null, customerId: null, loginCustomerId: null, ga4PropertyId: null, gscSiteUrl: null },
  googleCriacaoLiberada: false,
  appUrl: 'https://app.notechstack.com.br',
}

function montar(config: Partial<HubConfig> = {}) {
  const mem = storeEmMemoria()
  const handler = criarHandler({
    store: mem.store,
    autenticar: async (t) => SESSOES[t] ?? null,
    config: { ...CONFIG_VAZIA, ...config },
    agora: () => AGORA,
    esperar: async () => undefined,
    uuid: () => 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    log: () => undefined,
  })
  const chamar = async (metodo: string, caminho: string, sessao?: string, corpo?: unknown, extra: Record<string, string> = {}) => {
    const resp = await handler(new Request(`https://x.supabase.co/functions/v1/marketing-hub${caminho}`, {
      method: metodo,
      headers: { origin: 'https://app.notechstack.com.br', ...(sessao ? { authorization: `Bearer ${sessao}` } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}), ...extra },
      body: corpo ? JSON.stringify(corpo) : undefined,
    }))
    return { status: resp.status, body: await resp.json().catch(() => null), headers: resp.headers }
  }
  return { ...mem, chamar }
}

function mockFetch(responder: (url: string, init?: RequestInit) => { status?: number; body: unknown } | undefined) {
  const chamadas: { url: string; method: string; body: unknown }[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    chamadas.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body })
    const r = responder(url, init) ?? { status: 400, body: { error: { message: `sem mock ${url}` } } }
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 })
  }))
  return chamadas
}

afterEach(() => vi.unstubAllGlobals())

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

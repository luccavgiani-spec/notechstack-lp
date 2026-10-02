import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addDias,
  centavosDeMicros,
  limitesUtc,
  metaLeads,
  metaLpv,
  paginasQueCresceram,
  parseGa4Report,
  parseGoogleAdsMetrics,
  parseMetaInsight,
  parsePeriodo,
  periodoAnterior,
  somarMetricas,
  ttlSegundos,
} from '../../supabase/functions/_shared/marketing/normalize.ts'
import { canalDoLead, contarClassificados, contarLeads } from '../../supabase/functions/_shared/marketing/leads.ts'
import { PREFIXOS_TOKEN, Registro, calcularEstados, semPermissao, semSegredo } from '../../supabase/functions/_shared/marketing/estados.ts'
import { MetaApiError } from '../../supabase/functions/_shared/meta.ts'
import {
  MetaEscritaError,
  corpoEdicaoMeta,
  facebookOrganico,
  metaCampanhas,
  metaConta,
  metaCriarCampanha,
  metaResumo,
  publicarFacebook,
  publicarInstagram,
  type NovaCampanhaMeta,
} from '../../supabase/functions/_shared/marketing/meta.ts'
import {
  adsCriarCampanhaPesquisa,
  operacoesCampanhaPesquisa,
  type NovaCampanhaGoogle,
} from '../../supabase/functions/_shared/marketing/google-ads.ts'
import { GoogleApiError, googleAccessToken, limparCacheGoogle } from '../../supabase/functions/_shared/marketing/google-auth.ts'
import { ga4Resumo } from '../../supabase/functions/_shared/marketing/ga4.ts'
import { gscResumo, urlConsultaGsc } from '../../supabase/functions/_shared/marketing/gsc.ts'
import {
  caminhoMidia,
  validarCampanhaGoogle,
  validarCampanhaMeta,
  validarEdicaoMeta,
  validarPost,
} from '../../supabase/functions/_shared/marketing/validacao.ts'

// Fixtures no formato documentado de cada API. Pendente (execution.md): trocar
// pelas respostas reais anonimizadas das provas V1–V6 quando os secrets existirem.

type Chamada = { url: string; method: string; body: unknown; headers: Record<string, string> }
type Rota = (c: Chamada) => { status?: number; body: unknown; headers?: Record<string, string> } | undefined

function mockFetch(rotas: Rota[]) {
  const chamadas: Chamada[] = []
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const raw = init?.body
    let body: unknown = raw
    if (typeof raw === 'string') {
      try { body = JSON.parse(raw) } catch { body = Object.fromEntries(new URLSearchParams(raw)) }
    }
    const c: Chamada = { url, method: init?.method ?? 'GET', body, headers: (init?.headers ?? {}) as Record<string, string> }
    chamadas.push(c)
    for (const r of rotas) {
      const resp = r(c)
      if (resp) return new Response(JSON.stringify(resp.body), { status: resp.status ?? 200, headers: resp.headers })
    }
    return new Response(JSON.stringify({ error: { message: `sem mock para ${c.method} ${url}` } }), { status: 400 })
  })
  vi.stubGlobal('fetch', fn)
  return chamadas
}

const quando = (metodo: string, trecho: string, body: unknown, status = 200): Rota =>
  (c) => (c.method === metodo && c.url.includes(trecho) ? { status, body } : undefined)

afterEach(() => {
  vi.unstubAllGlobals()
  limparCacheGoogle()
})

const AGORA = new Date('2026-09-30T15:00:00Z') // 12h em São Paulo

describe('período do planner', () => {
  it('7d e 30d terminam ontem, em São Paulo', () => {
    expect(parsePeriodo('7d', AGORA)).toMatchObject({ de: '2026-09-23', ate: '2026-09-29', dias: 7 })
    expect(parsePeriodo('30d', AGORA)).toMatchObject({ de: '2026-08-31', ate: '2026-09-29', dias: 30 })
    expect(parsePeriodo(null, AGORA)?.id).toBe('7d')
    // 23h de 30/09 em SP ainda é dia 30, mesmo já sendo 01/10 em UTC
    expect(parsePeriodo('7d', new Date('2026-10-01T02:00:00Z'))?.ate).toBe('2026-09-29')
  })

  it('mês passado e intervalo livre', () => {
    expect(parsePeriodo('mes-passado', AGORA)).toMatchObject({ de: '2026-08-01', ate: '2026-08-31', dias: 31 })
    expect(parsePeriodo('2026-09-01..2026-09-10', AGORA)).toMatchObject({ de: '2026-09-01', ate: '2026-09-10', dias: 10 })
  })

  it.each(['2026-09-10..2026-09-01', '2026-02-30..2026-03-01', '2026-09-01..2026-10-05', '2024-01-01..2026-09-01', 'ontem', '7'])(
    'recusa %s',
    (valor) => expect(parsePeriodo(valor, AGORA)).toBeNull(),
  )

  it('cache curto para dias abertos e longo para período fechado', () => {
    expect(ttlSegundos(parsePeriodo('7d', AGORA)!, AGORA)).toBe(900)
    expect(ttlSegundos(parsePeriodo('mes-passado', AGORA)!, AGORA)).toBe(3600)
  })

  it('limites em UTC e período anterior de mesmo tamanho', () => {
    const p = parsePeriodo('7d', AGORA)!
    expect(limitesUtc(p)).toEqual({ inicio: '2026-09-23T03:00:00.000Z', fimExclusivo: '2026-09-30T03:00:00.000Z' })
    expect(periodoAnterior(p)).toMatchObject({ de: '2026-09-16', ate: '2026-09-22', dias: 7 })
    expect(addDias('2026-12-31', 1)).toBe('2027-01-01')
  })
})

describe('normalização', () => {
  it('conta leads pela coluna "Leads" do Ads Manager, com recuo para o pixel', () => {
    expect(metaLeads([{ action_type: 'link_click', value: '9' }, { action_type: 'lead', value: '4' }, { action_type: 'offsite_conversion.fb_pixel_lead', value: '3' }])).toBe(4)
    expect(metaLeads([{ action_type: 'offsite_conversion.fb_pixel_lead', value: '3' }])).toBe(3)
    expect(metaLeads(undefined)).toBe(0)
  })

  it('dinheiro sempre em centavos exatos', () => {
    expect(parseMetaInsight({ spend: '123.45', impressions: '1000', reach: '800', clicks: '30', inline_link_clicks: '20' })).toEqual({
      gasto_centavos: 12345, impressoes: 1000, alcance: 800, cliques: 30, cliques_link: 20, conversoes: 0, lpv: null,
    })
    expect(centavosDeMicros('12345678')).toBe(1235)
    expect(parseGoogleAdsMetrics({ costMicros: '5000000', clicks: '7', impressions: '100', conversions: 1.5 })).toMatchObject({
      gasto_centavos: 500, cliques: 7, conversoes: 1.5,
    })
  })

  it('GA4 vira linhas nomeadas', () => {
    expect(parseGa4Report({
      dimensionHeaders: [{ name: 'sessionDefaultChannelGroup' }],
      metricHeaders: [{ name: 'sessions' }],
      rows: [{ dimensionValues: [{ value: 'Paid Search' }], metricValues: [{ value: '42' }] }],
    })).toEqual([{ dimensoes: { sessionDefaultChannelGroup: 'Paid Search' }, metricas: { sessions: 42 } }])
  })

  it('páginas que mais cresceram, contra o período anterior', () => {
    const atual = [
      { chave: '/a', cliques: 10, impressoes: 1, ctr: 0, posicao: 1 },
      { chave: '/b', cliques: 30, impressoes: 1, ctr: 0, posicao: 1 },
      { chave: '/c', cliques: 5, impressoes: 1, ctr: 0, posicao: 1 },
    ]
    const antes = [{ chave: '/a', cliques: 2, impressoes: 1, ctr: 0, posicao: 1 }, { chave: '/c', cliques: 9, impressoes: 1, ctr: 0, posicao: 1 }]
    expect(paginasQueCresceram(atual, antes).map((p) => [p.chave, p.variacao])).toEqual([['/b', 30], ['/a', 8]])
  })

  it('canal do lead sem dado pessoal', () => {
    const base = { created_at: '2026-09-29T15:00:00Z', utm_source: null, utm_medium: null, gclid: null, fbclid: null }
    expect(canalDoLead({ ...base, fbclid: 'x' })).toBe('meta')
    expect(canalDoLead({ ...base, utm_source: 'instagram' })).toBe('meta')
    expect(canalDoLead({ ...base, gclid: 'x' })).toBe('google')
    expect(canalDoLead({ ...base, utm_source: 'google', utm_medium: 'cpc' })).toBe('google')
    expect(canalDoLead({ ...base, utm_source: 'google' })).toBe('organico')
    expect(canalDoLead(base)).toBe('direto')
    expect(canalDoLead({ ...base, utm_source: 'newsletter' })).toBe('outros')
    const p = parsePeriodo('7d', AGORA)!
    const contagem = contarLeads([{ ...base, fbclid: 'x' }, { ...base, created_at: '2026-09-24T02:00:00Z' }], p)
    expect(contagem.total).toBe(2)
    expect(contagem.por_canal).toMatchObject({ meta: 1, direto: 1 })
    expect(contagem.por_dia.find((d) => d.dia === '2026-09-23')?.total).toBe(1) // 23h em SP
  })
})

const campanhaMeta: NovaCampanhaMeta = {
  nome: '[teste hub] leads',
  objetivo: 'OUTCOME_LEADS',
  orcamento: { tipo: 'diario', centavos: 2000 },
  inicio: '2026-10-01T12:00:00.000Z',
  fim: null,
  publico: { paises: ['BR'], cidades: [], regioes: [], idade_min: 25, idade_max: 55, genero: 'todos' },
  criativo: { tipo: 'imagem', midia: '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-arte.jpg', texto: 'Texto', titulo: 'Título', link: 'https://www.notechstack.com.br/', cta: 'LEARN_MORE' },
}
const ctxMeta = { token: 'tok-meta', adAccountId: 'act_111', pageId: '222', igUserId: '333' }
const semEspera = async () => undefined

describe('Meta — escrita', () => {
  it('cria campanha PAUSED → conjunto → imagem → criativo → anúncio, com os payloads exatos', async () => {
    const chamadas = mockFetch([
      quando('POST', '/act_111/campaigns', { id: 'c1' }),
      quando('POST', '/act_111/adsets', { id: 's1' }),
      quando('POST', '/act_111/adimages', { images: { bytes: { hash: 'h1' } } }),
      quando('POST', '/act_111/adcreatives', { id: 'cr1' }),
      quando('POST', '/act_111/ads', { id: 'a1' }),
    ])
    const r = await metaCriarCampanha(ctxMeta, campanhaMeta, { tipo: 'imagem', bytesBase64: 'QUJD' }, semEspera)

    expect(chamadas.map((c) => new URL(c.url).pathname)).toEqual([
      '/v25.0/act_111/campaigns', '/v25.0/act_111/adsets', '/v25.0/act_111/adimages', '/v25.0/act_111/adcreatives', '/v25.0/act_111/ads',
    ])
    expect(chamadas.every((c) => new URL(c.url).searchParams.get('access_token') === 'tok-meta')).toBe(true)
    expect(chamadas[0].body).toEqual({
      name: '[teste hub] leads', objective: 'OUTCOME_LEADS', status: 'PAUSED', buying_type: 'AUCTION',
      special_ad_categories: [], is_adset_budget_sharing_enabled: false,
    })
    expect(chamadas[1].body).toEqual({
      name: '[teste hub] leads · conjunto', campaign_id: 'c1', status: 'ACTIVE', billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS', bid_strategy: 'LOWEST_COST_WITHOUT_CAP', destination_type: 'WEBSITE',
      promoted_object: { pixel_id: '1753619075655271', custom_event_type: 'LEAD' },
      daily_budget: 2000, start_time: '2026-10-01T12:00:00.000Z',
      targeting: { geo_locations: { countries: ['BR'] }, age_min: 25, age_max: 55, targeting_automation: { advantage_audience: 0 } },
    })
    expect(chamadas[2].body).toEqual({ bytes: 'QUJD' })
    expect(chamadas[3].body).toEqual({
      name: '[teste hub] leads · criativo',
      object_story_spec: {
        page_id: '222', instagram_user_id: '333',
        link_data: {
          message: 'Texto', name: 'Título', link: 'https://www.notechstack.com.br/', image_hash: 'h1',
          call_to_action: { type: 'LEARN_MORE', value: { link: 'https://www.notechstack.com.br/' } },
        },
      },
    })
    expect(chamadas[4].body).toEqual({ name: '[teste hub] leads · anúncio', adset_id: 's1', creative: { creative_id: 'cr1' }, status: 'ACTIVE' })
    expect(r.external_ids).toEqual({ campaign_id: 'c1', adset_id: 's1', image_hash: 'h1', creative_id: 'cr1', ad_id: 'a1' })
    expect(r.result).toMatchObject({ status_campanha: 'PAUSED' })
  })

  it('falha no meio devolve os ids já criados e não repete o POST', async () => {
    const chamadas = mockFetch([
      quando('POST', '/campaigns', { id: 'c1' }),
      quando('POST', '/adsets', { id: 's1' }),
      quando('POST', '/adimages', { images: { bytes: { hash: 'h1' } } }),
      quando('POST', '/adcreatives', { error: { message: 'Invalid', error_user_title: 'Link inválido', error_user_msg: 'O link não abre.' } }, 400),
    ])
    const erro = await metaCriarCampanha(ctxMeta, campanhaMeta, { tipo: 'imagem', bytesBase64: 'QUJD' }, semEspera).catch((e) => e)
    expect(erro).toBeInstanceOf(MetaEscritaError)
    expect(erro.message).toBe('Link inválido: O link não abre.')
    expect(erro.externalIds).toEqual({ campaign_id: 'c1', adset_id: 's1', image_hash: 'h1' })
    expect(chamadas.filter((c) => c.url.includes('/adcreatives'))).toHaveLength(1)
  })

  it('tráfego sem pixel, gênero e cidades no público', async () => {
    const chamadas = mockFetch([
      quando('POST', '/campaigns', { id: 'c1' }), quando('POST', '/adsets', { id: 's1' }),
      quando('POST', '/adimages', { images: { x: { hash: 'h' } } }), quando('POST', '/adcreatives', { id: 'cr' }), quando('POST', '/ads', { id: 'a' }),
    ])
    await metaCriarCampanha(ctxMeta, {
      ...campanhaMeta, objetivo: 'OUTCOME_TRAFFIC', orcamento: { tipo: 'total', centavos: 50000 }, fim: '2026-10-10T12:00:00.000Z',
      publico: { ...campanhaMeta.publico, paises: [], cidades: [{ key: '123', nome: 'Bragança', raio_km: 25 }], genero: 'feminino' },
    }, { tipo: 'imagem', bytesBase64: 'x' }, semEspera)
    const conjunto = chamadas[1].body as Record<string, unknown>
    expect(conjunto).toMatchObject({ optimization_goal: 'LINK_CLICKS', lifetime_budget: 50000, end_time: '2026-10-10T12:00:00.000Z' })
    expect(conjunto).not.toHaveProperty('promoted_object')
    expect(conjunto.targeting).toEqual({
      geo_locations: { cities: [{ key: '123', radius: 25, distance_unit: 'kilometer' }] },
      age_min: 25, age_max: 55, genders: [2], targeting_automation: { advantage_audience: 0 },
    })
  })

  it('edição só manda o que o nível aceita', () => {
    expect(corpoEdicaoMeta('adset', { orcamento_diario_centavos: 3000, fim: null })).toEqual({ daily_budget: 3000, end_time: '' })
    expect(corpoEdicaoMeta('campaign', { nome: 'Novo', fim: '2026-11-01T00:00:00.000Z' })).toEqual({ name: 'Novo', stop_time: '2026-11-01T00:00:00.000Z' })
  })

  it('resumo: alcance vem do total, não da soma dos dias', async () => {
    mockFetch([
      (c) => c.url.includes('/act_111/insights') && c.url.includes('time_increment=1')
        ? { body: { data: [{ date_start: '2026-09-23', spend: '10.00', reach: '100', impressions: '200', clicks: '5', inline_link_clicks: '4', actions: [{ action_type: 'lead', value: '1' }, { action_type: 'landing_page_view', value: '3' }] }] } }
        : undefined,
      (c) => c.url.includes('/act_111/insights')
        ? { body: { data: [{ spend: '10.00', reach: '90', impressions: '200', clicks: '5', inline_link_clicks: '4', actions: [{ action_type: 'lead', value: '1' }, { action_type: 'landing_page_view', value: '3' }] }] } }
        : undefined,
      quando('GET', '/act_111?', { id: 'act_111', currency: 'BRL', timezone_name: 'America/Sao_Paulo' }),
    ])
    const r = await metaResumo(ctxMeta, parsePeriodo('7d', AGORA)!)
    expect(r.total).toMatchObject({ gasto_centavos: 1000, alcance: 90, conversoes: 1, lpv: 3 })
    expect(r.por_dia).toHaveLength(7)
    expect(r.por_dia[0]).toMatchObject({ dia: '2026-09-23', alcance: 100, lpv: 3 })
    // Dia sem linha da Meta: LPV não é inventado como 0.
    expect(r.por_dia[1]).toMatchObject({ dia: '2026-09-24', lpv: null })
  })

  it('LPV vem de landing_page_view; ausente é null, nunca 0', () => {
    expect(metaLpv([{ action_type: 'link_click', value: '9' }, { action_type: 'landing_page_view', value: '7' }])).toBe(7)
    expect(metaLpv([{ action_type: 'link_click', value: '9' }])).toBeNull()
    expect(metaLpv(undefined)).toBeNull()
    expect(parseMetaInsight({ spend: '1', actions: [{ action_type: 'landing_page_view', value: '0' }] }).lpv).toBe(0)
    expect(parseMetaInsight({ spend: '1' }).lpv).toBeNull()
  })

  it('LPV por campanha; Google sempre null; soma ignora dia sem LPV', async () => {
    mockFetch([
      quando('GET', '/act_111/campaigns', { data: [
        { id: '901', name: 'TRAF - 20d - Agencias', status: 'ACTIVE', objective: 'OUTCOME_TRAFFIC' },
        { id: '902', name: 'Outra', status: 'PAUSED', objective: 'OUTCOME_LEADS' },
      ] }),
      quando('GET', '/act_111/insights', { data: [
        { campaign_id: '901', spend: '172.64', clicks: '1500', inline_link_clicks: '1499', actions: [{ action_type: 'landing_page_view', value: '612' }] },
      ] }),
    ])
    const campanhas = await metaCampanhas(ctxMeta, parsePeriodo('30d', AGORA)!)
    expect(campanhas.find((c) => c.id === '901')?.metricas).toMatchObject({ gasto_centavos: 17264, lpv: 612 })
    expect(campanhas.find((c) => c.id === '902')?.metricas.lpv).toBeNull()
    expect(parseGoogleAdsMetrics({ costMicros: '1000000' }).lpv).toBeNull()
    const dia = (lpv: number | null) => ({ ...parseMetaInsight({}), lpv })
    expect(somarMetricas([dia(2), dia(null), dia(5)]).lpv).toBe(7)
    expect(somarMetricas([dia(null), dia(null)]).lpv).toBeNull()
  })

  it('conta lida da Graph: id, moeda, fuso e versão do cabeçalho da resposta', async () => {
    const chamadas = mockFetch([
      (c) => c.url.includes('/act_111?')
        ? { body: { id: 'act_111', currency: 'BRL', timezone_name: 'America/Sao_Paulo' }, headers: { 'facebook-api-version': 'v25.0' } }
        : undefined,
    ])
    expect(await metaConta(ctxMeta)).toEqual({ id: 'act_111', moeda: 'BRL', fuso: 'America/Sao_Paulo', versao_api: 'v25.0' })
    expect(new URL(chamadas[0].url).searchParams.get('fields')).toBe('id,currency,timezone_name')
  })

  it('conta que falha não derruba o resumo: campos null e estado da conta', async () => {
    mockFetch([
      quando('GET', '/act_111/insights', { data: [] }),
      quando('GET', '/act_111?', { error: { message: 'Unsupported get request', code: 100 } }, 400),
    ])
    const reg = new Registro()
    const r = await metaResumo(ctxMeta, parsePeriodo('7d', AGORA)!, reg)
    expect(r.conta).toEqual({ id: 'act_111', moeda: null, fuso: null, versao_api: null })
    expect(calcularEstados({ atrasado: false }, reg)).toMatchObject({ conta: 'erro', bloco: 'parcial' })
  })
})

describe('Facebook orgânico com permissão parcial (T1-4/5)', () => {
  const RECUSA_10 = { error: { message: "(#10) This endpoint requires the 'pages_read_user_content' permission or the 'Page Public Content Access' feature", type: 'OAuthException', code: 10 } }
  const post = { id: '222_1', message: 'Post', created_time: '2026-09-20T12:00:00+0000', permalink_url: 'https://fb/1', shares: { count: 2 }, reactions: { summary: { total_count: 5 } }, comments: { summary: { total_count: 3 } } }

  function mockPagina(recusar: (campos: string) => { status: number; body: unknown } | null) {
    return mockFetch([
      (c) => {
        const u = new URL(c.url)
        if (u.pathname.endsWith('/222') && u.searchParams.get('fields') === 'access_token') return { body: { access_token: 'tok-pagina' } }
        if (u.pathname.endsWith('/222')) return { body: { followers_count: 40, name: 'nó' } }
        if (u.pathname.endsWith('/222/insights')) return { body: { data: [{ name: 'page_media_view', values: [{ value: 10 }] }, { name: 'page_post_engagements', values: [{ value: 4 }] }] } }
        if (u.pathname.endsWith('/222/posts')) {
          const campos = u.searchParams.get('fields') ?? ''
          const recusa = recusar(campos)
          if (recusa) return recusa
          const p: Record<string, unknown> = { ...post }
          if (!campos.includes('reactions')) delete p.reactions
          if (!campos.includes('comments')) delete p.comments
          return { body: { data: [p] } }
        }
        return undefined
      },
    ])
  }
  const postsChamadas = (chamadas: Chamada[]) => chamadas.filter((c) => c.url.includes('/222/posts')).map((c) => new URL(c.url).searchParams.get('fields'))

  it('não consulta comments nem reactions recusados em produção; preserva posts e métricas de conta', async () => {
    const chamadas = mockPagina((campos) => (campos.includes('comments') || campos.includes('reactions') ? { status: 400, body: RECUSA_10 } : null))
    const reg = new Registro()
    const r = await facebookOrganico(ctxMeta, parsePeriodo('30d', AGORA)!, reg)
    expect(postsChamadas(chamadas)).toEqual(['id,message,created_time,permalink_url,shares'])
    expect(r.posts[0]).toMatchObject({ curtidas: null, comentarios: null, interacoes: null, compartilhamentos: 2 })
    expect(r).toMatchObject({ seguidores: 40, visualizacoes: 10, interacoes: 4 })
    expect(reg.falhas).toHaveLength(1)
    expect(reg.falhas[0]).toMatchObject({ estado: 'sem_permissao', variante: 'sem_engajamento' })
    expect(JSON.stringify(reg.falhas)).not.toContain('pages_read_user_content')
    expect(calcularEstados({ atrasado: false }, reg)).toEqual({
      'posts.curtidas': 'sem_permissao', 'posts.comentarios': 'sem_permissao', 'posts.interacoes': 'sem_permissao', bloco: 'parcial',
    })
  })

  it('recusa real da consulta básica fica registrada, sem ocultar erro de permissão', async () => {
    const chamadas = mockPagina(() => ({ status: 400, body: RECUSA_10 }))
    const reg = new Registro()
    const r = await facebookOrganico(ctxMeta, parsePeriodo('30d', AGORA)!, reg)
    expect(postsChamadas(chamadas)).toHaveLength(1)
    expect(r.posts).toEqual([])
    expect(reg.falhas[0].mensagem).toContain('pages_read_user_content')
    expect(calcularEstados({ atrasado: false }, reg)).toEqual({ posts: 'sem_permissao', bloco: 'parcial' })
  })

  it('posts do Facebook com erro comum: não sonda variantes e não derruba o bloco', async () => {
    const chamadas = mockPagina(() => ({ status: 400, body: { error: { message: 'Invalid parameter', code: 100 } } }))
    const reg = new Registro()
    const r = await facebookOrganico(ctxMeta, parsePeriodo('30d', AGORA)!, reg)
    expect(postsChamadas(chamadas)).toHaveLength(1)
    expect(r.posts).toEqual([])
    expect(r.visualizacoes).toBe(10)
    expect(calcularEstados({ atrasado: false }, reg)).toEqual({ posts: 'erro', bloco: 'parcial' })
  })

  it('consulta aprovada mantém a restrição explícita de engajamento, sem assumir novas permissões', async () => {
    const chamadas = mockPagina(() => null)
    const reg = new Registro()
    const r = await facebookOrganico(ctxMeta, parsePeriodo('30d', AGORA)!, reg)
    expect(postsChamadas(chamadas)).toHaveLength(1)
    expect(r.posts[0]).toMatchObject({ curtidas: null, comentarios: null, interacoes: null })
    expect(reg.falhas[0]).toMatchObject({ estado: 'sem_permissao', variante: 'sem_engajamento' })
  })
})

describe('estados das métricas', () => {
  it('permissão: Graph 10 e 200–299, Google 403; o resto é erro', () => {
    const graph = (code: number) => new MetaApiError(400, { error: { code, message: 'x' } }, 'x')
    expect(semPermissao(graph(10))).toBe(true)
    expect(semPermissao(graph(200))).toBe(true)
    expect(semPermissao(graph(299))).toBe(true)
    expect(semPermissao(graph(100))).toBe(false)
    expect(semPermissao(graph(190))).toBe(false)
    expect(semPermissao(new GoogleApiError(403, {}, 'PERMISSION_DENIED'))).toBe(true)
    expect(semPermissao(new GoogleApiError(401, {}, 'unauthorized_client'))).toBe(false)
  })

  it('só entra o que não está disponível; 0 é zero; nulo sem falha é indisponível', () => {
    expect(calcularEstados({ periodo: { a: 5, b: 0, c: null }, atrasado: false }, new Registro())).toEqual({ b: 'zero', c: 'indisponivel' })
  })

  it('período com hoje: métricas do período atrasado, fixas não', () => {
    expect(calcularEstados({ periodo: { a: 5, b: 0, c: null }, fixas: { seguidores: 9 }, atrasado: true }, new Registro()))
      .toEqual({ a: 'atrasado', b: 'atrasado', c: 'indisponivel', bloco: 'atrasado' })
  })

  it('mensagem de falha nunca carrega token', () => {
    const [acesso, refresh, segredo, meta] = PREFIXOS_TOKEN
    expect(semSegredo(`falhou ${acesso}a0Abc-1_x ${refresh}gAbc ${segredo}xyz ${meta}bcd123 fim`)).toBe('falhou [removido] [removido] [removido] [removido] fim')
    const reg = new Registro()
    reg.falhou(['x'], new Error(`token ${meta}segredo123 inválido`))
    expect(reg.falhas[0].mensagem).toBe('token [removido] inválido')
  })
})

describe('leads classificados (preparo; T2-Unresolved 1 decide onde a classe mora)', () => {
  it('válidos são só os real; a classificar em linha própria; canal só dos válidos', () => {
    const base = { created_at: '2026-09-29T15:00:00Z', utm_source: null, utm_medium: null, gclid: null, fbclid: null }
    const r = contarClassificados([
      { origem: { ...base, fbclid: 'x' }, classe: 'real' },
      { origem: { ...base, gclid: 'y' }, classe: 'teste' },
      { origem: { ...base, fbclid: 'z' }, classe: 'duplicado' },
      { origem: base, classe: 'invalido' },
      { origem: { ...base, utm_source: 'google', utm_medium: 'cpc' }, classe: null },
    ])
    expect(r.validos).toBe(1)
    expect(r.por_classe).toEqual({ real: 1, teste: 1, invalido: 1, duplicado: 1, a_classificar: 1 })
    expect(r.por_canal_validos).toEqual({ meta: 1, google: 0, organico: 0, direto: 0, outros: 0 })
    expect(contarClassificados(Array.from({ length: 10 }, () => ({ origem: base, classe: 'teste' as const }))))
      .toMatchObject({ validos: 0, por_classe: { teste: 10 } })
  })
})

describe('Meta — publicação', () => {
  it('imagem no IG: container → FINISHED → media_publish', async () => {
    const chamadas = mockFetch([
      quando('POST', '/333/media_publish', { id: 'ig-post-1' }),
      quando('POST', '/333/media', { id: 'cont1' }),
      quando('GET', '/cont1', { status_code: 'FINISHED' }),
    ])
    const r = await publicarInstagram(ctxMeta, { rede: 'instagram', tipo: 'feed_image', legenda: 'Oi', urls: ['https://s/x.jpg?token=1'], containerId: null }, semEspera)
    expect(r).toEqual({ status: 'publicado', externalPostId: 'ig-post-1', containerId: 'cont1' })
    expect(chamadas[0].body).toEqual({ image_url: 'https://s/x.jpg?token=1', caption: 'Oi' })
    expect(chamadas.at(-1)?.body).toEqual({ creation_id: 'cont1' })
  })

  it('reel ainda processando devolve o container para a próxima rodada', async () => {
    const chamadas = mockFetch([
      quando('POST', '/333/media', { id: 'cont2' }),
      quando('GET', '/cont2', { status_code: 'IN_PROGRESS' }),
    ])
    const r = await publicarInstagram(ctxMeta, { rede: 'instagram', tipo: 'reel', legenda: 'R', urls: ['https://s/v.mp4?token=1'], containerId: null }, semEspera, 2)
    expect(r).toEqual({ status: 'processando', containerId: 'cont2' })
    expect(chamadas[0].body).toEqual({ media_type: 'REELS', video_url: 'https://s/v.mp4?token=1', caption: 'R', share_to_feed: true })
    expect(chamadas.some((c) => c.url.includes('media_publish'))).toBe(false)
  })

  it('carrossel cria filhos e o container pai', async () => {
    let n = 0
    const chamadas = mockFetch([
      quando('POST', '/333/media_publish', { id: 'ig-post-2' }),
      (c) => (c.method === 'POST' && c.url.includes('/333/media') ? { body: { id: `k${++n}` } } : undefined),
      quando('GET', '/k3', { status_code: 'FINISHED' }),
    ])
    await publicarInstagram(ctxMeta, { rede: 'instagram', tipo: 'carousel', legenda: 'C', urls: ['https://s/1.jpg', 'https://s/2.jpg'], containerId: null }, semEspera)
    expect(chamadas[0].body).toEqual({ image_url: 'https://s/1.jpg', is_carousel_item: true })
    expect(chamadas[2].body).toEqual({ media_type: 'CAROUSEL', children: 'k1,k2', caption: 'C' })
  })

  it('Facebook publica com o token da Página', async () => {
    const chamadas = mockFetch([
      quando('GET', '/222?', { access_token: 'tok-pagina' }),
      quando('POST', '/222/photos', { id: 'foto1', post_id: '222_99' }),
    ])
    const r = await publicarFacebook(ctxMeta, { rede: 'facebook', tipo: 'fb_post', legenda: 'F', urls: ['https://s/a.jpg?t=1'], containerId: null })
    expect(r).toMatchObject({ status: 'publicado', externalPostId: '222_99' })
    expect(new URL(chamadas[1].url).searchParams.get('access_token')).toBe('tok-pagina')
    expect(chamadas[1].body).toEqual({ url: 'https://s/a.jpg?t=1', message: 'F', published: true })
  })
})

const campanhaGoogle: NovaCampanhaGoogle = {
  nome: '[teste hub] pesquisa',
  orcamento_diario_centavos: 1500,
  lances: { estrategia: 'MANUAL_CPC', cpc_max_centavos: 250 },
  locais: ['2076'],
  idiomas: ['1014'],
  grupo: { nome: 'Grupo 1' },
  palavras_chave: [{ texto: 'agência de sistemas', correspondencia: 'PHRASE' }],
  anuncio: { titulos: ['T1', 'T2', 'T3'], descricoes: ['D1', 'D2'], url_final: 'https://www.notechstack.com.br/', caminho1: 'sistemas', caminho2: '' },
}

describe('Google Ads — escrita', () => {
  it('uma requisição atômica com ids temporários e tudo PAUSED', () => {
    expect(operacoesCampanhaPesquisa('930-207-4409', campanhaGoogle, 'abc12345')).toEqual([
      { campaignBudgetOperation: { create: { resourceName: 'customers/9302074409/campaignBudgets/-1', name: '[teste hub] pesquisa · orçamento abc12345', amountMicros: '15000000', deliveryMethod: 'STANDARD', explicitlyShared: false } } },
      { campaignOperation: { create: {
        resourceName: 'customers/9302074409/campaigns/-2', name: '[teste hub] pesquisa', status: 'PAUSED', advertisingChannelType: 'SEARCH',
        campaignBudget: 'customers/9302074409/campaignBudgets/-1',
        networkSettings: { targetGoogleSearch: true, targetSearchNetwork: false, targetContentNetwork: false, targetPartnerSearchNetwork: false },
        containsEuPoliticalAdvertising: 'DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING', manualCpc: {},
      } } },
      { campaignCriterionOperation: { create: { campaign: 'customers/9302074409/campaigns/-2', location: { geoTargetConstant: 'geoTargetConstants/2076' } } } },
      { campaignCriterionOperation: { create: { campaign: 'customers/9302074409/campaigns/-2', language: { languageConstant: 'languageConstants/1014' } } } },
      { adGroupOperation: { create: { resourceName: 'customers/9302074409/adGroups/-3', campaign: 'customers/9302074409/campaigns/-2', name: 'Grupo 1', status: 'ENABLED', type: 'SEARCH_STANDARD', cpcBidMicros: '2500000' } } },
      { adGroupCriterionOperation: { create: { adGroup: 'customers/9302074409/adGroups/-3', status: 'ENABLED', keyword: { text: 'agência de sistemas', matchType: 'PHRASE' } } } },
      { adGroupAdOperation: { create: { adGroup: 'customers/9302074409/adGroups/-3', status: 'ENABLED', ad: {
        finalUrls: ['https://www.notechstack.com.br/'],
        responsiveSearchAd: { headlines: [{ text: 'T1' }, { text: 'T2' }, { text: 'T3' }], descriptions: [{ text: 'D1' }, { text: 'D2' }], path1: 'sistemas' },
      } } } },
    ])
  })

  it('maximizar cliques usa targetSpend com teto opcional', () => {
    const ops = operacoesCampanhaPesquisa('1', { ...campanhaGoogle, lances: { estrategia: 'MAXIMIZE_CLICKS', cpc_max_centavos: null } }, 'x') as Record<string, { create: Record<string, unknown> }>[]
    expect(ops[1].campaignOperation.create).toMatchObject({ targetSpend: {} })
    expect(ops.find((o) => 'adGroupOperation' in o)?.adGroupOperation.create).not.toHaveProperty('cpcBidMicros')
  })

  it('manda developer-token e login-customer-id na v25 e lê os ids criados', async () => {
    const chamadas = mockFetch([
      quando('POST', 'oauth2.googleapis.com/token', { access_token: 'ya29.x', expires_in: 3600 }),
      quando('POST', '/v25/customers/9302074409/googleAds:mutate', { mutateOperationResponses: [
        { campaignBudgetResult: { resourceName: 'customers/9302074409/campaignBudgets/77' } },
        { campaignResult: { resourceName: 'customers/9302074409/campaigns/88' } },
        { adGroupResult: { resourceName: 'customers/9302074409/adGroups/99' } },
      ] }),
    ])
    const token = await googleAccessToken({ clientId: 'cid', clientSecret: 'sec', refreshToken: 'rt-123456789' })
    const r = await adsCriarCampanhaPesquisa({ token, developerToken: 'dev', customerId: '930-207-4409', loginCustomerId: '111-222-3333' }, campanhaGoogle, 'abc')
    expect(chamadas[0].body).toMatchObject({ grant_type: 'refresh_token', refresh_token: 'rt-123456789' })
    expect(chamadas[1].headers).toMatchObject({ authorization: 'Bearer ya29.x', 'developer-token': 'dev', 'login-customer-id': '1112223333' })
    expect(r.external_ids).toEqual({ campaign_id: '88', budget_id: '77', ad_group_id: '99' })
  })

  it('token Google fica em cache até perto de expirar', async () => {
    const chamadas = mockFetch([quando('POST', 'oauth2.googleapis.com/token', { access_token: 'a', expires_in: 3600 })])
    const cred = { clientId: 'c', clientSecret: 's', refreshToken: 'r-abcdefgh' }
    await googleAccessToken(cred, 0)
    await googleAccessToken(cred, 60_000)
    expect(chamadas).toHaveLength(1)
    await googleAccessToken(cred, 3_600_000)
    expect(chamadas).toHaveLength(2)
  })
})

describe('GA4 e Search Console', () => {
  beforeEach(() => undefined)

  it('GA4 em um batchRunReports, com o custo do Google Ads como conferência', async () => {
    const chamadas = mockFetch([
      quando('POST', '/properties/123456:batchRunReports', { reports: [
        { dimensionHeaders: [{ name: 'sessionDefaultChannelGroup' }], metricHeaders: [{ name: 'sessions' }, { name: 'totalUsers' }, { name: 'keyEvents' }],
          rows: [{ dimensionValues: [{ value: 'Paid Search' }], metricValues: [{ value: '10' }, { value: '8' }, { value: '2' }] },
                 { dimensionValues: [{ value: 'Direct' }], metricValues: [{ value: '5' }, { value: '5' }, { value: '0' }] }] },
        { dimensionHeaders: [{ name: 'date' }], metricHeaders: [{ name: 'sessions' }, { name: 'keyEvents' }],
          rows: [{ dimensionValues: [{ value: '20260923' }], metricValues: [{ value: '15' }, { value: '2' }] }] },
        { dimensionHeaders: [{ name: 'eventName' }], metricHeaders: [{ name: 'keyEvents' }],
          rows: [{ dimensionValues: [{ value: 'lead_submit' }], metricValues: [{ value: '2' }] }, { dimensionValues: [{ value: 'page_view' }], metricValues: [{ value: '0' }] }] },
        { metricHeaders: [{ name: 'advertiserAdCost' }, { name: 'advertiserAdClicks' }, { name: 'advertiserAdImpressions' }],
          rows: [{ metricValues: [{ value: '12.34' }, { value: '9' }, { value: '300' }] }] },
      ] }),
    ])
    const r = await ga4Resumo('tok', '123456', parsePeriodo('7d', AGORA)!)
    expect((chamadas[0].body as { requests: unknown[] }).requests).toHaveLength(4)
    expect(r).toMatchObject({ sessoes: 15, eventos_chave: 2, google_ads_segundo_ga4: { gasto_centavos: 1234, cliques: 9, impressoes: 300 } })
    expect(r.eventos).toEqual([{ evento: 'lead_submit', total: 2 }])
    expect(r.por_dia[0]).toEqual({ dia: '2026-09-23', sessoes: 15, eventos_chave: 2 })
  })

  it('GSC codifica a propriedade de domínio e compara com o período anterior', async () => {
    expect(urlConsultaGsc('sc-domain:notechstack.com.br')).toBe(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Anotechstack.com.br/searchAnalytics/query',
    )
    const chamadas = mockFetch([
      (c) => {
        const b = c.body as { dimensions: string[]; startDate: string }
        if (b.dimensions[0] === 'date') return { body: { rows: [{ keys: ['2026-09-23'], clicks: 3, impressions: 50 }] } }
        if (b.dimensions[0] === 'query') return { body: { rows: [{ keys: ['nó tech stack'], clicks: 3, impressions: 10, ctr: 0.3, position: 1.2 }] } }
        if (b.startDate === '2026-09-23') return { body: { rows: [{ keys: ['https://www.notechstack.com.br/'], clicks: 3, impressions: 40 }] } }
        return { body: { rows: [] } }
      },
    ])
    const r = await gscResumo('tok', 'sc-domain:notechstack.com.br', parsePeriodo('7d', AGORA)!)
    expect(chamadas).toHaveLength(4)
    expect(r).toMatchObject({ cliques: 3, impressoes: 50, comparado_com: { de: '2026-09-16', ate: '2026-09-22' } })
    expect(r.paginas_que_cresceram[0]).toMatchObject({ chave: 'https://www.notechstack.com.br/', variacao: 3 })
  })
})

describe('validação das escritas', () => {
  const corpoMeta = {
    nome: 'Campanha', objetivo: 'OUTCOME_TRAFFIC', orcamento: { tipo: 'diario', centavos: 2000 }, inicio: '2026-10-01T12:00:00Z',
    publico: { paises: ['BR'], idade_min: 18, idade_max: 65, genero: 'todos' },
    criativo: { tipo: 'imagem', midia: '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-arte.png', texto: 'T', titulo: 'T', link: 'https://x.com.br', cta: 'LEARN_MORE' },
  }

  it('aceita a campanha Meta válida e aponta cada campo inválido', () => {
    expect(validarCampanhaMeta(corpoMeta).ok).toBe(true)
    const v = validarCampanhaMeta({ ...corpoMeta, objetivo: 'OUTCOME_SALES', orcamento: { tipo: 'total', centavos: 50 }, criativo: { ...corpoMeta.criativo, link: 'http://x.com', midia: '../../etc' } })
    expect(v).toEqual({ ok: false, campos: expect.arrayContaining(['objetivo', 'orcamento.centavos', 'fim', 'criativo.link', 'criativo.midia']) })
    expect(validarCampanhaMeta({ ...corpoMeta, publico: { ...corpoMeta.publico, paises: [] } })).toMatchObject({ ok: false, campos: ['publico.local'] })
  })

  it('edição Meta: orçamento só no conjunto', () => {
    expect(validarEdicaoMeta('adset', { orcamento_diario_centavos: 3000 }).ok).toBe(true)
    expect(validarEdicaoMeta('campaign', { orcamento_diario_centavos: 3000 })).toMatchObject({ ok: false, campos: ['nivel'] })
    expect(validarEdicaoMeta('ad', {})).toMatchObject({ ok: false, campos: ['alteracao'] })
  })

  it('Google: limites do anúncio responsivo', () => {
    const corpo = { ...campanhaGoogle, lances: { estrategia: 'MANUAL_CPC', cpc_max_centavos: null } }
    expect(validarCampanhaGoogle(campanhaGoogle).ok).toBe(true)
    expect(validarCampanhaGoogle(corpo)).toMatchObject({ ok: false, campos: ['lances.cpc_max_centavos'] })
    expect(validarCampanhaGoogle({ ...campanhaGoogle, anuncio: { ...campanhaGoogle.anuncio, titulos: ['a', 'b'] } })).toMatchObject({ ok: false, campos: ['anuncio.titulos'] })
    expect(validarCampanhaGoogle({ ...campanhaGoogle, anuncio: { ...campanhaGoogle.anuncio, titulos: ['x'.repeat(31), 'b', 'c'] } })).toMatchObject({ ok: false })
    expect(validarCampanhaGoogle({ ...campanhaGoogle, locais: ['Brasil'] })).toMatchObject({ ok: false, campos: ['locais'] })
  })

  it('posts: formatos que cada rede aceita e nada no passado', () => {
    const jpg = '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.jpg'
    const png = '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.png'
    const mp4 = '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-video.mp4'
    const base = { rede: 'instagram', tipo: 'feed_image', legenda: 'Oi', midias: [jpg], agendado_para: '2026-10-01T12:00:00Z' }
    expect(validarPost(base, AGORA).ok).toBe(true)
    expect(validarPost({ ...base, midias: [png] }, AGORA)).toMatchObject({ ok: false, campos: ['midias'] })
    expect(validarPost({ ...base, tipo: 'reel', midias: [mp4] }, AGORA).ok).toBe(true)
    expect(validarPost({ ...base, tipo: 'fb_post' }, AGORA)).toMatchObject({ ok: false, campos: ['tipo'] })
    expect(validarPost({ ...base, agendado_para: '2026-09-29T12:00:00Z' }, AGORA)).toMatchObject({ ok: false, campos: ['agendado_para'] })
    expect(validarPost({ rede: 'facebook', tipo: 'fb_post', legenda: 'Só texto', midias: [], agendado_para: '2026-10-01T12:00:00Z' }, AGORA).ok).toBe(true)
    expect(validarPost({ rede: 'facebook', tipo: 'fb_post', legenda: '', midias: [], agendado_para: '2026-10-01T12:00:00Z' }, AGORA)).toMatchObject({ ok: false, campos: ['legenda'] })
  })

  it('caminho de mídia seguro e previsível', () => {
    expect(caminhoMidia('Minha Arte Fãs!.PNG', 'image/png', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', AGORA))
      .toBe('2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-minha-arte-fas.png')
  })
})

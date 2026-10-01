import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import { AuthProvider } from './auth/AuthProvider'
import { hojeSaoPaulo, somarDias } from './marketing/format'
import type { VisaoGeral } from './marketing/marketing-service'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listFactors: vi.fn(),
  invoke: vi.fn(),
  marketing: {
    configuracao: vi.fn(),
    conexoes: vi.fn(),
    conectarGoogle: vi.fn(),
    leads: vi.fn(),
    classificarLead: vi.fn(),
    visaoGeral: vi.fn(),
    campanhas: vi.fn(),
    campanhaMeta: vi.fn(),
    campanhaGoogle: vi.fn(),
    posts: vi.fn(),
    acoes: vi.fn(),
    locaisMeta: vi.fn(),
    locaisGoogle: vi.fn(),
    agentes: vi.fn(),
    criarCampanhaMeta: vi.fn(),
    editarMeta: vi.fn(),
    statusMeta: vi.fn(),
    criarCampanhaGoogle: vi.fn(),
    orcamentoGoogle: vi.fn(),
    statusGoogle: vi.fn(),
    agendarPost: vi.fn(),
    cancelarPost: vi.fn(),
    urlUpload: vi.fn(),
    convidarDot: vi.fn(),
    desligarDot: vi.fn(),
    religarDot: vi.fn(),
  },
  enviarMidia: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      mfa: { listFactors: mocks.listFactors, challengeAndVerify: vi.fn(), enroll: vi.fn(), unenroll: vi.fn() },
    },
    from: vi.fn(),
    rpc: vi.fn(async () => ({ data: [], error: null })),
    functions: { invoke: mocks.invoke },
  },
}))

vi.mock('./marketing/marketing-service', async (original) => ({
  ...(await original<typeof import('./marketing/marketing-service')>()),
  marketing: mocks.marketing,
  enviarMidia: mocks.enviarMidia,
}))

function token(aal: string) {
  return `h.${btoa(JSON.stringify({ aal })).replace(/=+$/, '')}.s`
}

function sessao(role: 'NO_ADMIN' | 'MARKETING_AGENT' | 'CLIENT', aal = 'aal1'): Session {
  return {
    access_token: token(aal), refresh_token: 'r', expires_in: 3600, token_type: 'bearer',
    user: { id: `${role}-id`, app_metadata: { role }, user_metadata: {}, aud: 'authenticated', created_at: '2026-09-30T00:00:00Z' },
  }
}

function abrir(caminho: string, s: Session | null) {
  mocks.getSession.mockResolvedValue({ data: { session: s }, error: null })
  window.history.pushState({}, '', caminho)
  return render(<BrowserRouter><AuthProvider><AppRoutes /></AuthProvider></BrowserRouter>)
}

const vazio = { gasto_centavos: 0, impressoes: 0, alcance: 0, cliques: 0, cliques_link: 0, conversoes: 0 }
const periodo = { id: '7d', de: '2026-09-23', ate: '2026-09-29', dias: 7, rotulo: 'Últimos 7 dias' }
const naoConfigurado = { ok: false as const, motivo: 'nao_configurado' as const, mensagem: 'Integração ainda não configurada.' }

function visao(): VisaoGeral {
  return {
    periodo,
    gerado_em: '2026-09-30T15:00:00Z',
    blocos: {
      meta_ads: { ok: true, cache: false, dados: { total: { ...vazio, gasto_centavos: 12345, cliques: 40, conversoes: 5, alcance: 900 }, por_dia: [{ dia: '2026-09-23', ...vazio, gasto_centavos: 12345 }] } },
      google_ads: naoConfigurado,
      ga4: { ok: false, motivo: 'falha', mensagem: 'Google: Request had insufficient authentication scopes.' },
      search_console: naoConfigurado,
      instagram: naoConfigurado,
      facebook: naoConfigurado,
      leads: { ok: true, cache: true, dados: { total: 7, validos: 7, por_classe: { real: 7, teste: 0, invalido: 0, duplicado: 0, a_classificar: 0 }, por_canal_validos: { meta: 4, google: 0, organico: 2, direto: 1, outros: 0 }, por_canal: { meta: 4, google: 0, organico: 2, direto: 1, outros: 0 }, por_dia: [{ dia: '2026-09-23', total: 7 }] } },
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.marketing.configuracao.mockResolvedValue({ papel: 'MARKETING_AGENT', meta: { token: true }, google: { criacao_liberada: false } })
  mocks.marketing.visaoGeral.mockResolvedValue(visao())
  mocks.marketing.campanhas.mockResolvedValue({ periodo, blocos: { meta: { ok: true, cache: false, dados: [] }, google: naoConfigurado } })
  mocks.marketing.posts.mockResolvedValue({ de: '2026-09-23', ate: '2026-11-04', posts: [] })
  mocks.marketing.acoes.mockResolvedValue({ acoes: [] })
  mocks.marketing.agentes.mockResolvedValue({ agentes: [] })
  mocks.marketing.conexoes.mockResolvedValue({ capacidades: [], google_escopos: null, meta_permissoes: null })
  mocks.marketing.leads.mockResolvedValue({ leads: [] })
})

describe('papéis no planner (R9, AC7, AC11)', () => {
  it('o dot entra direto na visão geral e não vê o menu Dot', async () => {
    abrir('/no/marketing', sessao('MARKETING_AGENT'))
    await waitFor(() => expect(window.location.pathname).toBe('/no/marketing/visao-geral'))
    const menu = await screen.findByRole('navigation', { name: 'Telas do planner' })
    expect(within(menu).getByRole('link', { name: 'Campanhas' })).toBeVisible()
    expect(within(menu).queryByRole('link', { name: 'Dot' })).toBeNull()
    expect(within(menu).queryByRole('link', { name: 'Voltar para projetos' })).toBeNull()
  })

  it.each(['/no/projetos', '/no/saldos', '/no/biblioteca', '/no/marketing/dot'])('o dot em %s vai para /nao-autorizado', async (caminho) => {
    abrir(caminho, sessao('MARKETING_AGENT'))
    await waitFor(() => expect(window.location.pathname).toBe('/nao-autorizado'))
  })

  it('CLIENT não entra no planner', async () => {
    abrir('/no/marketing/visao-geral', sessao('CLIENT'))
    await waitFor(() => expect(window.location.pathname).toBe('/nao-autorizado'))
    expect(mocks.marketing.visaoGeral).not.toHaveBeenCalled()
  })

  it('NO_ADMIN aal1 no planner volta para o segundo fator', async () => {
    mocks.listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: 'f1' }] }, error: null })
    abrir('/no/marketing/visao-geral', sessao('NO_ADMIN', 'aal1'))
    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(await screen.findByLabelText('Código de 6 dígitos')).toBeVisible()
    expect(mocks.marketing.visaoGeral).not.toHaveBeenCalled()
  })

  it('NO_ADMIN aal2 vê o menu Dot e o caminho de volta', async () => {
    abrir('/no/marketing/visao-geral', sessao('NO_ADMIN', 'aal2'))
    const menu = await screen.findByRole('navigation', { name: 'Telas do planner' })
    expect(within(menu).getByRole('link', { name: 'Dot' })).toBeVisible()
    expect(within(menu).getByRole('link', { name: 'Voltar para projetos' })).toBeVisible()
  })
})

describe('visão geral', () => {
  it('carregando, depois números em tabela e blocos indisponíveis com motivo', async () => {
    let soltar: (v: VisaoGeral) => void = () => undefined
    mocks.marketing.visaoGeral.mockReturnValue(new Promise((r) => { soltar = r }))
    abrir('/no/marketing/visao-geral?periodo=7d', sessao('MARKETING_AGENT'))
    expect(await screen.findByText('Buscando os números nas plataformas…')).toBeVisible()
    soltar(visao())

    const pago = await screen.findByRole('region', { name: 'Tráfego pago' })
    const tabelaPago = within(pago).getAllByRole('table')[0]
    expect(within(tabelaPago).getByRole('row', { name: /Gasto/ })).toHaveTextContent('R$ 123,45')
    expect(within(tabelaPago).getByRole('row', { name: /Custo por lead/ })).toHaveTextContent('R$ 24,69')
    expect(within(pago).getByRole('note')).toHaveTextContent('Google Ads indisponível — integração ainda não configurada.')
    expect(screen.getByRole('region', { name: 'Conversão' })).toHaveTextContent('GA4 indisponível — Google: Request had insufficient authentication scopes.')
    expect(screen.getByRole('table', { name: /Leads por canal/ })).toHaveTextContent('7')
    expect(screen.getByRole('img', { name: /Gasto por dia — Meta Ads/ })).toBeInTheDocument()
    expect(mocks.marketing.visaoGeral).toHaveBeenCalledWith('7d', false)
  })

  it('período na URL e botão de números frescos', async () => {
    abrir('/no/marketing/visao-geral?periodo=mes-passado', sessao('MARKETING_AGENT'))
    await screen.findByRole('region', { name: 'Tráfego pago' })
    expect(mocks.marketing.visaoGeral).toHaveBeenCalledWith('mes-passado', false)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Buscar números frescos (sem cache)' }))
    await waitFor(() => expect(mocks.marketing.visaoGeral).toHaveBeenLastCalledWith('mes-passado', true))
  })

  it('erro com tentar de novo', async () => {
    mocks.marketing.visaoGeral.mockRejectedValueOnce(new Error('rede'))
    abrir('/no/marketing/visao-geral', sessao('MARKETING_AGENT'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('region', { name: 'Tráfego pago' })).toBeVisible()
  })

  it('nenhuma integração respondeu', async () => {
    const v = visao()
    v.blocos.meta_ads = naoConfigurado
    v.blocos.leads = naoConfigurado
    mocks.marketing.visaoGeral.mockResolvedValue(v)
    abrir('/no/marketing/visao-geral', sessao('MARKETING_AGENT'))
    expect(await screen.findByText('Nenhuma integração respondeu ainda.')).toBeVisible()
  })
})

describe('campanhas', () => {
  it('lista vazia e bloco não configurado', async () => {
    abrir('/no/marketing/campanhas', sessao('MARKETING_AGENT'))
    expect(await screen.findByText('Nenhuma campanha Meta ainda.')).toBeVisible()
    expect(screen.getByText(/Google indisponível/)).toBeVisible()
  })

  it('lista com link para o detalhe', async () => {
    mocks.marketing.campanhas.mockResolvedValue({ periodo, blocos: { meta: { ok: true, cache: false, dados: [
      { plataforma: 'meta', id: '555', nome: '[teste hub] leads', status: 'PAUSED', status_efetivo: 'PAUSED', objetivo: 'OUTCOME_LEADS', orcamento_diario_centavos: null, orcamento_total_centavos: null, metricas: { ...vazio, gasto_centavos: 1000, conversoes: 2 } },
    ] }, google: null } })
    abrir('/no/marketing/campanhas', sessao('MARKETING_AGENT'))
    const link = await screen.findByRole('link', { name: '[teste hub] leads' })
    expect(link).toHaveAttribute('href', '/no/marketing/campanhas/meta/555?periodo=7d')
    expect(screen.getByRole('row', { name: /teste hub/ })).toHaveTextContent('R$ 5,00')
  })

  it('ativar passa por revisão com aviso de gasto e manda o request_id', async () => {
    mocks.marketing.campanhaMeta.mockResolvedValue({
      plataforma: 'meta', periodo,
      campanha: { id: '555', nome: '[teste hub] leads', status: 'PAUSED', status_efetivo: 'PAUSED', objetivo: 'OUTCOME_LEADS', inicio: null, fim: null },
      metricas: vazio, conjuntos: [], anuncios: [],
    })
    mocks.marketing.statusMeta.mockResolvedValue({ acao_id: 'acao-1', status: 'ok', resultado: { status: 'ACTIVE' }, ids_externos: { campaign_id: '555' } })
    abrir('/no/marketing/campanhas/meta/555', sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Ativar campanha' }))
    const revisao = screen.getByRole('region', { name: 'Ativar campanha Meta' })
    expect(revisao).toHaveTextContent('ATIVAR — passa a veicular e gastar')
    expect(revisao).toHaveTextContent('autorizar expressamente no chat')
    expect(mocks.marketing.statusMeta).not.toHaveBeenCalled()
    await u.click(within(revisao).getByRole('button', { name: 'Confirmar e executar' }))
    expect(mocks.marketing.statusMeta).toHaveBeenCalledWith('campaign', '555', { request_id: expect.stringMatching(/^[0-9a-f-]{36}$/), status: 'ACTIVE' })
    expect(await screen.findByRole('region', { name: 'Ativar campanha Meta' })).toHaveTextContent('acao-1')
  })
})

describe('nova campanha Meta', () => {
  it('formulário → revisão → confirmar; falha de rede repete o mesmo request_id', async () => {
    mocks.enviarMidia.mockResolvedValue('2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-arte.jpg')
    mocks.marketing.criarCampanhaMeta
      .mockRejectedValueOnce(new Error('rede caiu'))
      .mockResolvedValueOnce({ acao_id: 'acao-9', status: 'ok', resultado: { status_campanha: 'PAUSED', link: 'https://adsmanager.facebook.com/x' }, ids_externos: { campaign_id: '777', ad_id: '888' } })
    abrir('/no/marketing/campanhas/nova/meta', sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await u.type(await screen.findByLabelText('Nome da campanha'), '[[teste hub] leads')
    await u.type(screen.getByLabelText('Orçamento (R$)'), '20,00')
    await u.type(screen.getByLabelText('Início (horário de Brasília)'), '2026-10-01T09:00')
    await u.upload(screen.getByLabelText('Imagem do anúncio (JPG ou PNG)'), new File(['x'], 'arte.jpg', { type: 'image/jpeg' }))
    expect(await screen.findByText(/Arquivo 1: aaaaaaaa/)).toBeVisible()
    await u.type(screen.getByLabelText('Texto principal'), 'Seu sistema num nó só.')
    await u.type(screen.getByLabelText('Título'), 'Fale com a nó')
    await u.click(screen.getByRole('button', { name: 'Revisar campanha' }))

    const revisao = screen.getByRole('region', { name: 'Criar campanha Meta' })
    expect(revisao).toHaveTextContent('PAUSADA — nada é veiculado nem gasto até ativar')
    expect(revisao).toHaveTextContent('R$ 20,00 por dia')
    expect(revisao).toHaveTextContent('Brasil inteiro')
    await u.click(within(revisao).getByRole('button', { name: 'Confirmar e executar' }))
    expect(await within(revisao).findByRole('alert')).toBeVisible()
    await u.click(within(revisao).getByRole('button', { name: 'Confirmar e executar' }))

    const [primeira, segunda] = mocks.marketing.criarCampanhaMeta.mock.calls.map((c) => c[0])
    expect(primeira.request_id).toBe(segunda.request_id)
    expect(segunda).toMatchObject({
      nome: '[teste hub] leads', objetivo: 'OUTCOME_LEADS', orcamento: { tipo: 'diario', centavos: 2000 },
      inicio: '2026-10-01T12:00:00.000Z', publico: { paises: ['BR'] },
      criativo: { tipo: 'imagem', midia: '2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-arte.jpg', cta: 'LEARN_MORE' },
    })
    const resultado = await screen.findByRole('region', { name: 'Criar campanha Meta' })
    expect(resultado).toHaveTextContent('777')
    expect(within(resultado).getByRole('link', { name: 'Abrir no Gerenciador de Anúncios' })).toHaveAttribute('href', 'https://adsmanager.facebook.com/x')
    expect(screen.getByRole('link', { name: 'Ver a campanha 777 no planner' })).toBeVisible()
  })

  it('voltar e editar preserva o formulário e gera id novo', async () => {
    mocks.enviarMidia.mockResolvedValue('2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-arte.jpg')
    abrir('/no/marketing/campanhas/nova/meta', sessao('NO_ADMIN', 'aal2'))
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Revisar campanha' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Falta preencher: nome, orçamento, início, imagem, texto e título do anúncio.')
    await u.type(screen.getByLabelText('Nome da campanha'), 'Campanha X')
    expect(screen.getByLabelText('Nome da campanha')).toHaveValue('Campanha X')
  })
})

describe('nova campanha Google', () => {
  it('avisa que a criação está bloqueada e lê a sintaxe de palavras-chave', async () => {
    mocks.marketing.criarCampanhaGoogle.mockResolvedValue({ acao_id: 'a', status: 'ok', ids_externos: { campaign_id: '42' } })
    abrir('/no/marketing/campanhas/nova/google', sessao('MARKETING_AGENT'))
    expect(await screen.findByRole('note')).toHaveTextContent('bloqueada no servidor até a prova de acesso da API (V6)')
    const u = userEvent.setup()
    await u.type(screen.getByLabelText('Nome da campanha'), '[[teste hub] pesquisa')
    await u.type(screen.getByLabelText('Orçamento diário (R$)'), '15')
    await u.type(screen.getByLabelText(/Palavras-chave/), '[[sistema sob medida]\n"agência de sistemas"\nautomação')
    await u.type(screen.getByLabelText(/Títulos/), 'Sistemas sob medida\nFale com a nó\nNó tech stack')
    await u.type(screen.getByLabelText(/Descrições/), 'Tudo num lugar só.\nSistemas, pagamentos e operação.')
    await u.click(screen.getByRole('button', { name: 'Revisar campanha' }))
    const revisao = screen.getByRole('region', { name: 'Criar campanha Google de Pesquisa' })
    expect(revisao).toHaveTextContent('Brasil (2076)')
    await u.click(within(revisao).getByRole('button', { name: 'Confirmar e executar' }))
    expect(mocks.marketing.criarCampanhaGoogle.mock.calls[0][0]).toMatchObject({
      orcamento_diario_centavos: 1500, locais: ['2076'], idiomas: ['1014'],
      palavras_chave: [
        { texto: 'sistema sob medida', correspondencia: 'EXACT' },
        { texto: 'agência de sistemas', correspondencia: 'PHRASE' },
        { texto: 'automação', correspondencia: 'BROAD' },
      ],
    })
  })
})

// Período devolvido pela função para o valor pedido (eco), como faz parsePeriodo.
function periodoDe(valor: string) {
  if (!valor.includes('..')) return periodo
  const [de, ate] = valor.split('..')
  const br = (d: string) => d.split('-').reverse().join('/')
  const dias = Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000) + 1
  return { id: valor, de, ate, dias, rotulo: `${br(de)} a ${br(ate)}` }
}

const CUSTOM = '2026-09-22..2026-09-23'

// O erro do período aparece em texto dentro do próprio formulário (19).
async function erroDoFormulario() {
  const alerta = await screen.findByRole('alert')
  expect(alerta.closest('form')).toHaveAccessibleName('Período personalizado')
  return alerta
}

describe('período (T2 17–21)', () => {
  beforeEach(() => {
    mocks.marketing.visaoGeral.mockImplementation(async (p: string) => ({ ...visao(), periodo: periodoDe(p) }))
    mocks.marketing.campanhas.mockImplementation(async (p: string) => ({ periodo: periodoDe(p), blocos: { meta: { ok: true, cache: false, dados: [
      { plataforma: 'meta', id: '555', nome: 'TRAF - 20d - Agencias', status: 'ACTIVE', status_efetivo: 'ACTIVE', objetivo: 'OUTCOME_TRAFFIC', orcamento_diario_centavos: 2000, orcamento_total_centavos: null, metricas: { ...vazio, gasto_centavos: 17264 } },
    ] }, google: null } }))
  })

  it('17: De 22/09/2026 e Até 23/09/2026 → URL, pedido e título com o mesmo intervalo', async () => {
    abrir('/no/marketing/visao-geral', sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await screen.findByRole('region', { name: 'Tráfego pago' })
    await u.type(screen.getByLabelText('Data inicial'), '2026-09-22')
    await u.type(screen.getByLabelText('Data final'), '2026-09-23')
    await u.click(screen.getByRole('button', { name: 'Aplicar período' }))
    await waitFor(() => expect(window.location.search).toBe(`?periodo=${CUSTOM}`))
    await waitFor(() => expect(mocks.marketing.visaoGeral).toHaveBeenLastCalledWith(CUSTOM, false))
    expect(await screen.findByRole('heading', { name: '22/09/2026 a 23/09/2026' })).toBeVisible()
  })

  it('17: o pedido à marketing-hub leva periodo=2026-09-22..2026-09-23 sem codificar', async () => {
    const real = await vi.importActual<typeof import('./marketing/marketing-service')>('./marketing/marketing-service')
    mocks.invoke.mockResolvedValue({ data: { periodo: periodoDe(CUSTOM) }, error: null })
    await real.marketing.visaoGeral(CUSTOM)
    expect(mocks.invoke).toHaveBeenCalledWith(`marketing-hub/overview?periodo=${CUSTOM}`, { method: 'GET' })
  })

  it('20: reproduz a falha de 30/09 — data incompleta no campo não aplica e precisa dizer por quê', async () => {
    abrir('/no/marketing/visao-geral', sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await screen.findByRole('region', { name: 'Tráfego pago' })
    const chamadas = mocks.marketing.visaoGeral.mock.calls.length
    // Digitação parcial: o <input type="date"> devolve '' até a data estar completa.
    await u.type(screen.getByLabelText('Data inicial'), '2026-09')
    await u.type(screen.getByLabelText('Data final'), '2026-09-23')
    await u.click(screen.getByRole('button', { name: 'Aplicar período' }))
    expect(await erroDoFormulario()).toHaveTextContent('Preencha De e Até com datas completas')
    expect(window.location.search).toBe('')
    expect(mocks.marketing.visaoGeral).toHaveBeenCalledTimes(chamadas)
  })

  it('20/18: reproduz a falha de 30/09 — o menu leva o período para Campanhas, Registro e de volta', async () => {
    abrir(`/no/marketing/visao-geral?periodo=${CUSTOM}`, sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await screen.findByRole('region', { name: 'Tráfego pago' })
    const menu = screen.getByRole('navigation', { name: 'Telas do planner' })
    await u.click(within(menu).getByRole('link', { name: 'Campanhas' }))
    await waitFor(() => expect(window.location.pathname).toBe('/no/marketing/campanhas'))
    expect(window.location.search).toBe(`?periodo=${CUSTOM}`)
    await waitFor(() => expect(mocks.marketing.campanhas).toHaveBeenCalledWith(CUSTOM))
    expect(mocks.marketing.campanhas).not.toHaveBeenCalledWith('7d')
    await u.click(within(menu).getByRole('link', { name: 'Registro' }))
    await waitFor(() => expect(window.location.pathname).toBe('/no/marketing/registro'))
    expect(window.location.search).toBe(`?periodo=${CUSTOM}`)
    await u.click(within(menu).getByRole('link', { name: 'Visão geral' }))
    await waitFor(() => expect(window.location.pathname).toBe('/no/marketing/visao-geral'))
    expect(mocks.marketing.visaoGeral).toHaveBeenLastCalledWith(CUSTOM, false)
    expect(mocks.marketing.visaoGeral).not.toHaveBeenCalledWith('7d', false)
  })

  it('18: recarregar e voltar/avançar mantêm o período e os campos De e Até', async () => {
    abrir(`/no/marketing/visao-geral?periodo=${CUSTOM}`, sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await screen.findByRole('region', { name: 'Tráfego pago' })
    expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-09-22')
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-09-23')

    await u.click(screen.getByRole('link', { name: 'Últimos 7 dias' }))
    await waitFor(() => expect(window.location.search).toBe('?periodo=7d'))
    expect(screen.getByLabelText('Data inicial')).toHaveValue('')
    expect(screen.getByLabelText('Data final')).toHaveValue('')

    act(() => window.history.back())
    await waitFor(() => expect(window.location.search).toBe(`?periodo=${CUSTOM}`))
    await waitFor(() => expect(screen.getByLabelText('Data inicial')).toHaveValue('2026-09-22'))
    expect(screen.getByLabelText('Data final')).toHaveValue('2026-09-23')
    await waitFor(() => expect(mocks.marketing.visaoGeral).toHaveBeenLastCalledWith(CUSTOM, false))

    act(() => window.history.forward())
    await waitFor(() => expect(window.location.search).toBe('?periodo=7d'))
    await waitFor(() => expect(screen.getByLabelText('Data inicial')).toHaveValue(''))
    await waitFor(() => expect(mocks.marketing.visaoGeral).toHaveBeenLastCalledWith('7d', false))
  })

  it.each([
    ['De vazio', '', '2026-09-23', 'Preencha De e Até com datas completas'],
    ['Até vazio', '2026-09-22', '', 'Preencha De e Até com datas completas'],
    ['De maior que Até', '2026-09-23', '2026-09-22', 'De precisa ser igual ou anterior a Até'],
    ['Até depois de hoje', '2026-09-22', somarDias(hojeSaoPaulo(), 1), 'Até não pode ser depois de hoje'],
    ['mais de 366 dias', '2025-01-01', '2026-09-23', 'no máximo 366 dias'],
  ])('19: %s → erro em texto no formulário e nenhuma requisição', async (_caso, de, ate, mensagem) => {
    abrir('/no/marketing/visao-geral', sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await screen.findByRole('region', { name: 'Tráfego pago' })
    const chamadas = mocks.marketing.visaoGeral.mock.calls.length
    if (de) await u.type(screen.getByLabelText('Data inicial'), de)
    if (ate) await u.type(screen.getByLabelText('Data final'), ate)
    await u.click(screen.getByRole('button', { name: 'Aplicar período' }))
    expect(await erroDoFormulario()).toHaveTextContent(mensagem)
    expect(window.location.search).toBe('')
    expect(mocks.marketing.visaoGeral).toHaveBeenCalledTimes(chamadas)
  })

  it('19: exatamente 366 dias é aceito e o erro some', async () => {
    abrir('/no/marketing/visao-geral', sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    await screen.findByRole('region', { name: 'Tráfego pago' })
    await u.click(screen.getByRole('button', { name: 'Aplicar período' }))
    expect(await erroDoFormulario()).toBeVisible()
    await u.type(screen.getByLabelText('Data inicial'), '2025-09-23')
    await u.type(screen.getByLabelText('Data final'), '2026-09-23')
    await u.click(screen.getByRole('button', { name: 'Aplicar período' }))
    await waitFor(() => expect(window.location.search).toBe('?periodo=2025-09-23..2026-09-23'))
    expect(within(screen.getByRole('form', { name: 'Período personalizado' })).queryByRole('alert')).toBeNull()
  })

  it.each(['7d', '30d', 'mes-passado', CUSTOM])('21: menu e link de detalhe usam periodo=%s', async (valor) => {
    abrir(`/no/marketing/campanhas?periodo=${valor}`, sessao('NO_ADMIN', 'aal2'))
    const link = await screen.findByRole('link', { name: 'TRAF - 20d - Agencias' })
    expect(link).toHaveAttribute('href', `/no/marketing/campanhas/meta/555?periodo=${valor}`)
    const menu = screen.getByRole('navigation', { name: 'Telas do planner' })
    for (const nome of ['Visão geral', 'Campanhas', 'Calendário', 'Registro', 'Dot']) {
      expect(within(menu).getByRole('link', { name: nome }).getAttribute('href')).toMatch(new RegExp(`\\?periodo=${valor.replace(/\./g, '\\.')}$`))
    }
    expect(mocks.marketing.campanhas).toHaveBeenCalledWith(valor)
  })
})

describe('calendário, registro e dot', () => {
  it('agenda post com revisão e cancela outro', async () => {
    mocks.marketing.posts.mockResolvedValue({ de: '2026-09-23', ate: '2026-11-04', posts: [
      { id: 'p1', rede: 'facebook', tipo: 'fb_post', legenda: 'Post antigo', midias: [], agendado_para: '2026-10-02T15:00:00Z', publicado_em: null, status: 'scheduled', id_externo: null, erro: null, criado_por_papel: 'MARKETING_AGENT' },
    ] })
    mocks.enviarMidia.mockResolvedValue('2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.jpg')
    mocks.marketing.agendarPost.mockResolvedValue({ acao_id: 'a1', status: 'ok', ids_externos: { post_id: 'p2' } })
    mocks.marketing.cancelarPost.mockResolvedValue({ acao_id: 'a2', status: 'ok', ids_externos: { post_id: 'p1' } })
    abrir('/no/marketing/calendario', sessao('MARKETING_AGENT'))
    const u = userEvent.setup()
    expect(await screen.findByRole('row', { name: /Post antigo/ })).toHaveTextContent('agendado por dot')

    await u.upload(screen.getByLabelText('Mídia do post'), new File(['x'], 'foto.jpg', { type: 'image/jpeg' }))
    await u.type(screen.getByLabelText('Legenda'), 'Novo post')
    await u.type(screen.getByLabelText('Data e hora (horário de Brasília)'), '2026-10-05T10:30')
    await u.click(await screen.findByRole('button', { name: 'Revisar agendamento' }))
    const revisao = screen.getByRole('region', { name: 'Agendar post no Instagram' })
    expect(revisao).toHaveTextContent('publicação real')
    await u.click(within(revisao).getByRole('button', { name: 'Confirmar e executar' }))
    expect(mocks.marketing.agendarPost.mock.calls[0][0]).toMatchObject({
      rede: 'instagram', tipo: 'feed_image', legenda: 'Novo post', agendado_para: '2026-10-05T13:30:00.000Z',
      midias: ['2026/09/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa-foto.jpg'],
    })

    await u.click(await screen.findByRole('button', { name: 'Fechar resultado' }))
    await u.click(screen.getByRole('button', { name: 'Cancelar post' }))
    await u.click(within(screen.getByRole('region', { name: 'Cancelar post agendado' })).getByRole('button', { name: 'Confirmar e executar' }))
    expect(mocks.marketing.cancelarPost).toHaveBeenCalledWith('p1', expect.any(String))
  })

  it('registro mostra quem fez cada ação', async () => {
    mocks.marketing.acoes.mockResolvedValue({ acoes: [
      { id: 'x1', request_id: 'r1', actor_user_id: 'u', actor_role: 'MARKETING_AGENT', kind: 'meta.campanha.criar', target: 'meta', payload: {}, status: 'erro', result: null, external_ids: { campaign_id: '1' }, error: 'Meta 100: Invalid', created_at: '2026-09-30T15:00:00Z', finished_at: null },
    ] })
    abrir('/no/marketing/registro', sessao('NO_ADMIN', 'aal2'))
    const linha = await screen.findByRole('row', { name: /meta\.campanha\.criar/ })
    expect(linha).toHaveTextContent('dot')
    expect(linha).toHaveTextContent('Meta 100: Invalid')
    expect(linha).toHaveTextContent('campaign_id: 1')
  })

  it('NO_ADMIN convida o dot e recebe o link só na tela', async () => {
    mocks.marketing.convidarDot.mockResolvedValue({ acao_id: 'a', status: 'ok', ids_externos: { user_id: 'u1' }, convite_link: 'https://auth/convite' })
    abrir('/no/marketing/dot', sessao('NO_ADMIN', 'aal2'))
    const u = userEvent.setup()
    expect(await screen.findByText('Nenhuma conta de dot ainda.')).toBeVisible()
    await u.type(screen.getByLabelText('E-mail da conta do dot'), 'dot@notechstack.com.br')
    await u.click(screen.getByRole('button', { name: 'Revisar convite' }))
    await u.click(within(screen.getByRole('region', { name: 'Criar a conta do dot' })).getByRole('button', { name: 'Confirmar e executar' }))
    expect(await screen.findByLabelText('Link de convite (abrir no navegador do dot)')).toHaveValue('https://auth/convite')
  })
})

describe('primeira entrega: contratos visíveis T2', () => {
  it('1, 7, 14, 15: zero reais, CPL não calculável, testes excluídos e conta da resposta', async () => {
    const v = visao()
    if (v.blocos.leads.ok) Object.assign(v.blocos.leads.dados, { validos: 0, por_classe: { real: 0, teste: 10, invalido: 0, duplicado: 0, a_classificar: 0 } })
    if (v.blocos.meta_ads.ok) v.blocos.meta_ads.dados.conta = { id: 'act_1415926037237997', moeda: 'BRL', fuso: 'America/Sao_Paulo', versao_api: 'v25.0' }
    mocks.marketing.visaoGeral.mockResolvedValue(v)
    abrir('/no/marketing/visao-geral?periodo=2026-08-31..2026-09-29', sessao('MARKETING_AGENT'))
    expect(await screen.findByRole('group', { name: 'Leads válidos' })).toHaveTextContent('0')
    expect(screen.getByRole('group', { name: 'Custo por lead' })).toHaveTextContent('não calculável')
    expect(screen.getByRole('row', { name: /Testes excluídos/ })).toHaveTextContent('10')
    expect(screen.getByRole('group', { name: 'Gasto em anúncios' })).toHaveTextContent('só Meta — Google Ads indisponível')
    for (const valor of ['act_1415926037237997', 'BRL', 'America/Sao_Paulo', 'v25.0']) expect(screen.getByRole('table', { name: /Conta Meta Ads/ })).toHaveTextContent(valor)
    expect(screen.getAllByText(/inline_link_clicks/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/todos os cliques/).length).toBeGreaterThan(0)
  })
  it('6, 9: LPV ausente é indisponível, não zero', async () => {
    abrir('/no/marketing/visao-geral', sessao('MARKETING_AGENT'))
    const pago = await screen.findByRole('region', { name: 'Tráfego pago' })
    expect(within(pago).getByRole('row', { name: /Visualizações da página de destino/ })).toHaveTextContent('— indisponível')
    expect(within(pago).getByRole('row', { name: /Custo por LPV/ })).toHaveTextContent('— indisponível')
  })
  it('23: admin classifica sem recarregar e repetição após erro usa mesmo request_id', async () => {
    mocks.marketing.leads.mockResolvedValue({ leads: [{ id: 'l1', criado_em: '2026-09-25T12:00:00Z', canal: 'meta', nome: 'Exemplo', email: 'exemplo@example.test', classe: null }] })
    mocks.marketing.classificarLead.mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce({ status: 'ok', acao_id: 'a1' })
    abrir('/no/marketing/leads?periodo=30d', sessao('NO_ADMIN', 'aal2'))
    const row = await screen.findByRole('row', { name: /Exemplo/ })
    const u = userEvent.setup()
    expect(row).toHaveTextContent('a classificar')
    await u.click(within(row).getByRole('button', { name: 'Real' }))
    await within(row).findByRole('alert')
    await u.click(within(row).getByRole('button', { name: 'Real' }))
    await waitFor(() => expect(within(row).getByRole('status')).toHaveTextContent('Real'))
    expect(mocks.marketing.classificarLead.mock.calls[0]).toEqual(mocks.marketing.classificarLead.mock.calls[1])
    expect(mocks.marketing.leads).toHaveBeenCalledWith('30d')
  })
  it('23: lista vazia e 24: menu de leads exclusivo do admin', async () => {
    abrir('/no/marketing/leads', sessao('NO_ADMIN', 'aal2'))
    expect(await screen.findByText('Nenhum lead no período.')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Leads' })).toBeVisible()
  })
  it('24: dot não acessa leads nem dispara leitura pessoal', async () => {
    abrir('/no/marketing/leads', sessao('MARKETING_AGENT'))
    await waitFor(() => expect(window.location.pathname).toBe('/nao-autorizado'))
    expect(mocks.marketing.leads).not.toHaveBeenCalled()
  })
  it('10–12 e T1 20: dot lê diagnóstico sem botão OAuth ou menu leads', async () => {
    mocks.marketing.conexoes.mockResolvedValue({ capacidades: [{ id: 'meta.publicar', plataforma: 'meta', rotulo: 'Publicação IG', estado: 'nao_verificado', detalhe: null, correcao: 'Provar publicação' }], google_escopos: null, meta_permissoes: null })
    abrir('/no/marketing/conexoes', sessao('MARKETING_AGENT'))
    expect(await screen.findByRole('row', { name: /Publicação IG/ })).toHaveTextContent('não verificado')
    expect(screen.getByText('leitura funcionar não prova publicação')).toBeVisible()
    expect(screen.getAllByText('não informado pela plataforma')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Conectar Google' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Leads' })).toBeNull()
  })
  it.each(['state_invalido', 'access_denied', 'troca_falhou'])('T1 18–19: callback %s mostra erro e reconexão para admin', async motivo => {
    abrir(`/no/marketing/conexoes?google=erro&motivo=${motivo}`, sessao('NO_ADMIN', 'aal2'))
    expect(await screen.findByRole('button', { name: 'Conectar Google' })).toBeVisible()
    expect(screen.getByRole('alert')).toBeVisible()
  })
  it('T1 17: retorno bem-sucedido e contrato POST /google/connect', async () => {
    abrir('/no/marketing/conexoes?google=ok', sessao('NO_ADMIN', 'aal2'))
    expect(await screen.findByText('Google conectado. Consulte o diagnóstico abaixo.')).toBeVisible()
    const real = await vi.importActual<typeof import('./marketing/marketing-service')>('./marketing/marketing-service')
    mocks.invoke.mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' }, error: null })
    await real.marketing.conectarGoogle()
    expect(mocks.invoke).toHaveBeenCalledWith('marketing-hub/google/connect', { method: 'POST' })
  })
})

it('19: datas impossíveis na URL produzem erro em vez de RangeError', async () => {
  const { erroDoPeriodo } = await import('./marketing/periodo')
  for (const de of ['2026-99-01', '2026-02-30', '2026-00-01']) expect(erroDoPeriodo(de, '2026-09-23', '2026-10-01')).toMatch(/datas completas/)
})

it('4–5: campanha expõe LPV, custo e objetivo com otimização na mesma linha', async () => {
  mocks.marketing.campanhaMeta.mockResolvedValue({ plataforma: 'meta', periodo, campanha: { id: '555', nome: 'TRAF - 20d - Agencias', status: 'PAUSED', objetivo: 'OUTCOME_TRAFFIC' }, metricas: { ...vazio, gasto_centavos: 10000, lpv: 50, cliques_link: 100 }, conjuntos: [{ id: 'a', nome: 'Conjunto', status: 'PAUSED', orcamento_diario_centavos: 1000, orcamento_total_centavos: null, otimizacao: 'LANDING_PAGE_VIEWS' }], anuncios: [] })
  abrir('/no/marketing/campanhas/meta/555', sessao('MARKETING_AGENT'))
  const t = await screen.findByRole('table', { name: 'Objetivo, otimização e resultado' })
  const row = within(t).getByRole('row', { name: /OUTCOME_TRAFFIC/ })
  expect(row).toHaveTextContent('LANDING_PAGE_VIEWS')
  expect(row).toHaveTextContent('Visualizações da página de destino')
  expect(row).toHaveTextContent('50')
  expect(row).toHaveTextContent('R$ 2,00')
  expect(screen.getByRole('row', { name: /LPV por clique no link/ })).toHaveTextContent('diagnóstico, não funil individual')
})

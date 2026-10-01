import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { expect, test, type Page, type Route } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { cadastrarTotp, totp } from './mfa'

// Planner /no/marketing: papéis, MFA do NO_ADMIN e o dot operando pela tela.
// Contas reais no Auth local; respostas da marketing-hub mockadas (nada vai à Meta/Google).

const evidencias = path.resolve(process.cwd(), '..', 'docs', 'movimentos', '2026-09-30-hub-marketing-agentes', 'evidencias')

function ambiente() {
  const out = execFileSync('supabase', ['status', '-o', 'env'], { cwd: path.resolve(process.cwd(), '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const v = new Map(out.split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="(.*)"$/)).filter((m): m is RegExpMatchArray => Boolean(m)).map((m) => [m[1], m[2]]))
  return { apiUrl: v.get('API_URL')!, serviceRoleKey: v.get('SERVICE_ROLE_KEY')! }
}

type Contas = { senha: string; admin: string; adminTotp: string; adminNovo: string; dot: string; ids: string[] }
let contas: Contas | undefined

const vazio = { gasto_centavos: 0, impressoes: 0, alcance: 0, cliques: 0, cliques_link: 0, conversoes: 0 }
const periodo = { id: '7d', de: '2026-09-23', ate: '2026-09-29', dias: 7, rotulo: 'Últimos 7 dias' }
const dias = Array.from({ length: 7 }, (_, i) => `2026-09-2${3 + i}`)
const visao = {
  periodo,
  gerado_em: '2026-09-30T15:00:00Z',
  blocos: {
    meta_ads: { ok: true, cache: false, dados: { total: { ...vazio, gasto_centavos: 45678, cliques: 210, conversoes: 9, alcance: 5400, impressoes: 12000, cliques_link: 180 }, por_dia: dias.map((dia, i) => ({ dia, ...vazio, gasto_centavos: 5000 + i * 700 })) } },
    google_ads: { ok: true, cache: false, dados: { total: { ...vazio, gasto_centavos: 21000, cliques: 95, conversoes: 3.5, alcance: null, cliques_link: null }, por_dia: dias.map((dia, i) => ({ dia, ...vazio, gasto_centavos: 3000 - i * 100 })) } },
    ga4: { ok: true, cache: true, dados: { sessoes: 830, eventos_chave: 14, por_canal: [{ canal: 'Paid Social', sessoes: 400, usuarios: 350, eventos_chave: 8 }, { canal: 'Paid Search', sessoes: 200, usuarios: 180, eventos_chave: 4 }, { canal: 'Organic Search', sessoes: 230, usuarios: 210, eventos_chave: 2 }], por_dia: dias.map((dia, i) => ({ dia, sessoes: 100 + i * 5, eventos_chave: 2 })), eventos: [{ evento: 'lead_submit', total: 14 }], google_ads_segundo_ga4: { gasto_centavos: 20990, cliques: 95, impressoes: 3100 } } },
    search_console: { ok: true, cache: true, dados: { site: 'sc-domain:notechstack.com.br', cliques: 120, impressoes: 4300, ctr: 0.0279, por_dia: dias.map((dia, i) => ({ dia, cliques: 15 + i, impressoes: 600 })), consultas: [{ chave: 'nó tech stack', cliques: 40, impressoes: 90, ctr: 0.44, posicao: 1.1 }], paginas: [{ chave: 'https://www.notechstack.com.br/roteador', cliques: 50, impressoes: 900, ctr: 0.05, posicao: 4.2 }], paginas_que_cresceram: [{ chave: 'https://www.notechstack.com.br/roteador', cliques: 50, impressoes: 900, ctr: 0.05, posicao: 4.2, cliques_antes: 20, variacao: 30 }], comparado_com: { de: '2026-09-16', ate: '2026-09-22' } } },
    instagram: { ok: true, cache: false, dados: { usuario: 'notechstack', seguidores: 1850, alcance: 9300, visualizacoes: 21000, contas_engajadas: 410, interacoes: 780, aproximado: false, posts: [{ id: 'm1', rede: 'instagram', data: '2026-09-25T15:00:00Z', tipo: 'reel', texto: 'Seu sistema num nó só', link: 'https://instagram.com/p/x', alcance: 5200, visualizacoes: 9000, interacoes: 400, curtidas: 350, comentarios: 30, compartilhamentos: 20 }] } },
    facebook: { ok: false, motivo: 'nao_configurado', mensagem: 'Integração ainda não configurada.' },
    leads: { ok: true, cache: true, dados: { total: 12, por_canal: { meta: 7, google: 3, organico: 1, direto: 1, outros: 0 }, por_dia: dias.map((dia, i) => ({ dia, total: i % 3 })) } },
  },
}

async function mockHub(page: Page, criadas: Record<string, unknown>[] = []) {
  await page.route('**/functions/v1/marketing-hub/**', async (route: Route) => {
    const url = new URL(route.request().url())
    const caminho = url.pathname.split('/marketing-hub')[1]
    const cors = {
      'access-control-allow-origin': 'http://127.0.0.1:5174',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type, x-region',
      'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: cors })
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
    if (caminho === '/overview') return json(visao)
    if (caminho === '/campaigns') return json({ periodo, blocos: { meta: { ok: true, cache: false, dados: [] }, google: { ok: true, cache: false, dados: [] } } })
    if (caminho === '/config') return json({ papel: 'MARKETING_AGENT', meta: { token: true }, google: { criacao_liberada: true } })
    if (caminho === '/media') return json({ caminho: `2026/09/${randomUUID()}-arte.jpg`, url_upload: 'x', token: 'tok' })
    if (caminho === '/meta/campaigns') {
      criadas.push(JSON.parse(route.request().postData() ?? '{}'))
      return json({ acao_id: 'acao-e2e', status: 'ok', resultado: { status_campanha: 'PAUSED', link: 'https://adsmanager.facebook.com/adsmanager' }, ids_externos: { campaign_id: '120000000000001', ad_id: '120000000000004' } })
    }
    return json({ error_code: 'NOT_FOUND', mensagem: `sem mock para ${caminho}` }, 404)
  })
  await page.route('**/storage/v1/object/upload/sign/marketing-media/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{"Key":"marketing-media/x"}' }))
}

async function entrar(page: Page, email: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(contas!.senha)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function semRolagemLateral(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
}

test.describe('Hub de marketing · planner, papéis e MFA', () => {
  test.setTimeout(90_000)

  test.beforeAll(async () => {
    const { apiUrl, serviceRoleKey } = ambiente()
    const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } })
    const nonce = randomUUID().slice(0, 8)
    const senha = `Hub-${randomUUID()}!aA1`
    const emails = { admin: `hub-admin-${nonce}@example.test`, adminNovo: `hub-admin2-${nonce}@example.test`, dot: `hub-dot-${nonce}@example.test` }
    const criados = await Promise.all([
      admin.auth.admin.createUser({ email: emails.admin, password: senha, email_confirm: true, app_metadata: { role: 'NO_ADMIN' } }),
      admin.auth.admin.createUser({ email: emails.adminNovo, password: senha, email_confirm: true, app_metadata: { role: 'NO_ADMIN' } }),
      admin.auth.admin.createUser({ email: emails.dot, password: senha, email_confirm: true, app_metadata: { role: 'MARKETING_AGENT' } }),
    ])
    for (const c of criados) if (c.error || !c.data.user) throw c.error ?? new Error('conta de teste não criada')
    contas = { senha, ...emails, adminTotp: await cadastrarTotp(emails.admin, senha), ids: criados.map((c) => c.data.user!.id) }
  })

  test.afterAll(async () => {
    if (!contas) return
    const { apiUrl, serviceRoleKey } = ambiente()
    const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } })
    await Promise.all(contas.ids.map((id) => admin.auth.admin.deleteUser(id)))
  })

  test('o dot entra direto no planner e lê a visão geral pela tela', async ({ page }, info) => {
    await mockHub(page)
    await entrar(page, contas!.dot)
    await expect(page).toHaveURL(/\/no\/marketing\/visao-geral$/)
    await expect(page.getByRole('region', { name: 'Tráfego pago' })).toContainText('R$ 456,78')
    await expect(page.getByRole('region', { name: 'Busca orgânica' })).toContainText('notechstack.com.br/roteador')
    await expect(page.getByRole('navigation', { name: 'Telas do planner' }).getByRole('link', { name: 'Dot' })).toHaveCount(0)
    await semRolagemLateral(page)
    await page.screenshot({ path: path.join(evidencias, `planner-visao-geral-${info.project.name}.png`), fullPage: true })

    await page.goto('/no/projetos')
    await expect(page).toHaveURL(/\/nao-autorizado$/)
    await page.goto('/no/marketing/dot')
    await expect(page).toHaveURL(/\/nao-autorizado$/)
  })

  test('o dot cria uma campanha Meta pela mesma tela, com revisão', async ({ page }, info) => {
    const criadas: Record<string, unknown>[] = []
    await mockHub(page, criadas)
    await entrar(page, contas!.dot)
    await expect(page).toHaveURL(/\/no\/marketing\/visao-geral$/)
    await page.goto('/no/marketing/campanhas/nova/meta')
    await page.getByLabel('Nome da campanha').fill('[teste hub] e2e')
    await page.getByLabel('Orçamento (R$)').fill('20,00')
    await page.getByLabel('Início (horário de Brasília)').fill('2026-10-01T09:00')
    await page.getByLabel('Imagem do anúncio (JPG ou PNG)').setInputFiles({ name: 'arte.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff]) })
    await expect(page.getByText(/Arquivo 1:/)).toBeVisible()
    await page.getByLabel('Texto principal').fill('Seu sistema num nó só.')
    await page.getByLabel('Título').fill('Fale com a nó')
    await page.getByRole('button', { name: 'Revisar campanha' }).click()
    const revisao = page.getByRole('region', { name: 'Criar campanha Meta' })
    await expect(revisao).toContainText('PAUSADA — nada é veiculado nem gasto até ativar')
    await semRolagemLateral(page)
    await page.screenshot({ path: path.join(evidencias, `planner-revisao-meta-${info.project.name}.png`), fullPage: true })
    await revisao.getByRole('button', { name: 'Confirmar e executar' }).click()
    await expect(page.getByRole('region', { name: 'Criar campanha Meta' })).toContainText('120000000000001')
    expect(criadas).toHaveLength(1)
    expect(criadas[0]).toMatchObject({ nome: '[teste hub] e2e', orcamento: { tipo: 'diario', centavos: 2000 }, inicio: '2026-10-01T12:00:00.000Z' })
  })

  test('NO_ADMIN com fator: senha → código → /no/projetos → link Marketing', async ({ page }) => {
    await mockHub(page)
    await entrar(page, contas!.admin)
    await expect(page.getByLabel('Código de 6 dígitos')).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto('/no/projetos')
    await expect(page).toHaveURL(/\/login$/)
    await page.getByLabel('Código de 6 dígitos').fill(totp(contas!.adminTotp))
    await page.getByRole('button', { name: 'Confirmar código' }).click()
    await expect(page).toHaveURL(/\/no\/projetos$/)
    await page.getByRole('link', { name: 'Marketing' }).click()
    await expect(page).toHaveURL(/\/no\/marketing\/visao-geral$/)
    await expect(page.getByRole('navigation', { name: 'Telas do planner' }).getByRole('link', { name: 'Dot' })).toBeVisible()
  })

  test('NO_ADMIN sem fator cadastra o TOTP no primeiro login', async ({ page }, info) => {
    await entrar(page, contas!.adminNovo)
    await expect(page.getByRole('heading', { name: /Ative o segundo fator/ })).toBeVisible()
    await expect(page.getByAltText('QR code do segundo fator')).toBeVisible()
    await semRolagemLateral(page)
    await page.screenshot({ path: path.join(evidencias, `mfa-cadastro-${info.project.name}.png`), fullPage: true })
    const segredo = (await page.getByTestId('mfa-secret').textContent())!.trim()
    await page.getByLabel('Código de 6 dígitos').fill(totp(segredo))
    await page.getByRole('button', { name: 'Confirmar código' }).click()
    await expect(page).toHaveURL(/\/no\/projetos$/)
    // Fator já verificado: o segundo login cai no desafio, não num cadastro novo.
    await page.evaluate(() => localStorage.clear())
    await entrar(page, contas!.adminNovo)
    await expect(page.getByRole('heading', { name: /Confirme que é você/ })).toBeVisible()
  })
})

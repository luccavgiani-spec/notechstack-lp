import { expect, test } from '@playwright/test'
import { cleanupR106Fixture, createR106Fixture, type R106Fixture } from './r1-06-fixture'

test.describe('R1-06 · dashboard operacional da Nó', () => {
  test.setTimeout(120_000)
  let fixture: R106Fixture | undefined

  test.beforeAll(async () => {
    fixture = await createR106Fixture()
  })

  test.afterAll(async () => {
    await cleanupR106Fixture(fixture)
  })

  test('R1-06 C1-C21 · admin percorre projetos, ficha, atividade e CLIENT é barrado', async ({ page, isMobile }) => {
    if (!fixture) throw new Error('R1-06 fixture is unavailable')

    const failures: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()) })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`) })

    await page.goto('/login')
    await page.getByLabel('E-mail').fill(fixture.adminEmail)
    await page.getByLabel('Senha').fill(fixture.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/no\/projetos$/)
    await expect(page.getByRole('heading', { name: 'Todos os projetos.' })).toBeVisible()
    await expect(page.getByText('Cliente E2E R1-06').first()).toBeVisible()
    await expect(page.getByText('Projeto E2E R1-06').first()).toBeVisible()
    await expect(page.getByLabel('Buscar projetos')).toBeVisible()
    await expect(page.getByLabel('Nicho')).toBeVisible()
    await expect(page.getByLabel('Estado')).toBeVisible()
    await expect(page.getByLabel('Tier')).toBeVisible()
    await expect(page.getByLabel('Prazo')).toBeVisible()
    await expect(page.getByLabel('Pagamento', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Conversão')).toBeVisible()
    await expect(page.getByLabel('Situação')).toBeVisible()

    const card = page.locator(`a[href="/no/projetos/${fixture.projectId}"]`)
    await expect(card).toBeVisible()
    await page.getByLabel('Buscar projetos').fill('Projeto E2E R1-06')
    await expect(card).toHaveCount(1)
    await page.getByLabel('Buscar projetos').fill('não existe')
    await expect(page.getByText('Nenhum projeto para os filtros selecionados.')).toBeVisible()
    await page.getByLabel('Buscar projetos').fill('')
    await card.click()

    await expect(page.getByRole('heading', { name: 'Projeto E2E R1-06' })).toBeVisible()
    for (const label of ['Identificação', 'Diagnóstico', 'Comercial', 'Execução', 'Entregáveis', 'Kanban do projeto']) {
      await expect(page.getByRole('heading', { name: label })).toBeVisible()
    }
    await expect(page.getByText('Primeira entrega')).toBeVisible()
    await page.getByLabel('Forma de pagamento').fill('pix')
    await page.getByLabel('Prazo (dias)').fill('15')
    await page.getByLabel('Valor (centavos)').fill('125000')
    await page.getByRole('button', { name: 'Salvar comercial' }).click()
    await expect(page.getByText('Salvo e registrado na atividade.')).toBeVisible()
    await page.getByRole('button', { name: 'Converter' }).click()
    await expect(page.getByRole('heading', { name: 'Confirmar conversão?' })).toBeVisible()
    await page.getByRole('button', { name: 'Cancelar' }).click()
    await expect(page.getByRole('heading', { name: 'Confirmar conversão?' })).toHaveCount(0)

    await page.goto('/no/atividade')
    await expect(page.getByRole('tablist', { name: 'Visões de atividade' })).toBeVisible()
    const views = ['Hoje', 'Ontem', 'Pendências', 'Atrasados', 'Últimos 7 dias', 'Por projeto', 'Por evento']
    await expect(page.getByRole('tab')).toHaveText(views)
    await page.getByRole('tab', { name: 'Hoje' }).click()
    await expect(page.getByText(/project\.converted|commercial_terms\.updated/).first()).toBeVisible()
    if (isMobile) {
      await expect(page.getByRole('tablist', { name: 'Visões de atividade' })).toBeVisible()
    }

    await page.evaluate(() => localStorage.clear())
    await page.goto('/login')
    await page.reload()
    await page.getByLabel('E-mail').fill(fixture.clientEmail)
    await page.getByLabel('Senha').fill(fixture.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).not.toHaveURL(/\/login$/)
    await page.goto('/no/projetos')
    await expect(page).toHaveURL(/\/nao-autorizado$/)
    await expect(page.getByRole('heading', { name: 'Acesso não autorizado.' })).toBeVisible()

    expect(failures).toEqual([])
  })
})

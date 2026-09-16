import { expect, test, type Page } from '@playwright/test'
import { cleanupF311Fixture, createF311Fixture, type F311Fixture } from './f3-11-fixture'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

test.describe('F3-11 · saldos operacionais', () => {
  test.setTimeout(120_000)
  let fixture: F311Fixture | undefined
  test.beforeAll(async () => { fixture = await createF311Fixture() })
  test.afterAll(async () => { await cleanupF311Fixture(fixture) })

  test('F3-11 C1-C13 · admin consulta saldos, recebe parcela e CLIENT é barrado', async ({ page }) => {
    if (!fixture) throw new Error('F3-11 fixture is unavailable')
    const failures: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()) })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`) })

    await login(page, fixture.adminEmail, fixture.password)
    await page.goto('/no/saldos')
    for (const heading of ['Realizado', 'Pendente', 'Previsto', 'Projeção por janela']) {
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    }
    await expect(page.getByRole('link', { name: fixture.projectName }).first()).toHaveAttribute('href', `/no/projetos/${fixture.projectId}`)
    await expect(page.getByText('aprovacao').first()).toBeVisible()
    await expect(page.getByText('tentativa').first()).toBeVisible()
    await expect(page.getByText('parcela_vencida').first()).toBeVisible()
    await expect(page.getByText('R$ 149,90').first()).toBeVisible()
    await expect(page.getByText('R$ 1.000,00').first()).toBeVisible()
    for (const days of ['15', '30', '45']) await expect(page.getByText(`Até ${days} dias`)).toBeVisible()

    const projectedInstallment = page.locator('li').filter({ hasText: fixture.projectName }).filter({ hasText: 'R$ 1.000,00' }).first()
    await projectedInstallment.getByRole('button', { name: 'Marcar recebida' }).click()
    await expect(page.getByRole('dialog')).toContainText('Confirmar recebimento?')
    await page.getByRole('button', { name: 'Confirmar recebimento' }).click()
    await expect(page.getByText('Parcela marcada como recebida.', { exact: true })).toBeVisible()
    await page.reload()
    await expect(page.getByText('recebimento').first()).toBeVisible()

    await page.evaluate(() => localStorage.clear())
    await login(page, fixture.clientEmail, fixture.password)
    await page.goto('/no/saldos')
    await expect(page).toHaveURL(/\/nao-autorizado$/)
    await expect(page.getByRole('heading', { name: 'Acesso não autorizado.' })).toBeVisible()
    expect(failures).toEqual([])
  })
})

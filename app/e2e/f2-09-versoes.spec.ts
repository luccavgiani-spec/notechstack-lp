import { expect, test, type Page } from '@playwright/test'
import { cleanupF209Fixture, createF209Fixture, type F209Fixture } from './f2-09-fixture'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

async function publish(page: Page, values: { label: string; macro: 'V1' | 'V2' | 'V3'; changelog: string; build: string }) {
  await page.getByLabel('Rótulo').fill(values.label)
  await page.getByLabel('Marco').selectOption(values.macro)
  await page.getByLabel('Changelog').fill(values.changelog)
  await page.getByLabel('Referência da build').fill(values.build)
  await page.getByRole('button', { name: 'Publicar versão' }).click()
  await expect(page.getByText(`Confirmar publicação de ${values.label}?`)).toBeVisible()
  const responsePromise = page.waitForResponse((response) => response.url().includes('/functions/v1/project-publish-version') && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Confirmar publicação' }).click()
  expect((await responsePromise).status()).toBe(200)
  await expect(page.getByText(`Confirmar publicação de ${values.label}?`)).toHaveCount(0)
}

test.describe('F2-09 · ciclo de versões', () => {
  test.setTimeout(120_000)
  let fixture: F209Fixture | undefined

  test.beforeAll(async () => { fixture = await createF209Fixture() })
  test.afterAll(async () => { await cleanupF209Fixture(fixture) })

  test('F2-09 C1-C15 · publica V1, intermediária, V2 e V3 e preserva o histórico CLIENT', async ({ page }) => {
    if (!fixture) throw new Error('F2-09 fixture is unavailable')
    const failures: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()) })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`) })

    await login(page, fixture.adminEmail, fixture.password)
    await expect(page).toHaveURL(/\/no\/projetos$/)
    await page.goto(`/no/projetos/${fixture.projectId}`)
    await expect(page.getByText('Estado atual: Agendado')).toBeVisible()
    await page.getByRole('button', { name: 'Avançar para V1 em desenvolvimento' }).click()
    await expect(page.getByText('Estado atual: V1 em desenvolvimento')).toBeVisible()

    await publish(page, { label: 'V1', macro: 'V1', changelog: 'Primeira entrega navegável', build: 'build-e2e-v1' })
    await publish(page, { label: 'V1.1', macro: 'V1', changelog: 'Ajuste intermediário', build: 'build-e2e-v1-1' })
    await page.getByRole('button', { name: 'Avançar para Em revisão pelo cliente' }).click()
    await expect(page.getByText('Estado atual: Em revisão pelo cliente')).toBeVisible()
    await page.getByRole('button', { name: 'Avançar para Alterações recebidas' }).click()
    await expect(page.getByText('Estado atual: Alterações recebidas')).toBeVisible()
    await page.getByRole('button', { name: 'Avançar para V2 em desenvolvimento' }).click()
    await expect(page.getByText('Estado atual: V2 em desenvolvimento')).toBeVisible()
    await publish(page, { label: 'V2', macro: 'V2', changelog: 'Segunda macro entregue', build: 'build-e2e-v2' })
    await publish(page, { label: 'V3', macro: 'V3', changelog: 'Go-live entregue', build: 'build-e2e-v3' })
    await expect(page.getByRole('button', { name: 'Concluir projeto' })).toBeVisible()
    await page.getByRole('button', { name: 'Concluir projeto' }).click()
    await expect(page.getByText('Confirmar conclusão?')).toBeVisible()
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
    await expect(page.getByText('Estado atual: Concluído')).toBeVisible()

    await page.evaluate(() => localStorage.clear())
    await login(page, fixture.clientEmail, fixture.password)
    await page.goto(`/p/${fixture.projectId}/versoes`)
    await expect(page.getByRole('heading', { name: 'Versões do projeto' })).toBeVisible()
    const labels = page.locator('ol h3')
    await expect(labels).toHaveText(['V3', 'V2', 'V1.1', 'V1'])
    await expect(page.getByText('Build: build-e2e-v3')).toBeVisible()
    await expect(page.getByText('Build: build-e2e-v1', { exact: true })).toBeVisible()
    await expect(page.getByText('Atual')).toHaveCount(1)
    await expect(page.getByRole('button', { name: /publicar|concluir/i })).toHaveCount(0)

    expect(failures).toEqual([])
  })
})

import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { cleanupR107Fixture, createR107Fixture, setHelloAccessOffset, type R107Fixture } from './r1-07-fixture'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}

test.describe('R1-07 · pipeline e exemplos', () => {
  test.setTimeout(120_000)
  let fixture: R107Fixture | undefined
  test.beforeAll(async () => { fixture = await createR107Fixture() })
  test.afterAll(async () => { await cleanupR107Fixture(fixture) })

  test('C7-C11 · exemplos, isolamento, expiração e protótipo', async ({ page }, testInfo) => {
    if (!fixture) throw new Error('R1-07 fixture is unavailable')
    const failures: string[] = []
    page.on('console', (message) => { if (message.type() === 'error') failures.push(message.text()) })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => { if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`) })
    await page.route('https://hello-best.lovable.app/**', (route) => route.fulfill({ contentType: 'text/html', body: '<main><h1>Protótipo Hello Best</h1></main>' }))

    await login(page, fixture.gazetaEmail, fixture.password)
    await page.goto(`/p/${fixture.gazetaProjectId}/etapas`)
    await expect(page.getByRole('heading', { name: '63% concluído' })).toBeVisible()
    for (const phase of ['Fase 0 · Preparação', 'Fase 1 · Frontend', 'Fase 2 · Migração e Backup', 'Fase 3 · Editorial e Backend', 'Fase 4 · Go-live']) {
      await expect(page.getByText(phase).first()).toBeVisible()
    }
    await expect(page.getByText('Acompanhamento somente leitura')).toBeVisible()
    await expect(page.locator('main button')).toHaveCount(0)
    const evidenceDir = path.resolve(process.cwd(), 'test-results', 'r1-07')
    fs.mkdirSync(evidenceDir, { recursive: true })
    await page.screenshot({ path: path.join(evidenceDir, `c10-${testInfo.project.name}.png`), fullPage: true })
    await page.goto(`/p/${fixture.helloProjectId}/como-funciona`)
    await expect(page.getByRole('heading', { name: 'Projeto não disponível.' })).toBeVisible()

    await page.evaluate(() => localStorage.clear())
    await login(page, fixture.helloEmail, fixture.password)
    await page.goto(`/p/${fixture.gazetaProjectId}/como-funciona`)
    await expect(page.getByRole('heading', { name: 'Projeto não disponível.' })).toBeVisible()
    await page.goto(`/p/${fixture.helloProjectId}/prototipo`)
    const frame = page.locator('iframe[title="Protótipo navegável do projeto"]')
    await expect(frame).toHaveAttribute('src', 'https://hello-best.lovable.app')
    await expect(page.getByRole('link', { name: /Abrir protótipo em nova aba/ })).toHaveAttribute('href', 'https://hello-best.lovable.app')
    await page.screenshot({ path: path.join(evidenceDir, `c11-${testInfo.project.name}.png`), fullPage: true })

    await setHelloAccessOffset(fixture, 30_000)
    await page.goto(`/p/${fixture.helloProjectId}/como-funciona`)
    await expect(page.getByText('Seu acesso de análise fica disponível por 15 dias.')).toBeVisible()
    await setHelloAccessOffset(fixture, -30_000)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Sua janela de análise terminou.' })).toBeVisible()
    await page.screenshot({ path: path.join(evidenceDir, `c8-${testInfo.project.name}.png`), fullPage: true })

    await page.evaluate(() => localStorage.clear())
    await login(page, fixture.adminEmail, fixture.password)
    await page.goto(`/no/projetos/${fixture.helloProjectId}`)
    await expect(page.getByRole('heading', { name: 'Hello Best — Projeto em produção' })).toBeVisible()
    await expect(page.getByText('https://hello-best.lovable.app', { exact: true })).toBeVisible()
    expect(failures).toEqual([])
  })
})

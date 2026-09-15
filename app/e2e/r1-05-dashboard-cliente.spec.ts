import { expect, test } from '@playwright/test'
import { cleanupR105Fixture, createR105Fixture, type R105Fixture } from './r1-05-fixture'

test.describe('R1-05 · dashboard do cliente', () => {
  test.setTimeout(120_000)
  let fixture: R105Fixture | undefined

  test.beforeAll(async () => {
    fixture = await createR105Fixture()
  })

  test.afterAll(async () => {
    await cleanupR105Fixture(fixture)
  })

  test('C17 história completa nas duas larguras', async ({ page, isMobile }) => {
    if (!fixture) throw new Error('R1-05 fixture is unavailable')

    const failures: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text())
    })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`)
    })
    await page.route('https://prototype.local/**', async (route) => {
      const isSecond = route.request().url().endsWith('/second')
      await route.fulfill({
        contentType: 'text/html',
        body: isSecond
          ? '<main><h1>Segunda tela</h1></main>'
          : '<main><h1>Primeira tela</h1><a href="/second">Avancar</a></main>',
      })
    })

    await page.goto('/login')
    await page.getByLabel('E-mail').fill(fixture.email)
    await page.getByLabel('Senha').fill(fixture.password)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/p\/projetos$/)

    await page.goto(`/p/${fixture.activeProjectId}/como-funciona`)
    await expect(page.getByRole('heading', { name: 'Seu primeiro plano está pronto.' })).toBeVisible()
    await expect(page.getByText('Seu acesso de análise fica disponível por 15 dias.')).toBeVisible()

    const nav = page.getByRole('navigation', { name: 'Módulos do projeto' })
    const labels = ['01 Como funciona', '02 Protótipo', '03 Etapas do plano', '04 Editor', '05 Versões', '06 Marca & arquivos']
    for (const label of labels) await expect(nav.getByRole('link', { name: label })).toBeVisible()
    await expect(nav.getByRole('link', { name: '01 Como funciona' })).toHaveAttribute('aria-current', 'page')

    await page.keyboard.press('Tab')
    const firstLink = nav.getByRole('link', { name: '01 Como funciona' })
    await expect(firstLink).toBeFocused()
    expect(await firstLink.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')

    if (isMobile) {
      expect(await nav.locator('div').first().evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
    }

    const tierCards = page.locator('[data-tier]')
    await expect(tierCards).toHaveCount(3)
    const boxes = await tierCards.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect()))
    if (isMobile) {
      expect(boxes[1].top).toBeGreaterThan(boxes[0].bottom)
      expect(boxes[2].top).toBeGreaterThan(boxes[1].bottom)
    } else {
      expect(Math.abs(boxes[0].top - boxes[1].top)).toBeLessThan(5)
      expect(Math.abs(boxes[1].top - boxes[2].top)).toBeLessThan(5)
    }
    await expect(page.locator('[data-tier="essencial"]')).not.toContainText('R$')
    await expect(page.locator('[data-tier="basico"]')).toContainText('R$ 4.500,00')
    await expect(page.locator('[data-tier="completo"]')).toContainText('Sob proposta')

    await page.getByRole('button', { name: 'Escolher Básico' }).click()
    await expect(page.locator('[data-tier="basico"]')).toContainText('Preferido')
    await page.reload()
    await expect(page.locator('[data-tier="basico"]')).toContainText('Preferido')

    await nav.getByRole('link', { name: '02 Protótipo' }).click()
    const prototype = page.frameLocator('iframe[title="Protótipo navegável do projeto"]')
    await expect(prototype.getByRole('heading', { name: 'Primeira tela' })).toBeVisible()
    await prototype.getByRole('link', { name: 'Avancar' }).click()
    await expect(prototype.getByRole('heading', { name: 'Segunda tela' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Abrir protótipo em nova aba/ })).toBeVisible()

    await nav.getByRole('link', { name: '03 Etapas do plano' }).click()
    await expect(page.getByRole('heading', { name: '63% concluído' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'A fazer' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Em andamento' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Concluído', exact: true })).toBeVisible()
    await expect(page.getByText('Acompanhamento somente leitura')).toBeVisible()
    await expect(page.locator('main button')).toHaveCount(0)

    await nav.getByRole('link', { name: '04 Editor' }).click()
    await expect(page.getByText('O Editor é liberado quando a primeira versão do seu projeto fica pronta.')).toBeVisible()
    await nav.getByRole('link', { name: '05 Versões' }).click()
    await expect(page.getByText('Suas versões aparecem aqui quando a construção começar.')).toBeVisible()
    await nav.getByRole('link', { name: '06 Marca & arquivos' }).click()
    await expect(page.getByRole('heading', { name: 'Marca & arquivos' })).toBeVisible()

    await page.goto(`/p/${fixture.emptyProjectId}/como-funciona`)
    await expect(page.getByText('Seu plano ainda está sendo preparado. Assim que for publicado, ele aparece aqui.')).toBeVisible()
    await expect(page.getByText('Seu acesso de análise fica disponível por 15 dias.')).toHaveCount(0)
    await page.goto(`/p/${fixture.emptyProjectId}/prototipo`)
    await expect(page.getByText('O protótipo ainda não foi publicado para este projeto.')).toBeVisible()
    await page.goto(`/p/${fixture.emptyProjectId}/etapas`)
    await expect(page.getByText('As etapas entram aqui assim que o plano de execução for organizado.')).toBeVisible()

    for (const route of ['como-funciona', 'prototipo', 'etapas', 'editor', 'versoes', 'marca']) {
      await page.goto(`/p/${fixture.expiredProjectId}/${route}`)
      await expect(page.getByRole('heading', { name: 'Sua janela de análise terminou.' })).toBeVisible()
      await expect(page.getByRole('navigation', { name: 'Módulos do projeto' })).toHaveCount(0)
      await expect(page.getByText('Projeto E2E expirado')).toHaveCount(0)
    }

    expect(failures).toEqual([])
  })
})

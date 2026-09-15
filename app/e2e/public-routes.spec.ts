import { expect, test } from '@playwright/test'

test.describe('infraestrutura local das jornadas autenticadas', () => {
  test('login carrega sem falha de console e com controles acessíveis', async ({ page }) => {
    const failures: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(message.text())
    })
    page.on('pageerror', (error) => failures.push(error.message))
    page.on('response', (response) => {
      if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`)
    })

    await page.goto('/login')

    await expect(page.getByRole('heading', { name: /Entre no seu projeto/i })).toBeVisible()
    await expect(page.getByLabel('E-mail')).toBeVisible()
    await expect(page.getByLabel('Senha')).toBeVisible()
    await page.getByLabel('E-mail').focus()
    await expect(page.getByLabel('E-mail')).toBeFocused()
    expect(failures).toEqual([])
  })

  test('acesso sem sessão mostra o estado seguro do convite', async ({ page }) => {
    await page.goto('/acesso?projectId=00000000-0000-4000-8000-000000000001')

    await expect(page.getByText('Convite vencido')).toBeVisible()
    await expect(page.getByText(/Peça um novo link à Nó/i)).toBeVisible()
    await expect(page.getByLabel('Nova senha')).toHaveCount(0)
  })
})

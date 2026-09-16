import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import { cleanupF209Fixture, createF209Fixture, type F209Fixture } from './f2-09-fixture'

async function login(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('E-mail').fill(email)
  await page.getByLabel('Senha').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
async function publish(page: Page, label: string, macro: string, build: string) {
  await page.getByLabel('Rótulo').fill(label)
  await page.getByLabel('Marco').selectOption(macro)
  await page.getByLabel('Changelog').fill(`Entrega ${label}`)
  await page.getByLabel('Referência da build').fill(build)
  await page.getByRole('button', { name: 'Publicar versão' }).click()
  const response = page.waitForResponse(r => r.url().includes('/functions/v1/project-publish-version') && r.request().method() === 'POST')
  await page.getByRole('button', { name: 'Confirmar publicação' }).click()
  expect((await response).status()).toBe(200)
}

test.describe('F2-10 · cenário B', () => {
  test.use({ actionTimeout: 15_000 })
  test.setTimeout(180_000)
  let fixture: F209Fixture | undefined
  test.beforeAll(async () => { fixture = await createF209Fixture() })
  test.afterAll(async () => {
    if (fixture) {
      const { data: exports } = await fixture.admin.from('editor_exports').select('id,content_sha256').eq('project_id', fixture.projectId)
      for (const item of exports ?? []) {
        await fixture.admin.storage.from('editor-exports').remove(['editor.md','editor.cfg','editor.css','manifest.json'].map(name => `${fixture!.projectId}/${item.content_sha256}/${name}`))
        await fixture.admin.from('editor_export_checklists').delete().eq('export_id', item.id)
      }
      await fixture.admin.from('kanban_items').delete().eq('project_id', fixture.projectId)
      await fixture.admin.from('commercial_terms').delete().eq('project_id', fixture.projectId)
    }
    await cleanupF209Fixture(fixture)
  })

  test('C1-C9 · reload, preview, Storage privado, replay, ingestão e checklist em V2 até V3', async ({ page, context }) => {
    if (!fixture) throw new Error('Fixture unavailable')
    const f = fixture
    const { error: preparationError } = await f.admin.from('projects').update({ lead_status: 'JANELA_DE_DECISAO', project_status: null }).eq('id', f.projectId)
    if (preparationError) throw preparationError
    const { error: termsError } = await f.admin.from('commercial_terms').insert({ project_id: f.projectId, tier: 'basico', amount_cents: 120000, payment_method: 'pix', installments: 1, deadline_days: 30 })
    if (termsError) throw termsError
    await login(page, f.adminEmail, f.password)
    await page.goto(`/no/projetos/${f.projectId}`)
    await page.getByRole('button', { name: 'Converter', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(page.getByText('Estado atual: Convertido')).toBeVisible()
    await page.getByRole('button', { name: 'Agendar', exact: true }).click()
    await expect(page.getByText('Estado atual: Agendado')).toBeVisible()
    await page.getByRole('button', { name: 'Avançar para V1 em desenvolvimento' }).click()
    await expect(page.getByText('Estado atual: V1 em desenvolvimento')).toBeVisible()
    const build = 'https://preview.example.test/v1'
    await publish(page, 'V1', 'V1', build)
    const { data: version, error: versionError } = await f.admin.from('project_versions').select('id').eq('project_id', f.projectId).eq('label', 'V1').single()
    if (versionError || !version) throw versionError ?? new Error('V1 unavailable')
    const { error: configError } = await f.admin.from('editor_version_configs').insert({ version_id: version.id, allowed_components: [{ id: 'hero', screen: 'home', controls: ['text','size','color','logo'] }, { id: 'cta', screen: 'home', controls: ['text'] }], bridge_enabled: true })
    if (configError) throw configError
    await page.getByRole('button', { name: 'Avançar para Em revisão pelo cliente' }).click()
    const clientPage = await context.newPage()
    await context.route('https://preview.example.test/no-editor-preview.js', route => route.fulfill({ contentType: 'application/javascript', body: readFileSync('public/no-editor-preview.js','utf8') }))
    await context.route(build, route => route.fulfill({ contentType: 'text/html', body: `<h1 data-editor="hero">Original</h1><p data-editor="cta">Comprar</p><img data-editor="hero" alt="Logo"><script src="/no-editor-preview.js" data-parent-origin="http://127.0.0.1:5174" data-project-id="${f.projectId}" data-version-id="${version.id}" data-components='{"hero":["text","size","color","logo"],"cta":["text"]}'></script>` }))
    // Separate localStorage is not needed: authenticate client in a second page,
    // then explicitly reauthenticate admin before administrative actions.
    await login(clientPage, f.clientEmail, f.password)
    await clientPage.goto(`/p/${f.projectId}/editor`)
    await clientPage.getByLabel('Texto hero').fill('Novo título')
    await clientPage.getByLabel('Tamanho hero').fill('32')
    await clientPage.getByLabel('Cor hero').fill('#123456')
    await clientPage.getByLabel('Logo hero').fill('https://assets.example.test/logo.svg')
    await expect(clientPage.getByLabel('Cor cta')).toHaveCount(0)
    await clientPage.getByRole('button', { name: 'Salvar ajustes' }).click()
    await clientPage.reload()
    await expect(clientPage.getByLabel('Texto hero')).toHaveValue('Novo título')
    await expect(clientPage.getByLabel('Tamanho hero')).toHaveValue('32')
    const preview = clientPage.frameLocator('iframe')
    await expect(preview.locator('h1')).toHaveText('Novo título')
    await expect(preview.locator('h1')).toHaveCSS('font-size','32px')
    await expect(preview.locator('h1')).toHaveCSS('color','rgb(18, 52, 86)')
    const downloads: string[] = []
    clientPage.on('download', d => downloads.push(d.suggestedFilename()))
    await clientPage.getByRole('button', { name: 'Enviar para análise' }).click()
    await expect(clientPage.getByText('Pacote privado enviado para análise.', { exact: false })).toBeVisible()
    await expect.poll(() => downloads.length).toBe(4)
    expect(downloads.sort()).toEqual(['editor.cfg','editor.css','editor.md','manifest.json'])
    await clientPage.getByRole('button', { name: 'Enviar para análise' }).click()
    await expect(clientPage.getByText('Este mesmo pacote já estava recebido;', { exact: false })).toBeVisible()
    const { data: exports, error: exportError } = await f.admin.from('editor_exports').select('id,content_sha256,files_ready_at').eq('project_id', f.projectId)
    if (exportError) throw exportError
    expect(exports).toHaveLength(1)
    expect(exports![0].files_ready_at).toBeTruthy()
    const { data: objects, error: storageError } = await f.admin.storage.from('editor-exports').list(`${f.projectId}/${exports![0].content_sha256}`)
    if (storageError) throw storageError
    expect(objects).toHaveLength(4)
    const { data: immutable } = await f.admin.from('project_versions').select('build_reference').eq('id', version.id).single()
    expect(immutable?.build_reference).toBe(build)
    await login(page, f.adminEmail, f.password)
    await page.goto(`/no/projetos/${f.projectId}`)
    await page.getByRole('button', { name: 'Ingerir no Kanban' }).click()
    await expect(page.getByText('Estado atual: Alterações recebidas')).toBeVisible()
    const { count } = await f.admin.from('kanban_items').select('*', { count: 'exact', head: true }).eq('project_id', f.projectId).eq('phase','Editor')
    expect(count).toBe(1)
    await page.getByRole('button', { name: 'Avançar para V2 em desenvolvimento' }).click()
    await expect(page.getByText('Estado atual: V2 em desenvolvimento')).toBeVisible()
    await publish(page,'V2','V2','build-e2e-v2')
    const { data: v2 } = await f.admin.from('project_versions').select('id').eq('project_id', f.projectId).eq('label','V2').single()
    await page.getByLabel('Versão de destino para V1').selectOption(v2!.id)
    await page.getByRole('button', { name: 'Associar checklist' }).click()
    await expect(page.getByText('Incorporado em V2')).toBeVisible()
    await publish(page,'V3','V3','build-e2e-v3')
    await page.getByRole('button', { name: 'Concluir projeto' }).click()
    await page.getByRole('button', { name: 'Confirmar conclusão' }).click()
    await expect(page.getByText('Estado atual: Concluído')).toBeVisible()
    await login(clientPage, f.clientEmail, f.password)
    await clientPage.goto(`/p/${f.projectId}/versoes`)
    await expect(clientPage.getByText('home / hero')).toBeVisible()
    await expect(clientPage.getByText('Novo título', { exact: false })).toBeVisible()
    await expect(clientPage.locator('ol h3')).toHaveText(['V3','V2','V1'])
  })
})

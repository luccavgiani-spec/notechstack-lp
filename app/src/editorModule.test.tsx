import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadEditorConfig: vi.fn(),
  submitEditorExport: vi.fn(),
  uploadEditorExportFiles: vi.fn(),
  finalizeEditorExport: vi.fn(),
  uploadEditorImage: vi.fn(),
}))

vi.mock('./client-dashboard/client-dashboard-service', () => ({
  loadEditorConfig: mocks.loadEditorConfig,
  submitEditorExport: mocks.submitEditorExport,
  uploadEditorExportFiles: mocks.uploadEditorExportFiles,
  finalizeEditorExport: mocks.finalizeEditorExport,
  uploadEditorImage: mocks.uploadEditorImage,
  EDITOR_IMAGE_TYPES: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' },
  EDITOR_IMAGE_MAX_BYTES: 5 * 1024 * 1024,
}))

import { EditorModule } from './client-dashboard/EditorModule'

const config = {
  versionId: 'version-1',
  label: 'V1',
  buildReference: 'https://preview.example.test/app',
  allowedComponents: [
    { id: 'hero', label: 'Hero', screen: 'home', controls: ['text', 'size', 'color', 'logo'] },
    { id: 'cta', label: 'CTA', screen: 'home', controls: ['text'] },
  ],
  bridgeEnabled: true,
}

async function selectInPreview(
  user: ReturnType<typeof userEvent.setup>,
  componentId: string,
  extra: Record<string, unknown> = {},
) {
  const modeButton = await screen.findByRole('button', { name: /Modo editor/ })
  if (modeButton.getAttribute('aria-pressed') !== 'true') await user.click(modeButton)
  const frame = screen.getByTitle<HTMLIFrameElement>('Preview controlado V1')
  if (!frame.contentWindow) throw new Error('Preview window is unavailable')
  fireEvent(
    window,
    new MessageEvent('message', {
      origin: 'https://preview.example.test',
      source: frame.contentWindow,
      data: {
        source: 'no-editor-preview',
        type: 'NO_EDITOR_SELECT',
        version: 1,
        projectId: 'project-1',
        baseVersionId: 'version-1',
        componentId,
        ...extra,
      },
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.loadEditorConfig.mockResolvedValue(config)
  mocks.submitEditorExport.mockResolvedValue({ exportId: 'export-1', replayed: false, contentReplay: false, conflict: false, contentSha256: 'sha-content' })
  mocks.uploadEditorExportFiles.mockResolvedValue(undefined)
  mocks.finalizeEditorExport.mockResolvedValue(undefined)
  mocks.uploadEditorImage.mockResolvedValue('https://storage.example.test/editor-assets/project-1/foto.png')
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
  if (!URL.createObjectURL) Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:test'), configurable: true })
  else vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  if (!URL.revokeObjectURL) Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), configurable: true })
  else vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
})

describe('F2-10 Editor', () => {
  it('C1/C2 restaura os quatro campos e oculta controles fora da allowlist', async () => {
    const user = userEvent.setup()
    const view = render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    await user.type(await screen.findByLabelText('Texto hero'), 'Título novo')
    fireEvent.change(screen.getByLabelText('Tamanho hero'), { target: { value: '32' } })
    fireEvent.change(screen.getByLabelText('Cor hero'), { target: { value: '#123456' } })
    await user.upload(screen.getByLabelText('Imagem hero'), new File(['png'], 'foto.png', { type: 'image/png' }))
    await waitFor(() => expect(screen.getByAltText('Imagem atual do elemento')).toHaveAttribute('src', 'https://storage.example.test/editor-assets/project-1/foto.png'))
    expect(mocks.uploadEditorImage).toHaveBeenCalledWith('project-1', expect.any(File))
    expect(screen.queryByLabelText('Cor cta')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))
    view.unmount()

    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    expect(await screen.findByLabelText('Texto hero')).toHaveValue('Título novo')
    expect(screen.getByLabelText('Tamanho hero')).toHaveValue('32')
    expect(screen.getByLabelText('Cor hero')).toHaveValue('#123456')
    expect(screen.getByAltText('Imagem atual do elemento')).toHaveAttribute('src', 'https://storage.example.test/editor-assets/project-1/foto.png')
  })

  it('C3/C4 usa preview controlado e envia exatamente quatro arquivos', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    await user.type(await screen.findByLabelText('Texto hero'), 'Título')
    const frame = screen.getByTitle<HTMLIFrameElement>('Preview controlado V1')
    if (!frame.contentWindow) throw new Error('Preview window is unavailable')
    const postMessage = vi.spyOn(frame.contentWindow, 'postMessage')
    fireEvent.load(frame)
    expect(frame).toHaveAttribute('src', 'https://preview.example.test/app')
    expect(frame).toHaveAttribute('sandbox', 'allow-forms allow-scripts allow-same-origin')
    expect(postMessage).toHaveBeenCalledWith(expect.objectContaining({ source: 'no-editor', type: 'NO_EDITOR_PREVIEW', baseVersionId: 'version-1' }), 'https://preview.example.test')

    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))
    await waitFor(() => expect(mocks.submitEditorExport).toHaveBeenCalledWith('project-1', 'version-1', [expect.objectContaining({ screen: 'home', component: 'hero' })], expect.objectContaining({ files: ['editor.md', 'editor.cfg', 'editor.css', 'manifest.json'] })))
    expect(mocks.uploadEditorExportFiles).toHaveBeenCalledWith('project-1', 'sha-content', expect.objectContaining({ 'editor.md': expect.any(String), 'editor.cfg': expect.any(String), 'editor.css': expect.any(String), 'manifest.json': expect.any(String) }))
    expect(mocks.finalizeEditorExport).toHaveBeenCalledWith('export-1')
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(await screen.findByRole('status')).toHaveTextContent('Ajustes enviados para a Nó')
    const stamp = screen.getByTitle('Fechar aviso')
    expect(stamp).toHaveTextContent('vira a versão 2')
    expect(screen.getByRole('button', { name: '✓ Enviado' })).toBeDisabled()

    // A new adjustment after sending brings the button back and lifts the stamp.
    await user.type(screen.getByLabelText('Texto hero'), ' novo')
    expect(screen.queryByText('vira a versão 2')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enviar para análise' })).toBeEnabled()
  })

  it('preserva o rascunho quando o envio falha', async () => {
    mocks.submitEditorExport.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    await user.type(await screen.findByLabelText('Texto hero'), 'Não perder')
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))
    expect(await screen.findByRole('status')).toHaveTextContent('O rascunho foi preservado')
    expect(localStorage.getItem('no_editor:project-1:version-1')).toContain('Não perder')
  })
  it('troca de componente respeita a allowlist e preserva o rascunho', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    await user.type(await screen.findByLabelText('Texto hero'), 'Título mantido')
    await selectInPreview(user, 'cta')
    expect(screen.getByLabelText('Texto cta')).toBeVisible()
    expect(screen.queryByLabelText('Tamanho cta')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cor cta')).not.toBeInTheDocument()
    await selectInPreview(user, 'hero')
    expect(screen.getByLabelText('Texto hero')).toHaveValue('Título mantido')
  })

  it('descarte exige confirmação e recarrega a prévia original', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    await user.type(await screen.findByLabelText('Texto hero'), 'Temporário')
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))
    const previousFrame = screen.getByTitle('Preview controlado V1')
    await user.click(screen.getByRole('button', { name: 'Descartar rascunho' }))
    expect(screen.getByLabelText('Texto hero')).toHaveValue('Temporário')
    await user.click(screen.getByRole('button', { name: 'Confirmar descarte' }))
    expect(screen.getByLabelText('Texto hero')).toHaveValue('')
    expect(localStorage.getItem('no_editor:project-1:version-1')).toBeNull()
    expect(screen.getByTitle('Preview controlado V1')).not.toBe(previousFrame)
  })

  it('alterar apenas o tamanho não apaga o texto e exibe uma única página', async () => {
    mocks.loadEditorConfig.mockResolvedValue({
      ...config,
      allowedComponents: [
        { ...config.allowedComponents[0], screen: 'Abertura' },
        { ...config.allowedComponents[1], screen: 'Honorários' },
      ],
    })
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    const frame = screen.getByTitle<HTMLIFrameElement>('Preview controlado V1')
    if (!frame.contentWindow) throw new Error('Preview window is unavailable')
    const postMessage = vi.spyOn(frame.contentWindow, 'postMessage')

    fireEvent.change(screen.getByLabelText('Tamanho hero'), {
      target: { value: '36' },
    })

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ changes: { hero: { size: '36' } } }),
        'https://preview.example.test',
      ),
    )
    expect(screen.getByRole('button', { name: 'Página única' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Abertura' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Honorários' })).not.toBeInTheDocument()
  })

  it('modo automático aceita qualquer elemento do preview e envia rótulo, antes e depois', async () => {
    mocks.loadEditorConfig.mockResolvedValue({
      ...config,
      allowedComponents: [...config.allowedComponents, { id: '*', controls: ['text', 'size', 'color', 'logo'] }],
    })
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    const autoId = 'auto:#valores/div.1/p.2'
    await selectInPreview(user, autoId, {
      meta: { label: 'Texto “Sessões de 50 minutos”', screen: 'Honorários', controls: ['text', 'color'] },
      original: { text: 'Sessões de 50 minutos', color: '#333333', size: '16' },
    })
    expect(await screen.findByText('Texto “Sessões de 50 minutos”', { selector: 'strong' })).toBeVisible()
    expect(screen.queryByLabelText(`Tamanho ${autoId}`)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(`Logo ${autoId}`)).not.toBeInTheDocument()
    const textField = screen.getByLabelText(`Texto ${autoId}`)
    expect(textField).toHaveValue('Sessões de 50 minutos')
    await user.clear(textField)
    await user.type(textField, 'Sessões de 60 minutos')
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))

    await waitFor(() => expect(mocks.submitEditorExport).toHaveBeenCalled())
    expect(mocks.submitEditorExport.mock.calls[0][2]).toEqual([{
      screen: 'Honorários',
      component: autoId,
      label: 'Texto “Sessões de 50 minutos”',
      before: { text: 'Sessões de 50 minutos' },
      after: { text: 'Sessões de 60 minutos' },
    }])
    const files = mocks.uploadEditorExportFiles.mock.calls[0][2] as Record<string, string>
    expect(files['editor.md']).toContain('"Sessões de 50 minutos" → "Sessões de 60 minutos"')
    expect(files['editor.md']).toContain('#valores > div:nth-of-type(1) > p:nth-of-type(2)')
  })

  it('sem "*" na allowlist, elementos automáticos são ignorados', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'auto:#valores/h2.1', { meta: { label: 'Título' } })
    expect(await screen.findByText(/Selecione um texto/)).toBeVisible()
    expect(screen.queryByLabelText('Texto auto:#valores/h2.1')).not.toBeInTheDocument()
  })

  it('arrastar e redimensionar também vão para a Nó', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'cta', { original: { text: 'Agendar', x: '0', y: '0' } })
    await selectInPreview(user, 'cta', { type: 'NO_EDITOR_CHANGE', changes: { x: '24', y: '-8' } })
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))
    await waitFor(() => expect(mocks.submitEditorExport).toHaveBeenCalled())
    expect(mocks.submitEditorExport.mock.calls[0][2]).toEqual([
      expect.objectContaining({ component: 'cta', before: { x: '0', y: '0' }, after: { x: '24', y: '-8' } }),
    ])
  })

  it('Desfazer volta um passo por vez e agrupa a digitação contínua', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    const undoButton = await screen.findByRole('button', { name: /Desfazer/ })
    expect(undoButton).toBeDisabled()
    await selectInPreview(user, 'hero', { original: { text: 'Título original', size: '40' } })
    const frame = screen.getByTitle<HTMLIFrameElement>('Preview controlado V1')
    if (!frame.contentWindow) throw new Error('Preview window is unavailable')
    const postMessage = vi.spyOn(frame.contentWindow, 'postMessage')

    const text = screen.getByLabelText('Texto hero')
    await user.clear(text)
    await user.type(text, 'Novo')
    fireEvent.change(screen.getByLabelText('Tamanho hero'), { target: { value: '32' } })
    expect(undoButton).toBeEnabled()

    await user.click(undoButton)
    expect(screen.getByLabelText('Tamanho hero')).toHaveValue('40')
    expect(screen.getByLabelText('Texto hero')).toHaveValue('Novo')
    await waitFor(() =>
      expect(postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ changes: { hero: { text: 'Novo' } } }),
        'https://preview.example.test',
      ),
    )

    await user.click(undoButton)
    expect(screen.getByLabelText('Texto hero')).toHaveValue('Título original')
    expect(undoButton).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent('Última alteração desfeita.')
  })

  it('Ctrl+Z desfaz fora dos campos e também quando vem de dentro do preview', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    fireEvent.change(screen.getByLabelText('Tamanho hero'), { target: { value: '30' } })
    fireEvent.keyDown(screen.getByLabelText('Texto hero'), { key: 'z', ctrlKey: true })
    expect(screen.getByLabelText('Tamanho hero')).toHaveValue('30')
    fireEvent.keyDown(document.body, { key: 'z', ctrlKey: true })
    expect(screen.getByLabelText('Tamanho hero')).toHaveValue('16')

    fireEvent.change(screen.getByLabelText('Tamanho hero'), { target: { value: '50' } })
    await selectInPreview(user, '', { type: 'NO_EDITOR_UNDO' })
    expect(screen.getByLabelText('Tamanho hero')).toHaveValue('16')
  })

  it('imagem só aceita PNG, JPG, WebP ou GIF de até 5 MB', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<EditorModule projectId="project-1" />)
    await selectInPreview(user, 'hero')
    await user.upload(screen.getByLabelText('Imagem hero'), new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Use uma imagem PNG, JPG, WebP ou GIF.')
    const big = new File(['x'], 'grande.jpg', { type: 'image/jpeg' })
    Object.defineProperty(big, 'size', { value: 6 * 1024 * 1024 })
    await user.upload(screen.getByLabelText('Imagem hero'), big)
    expect(await screen.findByRole('alert')).toHaveTextContent('A imagem passa de 5 MB.')
    expect(mocks.uploadEditorImage).not.toHaveBeenCalled()

    mocks.uploadEditorImage.mockRejectedValueOnce(new Error('offline'))
    await user.upload(screen.getByLabelText('Imagem hero'), new File(['png'], 'foto.png', { type: 'image/png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível enviar a imagem.')
  })
})

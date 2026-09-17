import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadEditorConfig: vi.fn(),
  submitEditorExport: vi.fn(),
  uploadEditorExportFiles: vi.fn(),
  finalizeEditorExport: vi.fn(),
}))

vi.mock('./client-dashboard/client-dashboard-service', () => ({
  loadEditorConfig: mocks.loadEditorConfig,
  submitEditorExport: mocks.submitEditorExport,
  uploadEditorExportFiles: mocks.uploadEditorExportFiles,
  finalizeEditorExport: mocks.finalizeEditorExport,
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

beforeEach(() => {
  vi.clearAllMocks()
  localStorage.clear()
  mocks.loadEditorConfig.mockResolvedValue(config)
  mocks.submitEditorExport.mockResolvedValue({ exportId: 'export-1', replayed: false, contentReplay: false, conflict: false, contentSha256: 'sha-content' })
  mocks.uploadEditorExportFiles.mockResolvedValue(undefined)
  mocks.finalizeEditorExport.mockResolvedValue(undefined)
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
    await user.type(await screen.findByLabelText('Texto hero'), 'Título novo')
    fireEvent.change(screen.getByLabelText('Tamanho hero'), { target: { value: '32' } })
    fireEvent.change(screen.getByLabelText('Cor hero'), { target: { value: '#123456' } })
    await user.type(screen.getByLabelText('Logo hero'), 'https://assets.example.test/logo.svg')
    expect(screen.queryByLabelText('Cor cta')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))
    view.unmount()

    render(<EditorModule projectId="project-1" />)
    expect(await screen.findByLabelText('Texto hero')).toHaveValue('Título novo')
    expect(screen.getByLabelText('Tamanho hero')).toHaveValue('32')
    expect(screen.getByLabelText('Cor hero')).toHaveValue('#123456')
    expect(screen.getByLabelText('Logo hero')).toHaveValue('https://assets.example.test/logo.svg')
  })

  it('C3/C4 usa preview controlado e envia exatamente quatro arquivos', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
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
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(4)
    expect(mocks.finalizeEditorExport).toHaveBeenCalledWith('export-1')
  })

  it('preserva o rascunho quando o envio falha', async () => {
    mocks.submitEditorExport.mockRejectedValue(new Error('offline'))
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await user.type(await screen.findByLabelText('Texto hero'), 'Não perder')
    await user.click(screen.getByRole('button', { name: 'Salvar ajustes' }))
    await user.click(screen.getByRole('button', { name: 'Enviar para análise' }))
    expect(await screen.findByRole('status')).toHaveTextContent('O rascunho foi preservado')
    expect(localStorage.getItem('no_editor:project-1:version-1')).toContain('Não perder')
  })
  it('troca de componente respeita a allowlist e preserva o rascunho', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
    await user.type(await screen.findByLabelText('Texto hero'), 'Título mantido')
    await user.click(screen.getByRole('button', { name: /CTA/ }))
    expect(screen.getByLabelText('Texto cta')).toBeVisible()
    expect(screen.queryByLabelText('Tamanho cta')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Cor cta')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Hero/ }))
    expect(screen.getByLabelText('Texto hero')).toHaveValue('Título mantido')
  })

  it('descarte exige confirmação e recarrega a prévia original', async () => {
    const user = userEvent.setup()
    render(<EditorModule projectId="project-1" />)
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

})

import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'

it('does not schedule an endless overlay loop after selecting a preview element', async () => {
  const script = document.createElement('script')
  script.dataset.parentOrigin = location.origin
  script.dataset.projectId = 'project'
  script.dataset.versionId = 'version'
  script.dataset.components = JSON.stringify({ subtitle: ['text', 'size'] })
  const scriptSpy = vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script)
  const subtitle = document.createElement('p')
  subtitle.dataset.editor = 'subtitle'
  subtitle.textContent = 'Subtitle preserved'
  document.body.appendChild(subtitle)
  const parent = { postMessage: vi.fn() }
  const listeners = new Map<string, (event: unknown) => void>()
  const fakeWindow = { parent, addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener) }
  const frames: FrameRequestCallback[] = []
  const raf = vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length })
  const source = readFileSync('public/no-editor-preview.js', 'utf8')
  new Function('window', 'requestAnimationFrame', source)(fakeWindow, raf)
  listeners.get('message')!({ source: parent, origin: location.origin, data: {
    source: 'no-editor', type: 'NO_EDITOR_PREVIEW', version: 1,
    projectId: 'project', baseVersionId: 'version', changes: {},
    editorMode: true, selectedComponent: 'subtitle',
  } })
  await Promise.resolve()
  while (frames.length) frames.shift()!(0)
  raf.mockClear()
  await Promise.resolve()
  expect(raf).not.toHaveBeenCalled()
  expect(document.querySelector('.no-editor-label')?.textContent).toBe('subtitle')
  expect(subtitle.textContent).toBe('Subtitle preserved')
  listeners.get('scroll')!({})
  listeners.get('scroll')!({})
  expect(raf).toHaveBeenCalledTimes(1)
  while (frames.length) frames.shift()!(0)
  listeners.get('message')!({ source: parent, origin: location.origin, data: {
    source: 'no-editor', type: 'NO_EDITOR_PREVIEW', version: 1,
    projectId: 'project', baseVersionId: 'version', changes: {}, editorMode: false,
  } })
  raf.mockClear()
  listeners.get('scroll')!({})
  expect(raf).not.toHaveBeenCalled()
  expect(document.querySelector('#no-editor-selection')).toHaveAttribute('hidden')
  scriptSpy.mockRestore()
})

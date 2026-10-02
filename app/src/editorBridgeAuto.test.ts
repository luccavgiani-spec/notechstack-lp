import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'

type Posted = { type: string; componentId: string; values?: Record<string, string>; original?: Record<string, string>; meta?: { label: string; screen: string; controls: string[] } }

function startBridge(components: Record<string, string[]>) {
  const script = document.createElement('script')
  script.dataset.parentOrigin = location.origin
  script.dataset.projectId = 'project'
  script.dataset.versionId = 'version'
  script.dataset.components = JSON.stringify(components)
  const scriptSpy = vi.spyOn(document, 'currentScript', 'get').mockReturnValue(script)
  const parent = { postMessage: vi.fn() }
  const listeners = new Map<string, (event: unknown) => void>()
  const fakeWindow = { parent, addEventListener: (type: string, listener: (event: unknown) => void) => listeners.set(type, listener) }
  const source = readFileSync('public/no-editor-preview.js', 'utf8')
  new Function('window', 'requestAnimationFrame', source)(fakeWindow, () => 0)
  scriptSpy.mockRestore()
  const preview = (changes: Record<string, unknown>, editorMode = true) => listeners.get('message')!({
    source: parent, origin: location.origin,
    data: { source: 'no-editor', type: 'NO_EDITOR_PREVIEW', version: 1, projectId: 'project', baseVersionId: 'version', changes, editorMode },
  })
  const lastSelect = () => (parent.postMessage.mock.calls.map(([payload]) => payload as Posted).filter((payload) => payload.type === 'NO_EDITOR_SELECT').at(-1))
  return { preview, lastSelect }
}

function click(element: Element) {
  const event = new MouseEvent('click', { bubbles: true, cancelable: true })
  element.dispatchEvent(event)
  return event
}

it('modo automático seleciona qualquer texto, botão ou imagem e aplica os ajustes pelo caminho', () => {
  document.body.innerHTML = `
    <main>
      <section id="valores">
        <h2>Honorários <em>justos</em></h2>
        <p>Sessões de 50 minutos</p>
        <button><svg></svg><span>Agendar</span></button>
        <a href="/agenda">Ver agenda</a>
        <a href="/horarios" class="cta">Ver horários <svg></svg></a>
        <img alt="Thaís no consultório" src="https://example.test/thais.jpg">
      </section>
    </main>`
  const { preview, lastSelect } = startBridge({ '*': ['text', 'size', 'color', 'logo'] })
  preview({})

  click(document.querySelector('em')!)
  expect(lastSelect()).toMatchObject({
    componentId: 'auto:#valores/h2.1',
    meta: { label: 'Título “Honorários justos”', controls: ['text', 'size', 'color'] },
  })

  click(document.querySelector('button span')!)
  expect(lastSelect()).toMatchObject({ componentId: 'auto:#valores/button.1/span.1', meta: { label: 'Botão “Agendar”' } })
  click(document.querySelector('svg')!)
  expect(lastSelect()?.componentId).toBe('auto:#valores/button.1')
  expect(lastSelect()?.meta?.controls).not.toContain('text')

  click(document.querySelector('img')!)
  expect(lastSelect()).toMatchObject({ componentId: 'auto:#valores/img.1', meta: { label: 'Imagem “Thaís no consultório”', controls: ['logo'] } })

  expect(click(document.querySelector('a')!).defaultPrevented).toBe(true)

  const paragraph = document.querySelector('p')!
  preview({ 'auto:#valores/p.1': { text: 'Sessões de 60 minutos', color: '#ff0000' } })
  expect(paragraph.textContent).toBe('Sessões de 60 minutos')
  expect(paragraph.style.color).toBe('rgb(255, 0, 0)')
  click(paragraph)
  expect(lastSelect()).toMatchObject({ componentId: 'auto:#valores/p.1', original: { text: 'Sessões de 50 minutos' } })

  // Changing the button's text through an automatic id must not wipe its icon.
  preview({ 'auto:#valores/button.1': { text: 'Apagaria o ícone' } })
  expect(document.querySelector('button svg')).not.toBeNull()

  // A link with text and an icon edits only its text node.
  const cta = document.querySelector('a.cta')!
  click(cta)
  expect(lastSelect()).toMatchObject({ componentId: 'auto:#valores/a.2', meta: { label: 'Link “Ver horários”', controls: ['text', 'size', 'color'] } })
  preview({ 'auto:#valores/a.2': { text: 'Agende agora ' } })
  expect(cta.textContent).toBe('Agende agora ')
  expect(cta.querySelector('svg')).not.toBeNull()
})

it('sem "*" na allowlist, só elementos mapeados respondem e a navegação fica bloqueada no modo editor', () => {
  document.body.innerHTML = '<main><h1 data-editor="hero">Olá</h1><p>Livre</p></main>'
  const { preview, lastSelect } = startBridge({ hero: ['text'] })
  preview({})
  click(document.querySelector('p')!)
  expect(lastSelect()).toBeUndefined()
  click(document.querySelector('h1')!)
  expect(lastSelect()?.componentId).toBe('hero')
  preview({ 'auto:main.1/p.1': { text: 'Não aplica' } })
  expect(document.querySelector('p')!.textContent).toBe('Livre')
})

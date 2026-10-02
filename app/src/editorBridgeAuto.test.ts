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
  const frames: FrameRequestCallback[] = []
  new Function('window', 'requestAnimationFrame', source)(fakeWindow, (callback: FrameRequestCallback) => frames.push(callback))
  scriptSpy.mockRestore()
  const preview = (changes: Record<string, unknown>, editorMode = true) => listeners.get('message')!({
    source: parent, origin: location.origin,
    data: { source: 'no-editor', type: 'NO_EDITOR_PREVIEW', version: 1, projectId: 'project', baseVersionId: 'version', changes, editorMode },
  })
  const lastSelect = () => (parent.postMessage.mock.calls.map(([payload]) => payload as Posted).filter((payload) => payload.type === 'NO_EDITOR_SELECT').at(-1))
  const posted = (type: string) => parent.postMessage.mock.calls.map(([payload]) => payload as Posted).filter((payload) => payload.type === type)
  const flushFrames = () => { while (frames.length) frames.shift()!(0) }
  return { preview, lastSelect, posted, flushFrames }
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
  expect(lastSelect()).toMatchObject({ componentId: 'auto:src/example.test/thais.jpg', meta: { label: 'Imagem “Thaís no consultório” · thais.jpg', controls: ['logo'] } })

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

it('lê o texto como o visitante vê e devolve o original quando o ajuste sai do rascunho', () => {
  document.body.innerHTML = `
    <main>
      <section id="frase">
        <p class="palavras"><span style="display:inline-block;margin-right:6px">Muitas</span><span style="display:inline-block;margin-right:6px">vezes</span><span style="display:inline-block;margin-right:6px">você</span><span style="display:inline-block">fala.</span></p>
        <h2 style="color: rgb(1, 2, 3)">Algumas experiências<br>só ganham <em>contorno</em></h2>
      </section>
    </main>`
  const { preview, lastSelect, posted } = startBridge({ '*': ['text', 'size', 'color', 'logo'] })
  preview({})

  const phrase = document.querySelector('p.palavras')!
  click(phrase.querySelector('span')!)
  expect(lastSelect()).toMatchObject({
    componentId: 'auto:#frase/p.1',
    values: { text: 'Muitas vezes você fala.' },
    meta: { label: 'Texto “Muitas vezes você fala.”' },
  })

  const heading = document.querySelector('h2')!
  click(heading)
  expect(lastSelect()?.original?.text).toBe('Algumas experiências\nsó ganham contorno')

  preview({ 'auto:#frase/h2.1': { text: 'Linha um\nLinha dois', color: '#ff0000', x: '12' } })
  expect(heading.innerHTML).toBe('Linha um<br>Linha dois')
  expect(heading.style.color).toBe('rgb(255, 0, 0)')
  expect(heading.style.position).toBe('relative')

  // Undo in the dashboard removes the fields from the draft.
  preview({ 'auto:#frase/h2.1': { text: 'Linha um\nLinha dois' } })
  expect(heading.style.color).toBe('rgb(1, 2, 3)')
  expect(heading.style.position).toBe('')
  expect(heading.style.left).toBe('')
  preview({})
  expect(heading.innerHTML).toBe('Algumas experiências<br>só ganham <em>contorno</em>')

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }))
  expect(posted('NO_EDITOR_UNDO')).toHaveLength(1)
})

it('troca de imagem ignora srcset e <picture> e volta ao original no desfazer', () => {
  document.body.innerHTML = `
    <main>
      <section id="quem">
        <picture><source srcset="https://example.test/thais.webp"><img alt="Thaís" src="https://example.test/thais.jpg" srcset="https://example.test/thais@2x.jpg 2x"></picture>
      </section>
    </main>`
  const { preview, lastSelect } = startBridge({ '*': ['text', 'size', 'color', 'logo'] })
  preview({})
  const image = document.querySelector('img')!
  click(image)
  const id = lastSelect()!.componentId
  expect(lastSelect()?.meta?.controls).toEqual(['logo'])

  preview({ [id]: { logo: 'https://storage.example.test/nova.png' } })
  expect(image.getAttribute('src')).toBe('https://storage.example.test/nova.png')
  expect(image.hasAttribute('srcset')).toBe(false)
  expect(document.querySelector('source')!.hasAttribute('srcset')).toBe(false)

  preview({})
  expect(image.getAttribute('src')).toBe('https://example.test/thais.jpg')
  expect(image.getAttribute('srcset')).toBe('https://example.test/thais@2x.jpg 2x')
  expect(document.querySelector('source')!.getAttribute('srcset')).toBe('https://example.test/thais.webp')
})

it('carrossel que remonta a foto recebe a imagem nova de novo e só aquela foto muda', async () => {
  document.body.innerHTML = `
    <main><section id="quem"><div class="slide"><img alt="Thaís" src="/prototipos/espaco/quem/thais-3.jpg"></div></section></main>`
  const { preview, lastSelect, flushFrames } = startBridge({ '*': ['text', 'size', 'color', 'logo'] })
  preview({})
  click(document.querySelector('img')!)
  const id = lastSelect()!.componentId
  expect(id).toBe('auto:src/prototipos/espaco/quem/thais-3.jpg')
  preview({ [id]: { logo: 'https://storage.example.test/nova.png' } })
  expect(document.querySelector('img')!.getAttribute('src')).toBe('https://storage.example.test/nova.png')

  // The carousel moves on to another photo: that one stays untouched.
  document.querySelector('.slide')!.innerHTML = '<img alt="Thaís" src="/prototipos/espaco/quem/thais-4.jpg">'
  await Promise.resolve()
  flushFrames()
  expect(document.querySelector('img')!.getAttribute('src')).toBe('/prototipos/espaco/quem/thais-4.jpg')

  // And comes back to photo 3, freshly mounted with the original file.
  document.querySelector('.slide')!.innerHTML = '<img alt="Thaís" src="/prototipos/espaco/quem/thais-3.jpg">'
  await Promise.resolve()
  flushFrames()
  expect(document.querySelector('img')!.getAttribute('src')).toBe('https://storage.example.test/nova.png')
})

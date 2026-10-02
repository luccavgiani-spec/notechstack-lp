/* Include only in a marked preview build, never in the immutable production build. */
(() => {
  'use strict'

  const script = document.currentScript
  if (!script || window.parent === window) return

  const configuredParentOrigin = script.dataset.parentOrigin
  const projectId = script.dataset.projectId
  const versionId = script.dataset.versionId
  const localPreview = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  let allowed

  try {
    if (!configuredParentOrigin || new URL(configuredParentOrigin).origin !== configuredParentOrigin || !projectId || !versionId) return
    allowed = JSON.parse(script.dataset.components || '{}')
    if (!allowed || typeof allowed !== 'object' || Array.isArray(allowed)) return
  } catch {
    return
  }

  const acceptedParentOrigin = localPreview ? location.origin : configuredParentOrigin
  const layoutFields = ['x', 'y', 'width', 'height']
  const contentFields = ['text', 'size', 'color', 'logo']
  // "*" in the allowlist turns on automatic mode: any visible text, button or
  // image becomes editable, addressed by its DOM path instead of a data-editor mark.
  const autoControls = Array.isArray(allowed['*']) ? allowed['*'] : null
  const AUTO_ID = /^auto:[A-Za-z0-9#/._-]{1,300}$/
  const ANCHOR_ID = /^[A-Za-z][\w-]{0,60}$/
  const TEXT_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'A', 'BUTTON', 'LI', 'SPAN', 'LABEL', 'BLOCKQUOTE', 'FIGCAPTION', 'SMALL', 'STRONG', 'EM', 'B', 'I', 'TD', 'TH', 'DT', 'DD', 'CITE', 'Q', 'SUMMARY', 'LEGEND'])
  const INLINE_TAGS = new Set(['BR', 'STRONG', 'EM', 'B', 'I', 'U', 'SPAN', 'SMALL', 'MARK', 'SUP', 'SUB', 'ABBR', 'CODE', 'S', 'CITE', 'Q', 'TIME'])
  const KIND = { H1: 'Título', H2: 'Título', H3: 'Subtítulo', H4: 'Subtítulo', H5: 'Subtítulo', H6: 'Subtítulo', P: 'Texto', LI: 'Item de lista', LABEL: 'Rótulo', BLOCKQUOTE: 'Citação', FIGCAPTION: 'Legenda', TD: 'Célula', TH: 'Célula', SUMMARY: 'Pergunta' }
  const originals = new Map()
  const pristineStyle = new Map()
  const pristineContent = new Map()
  const appliedFields = new Map()
  const labels = new Map()
  let editorMode = false
  let selectedId = ''
  let overlay
  let editingElement
  let editingId = ''
  let gesture
  let hovered
  let hoverTarget
  let overlayFrame = 0
  let imageFrame = 0
  let lastChanges = {}
  // Images are addressed by their original file, not by position: carousels
  // unmount and remount <img> elements, so a position points at whichever
  // photo happens to be showing.
  const SRC_PREFIX = 'auto:src/'

  function scheduleOverlay() {
    if (!editorMode || overlayFrame) return
    overlayFrame = requestAnimationFrame(() => {
      overlayFrame = 0
      updateOverlay()
    })
  }

  const style = document.createElement('style')
  style.textContent = `
    html.no-editor-mode [data-editor], html.no-editor-mode [data-no-editor-hover] { cursor: pointer !important; }
    html.no-editor-mode [data-no-editor-hover] { outline: 2px dashed #eda33b !important; outline-offset: 4px !important; }
    html.no-editor-mode [contenteditable="true"] { cursor: text !important; outline: 2px solid #eda33b !important; }
    #no-editor-selection { position: fixed; z-index: 2147483646; pointer-events: none; border: 2px solid #eda33b; border-radius: 3px; box-shadow: 0 0 0 1px #fff9; }
    #no-editor-selection[hidden] { display: none !important; }
    #no-editor-selection .no-editor-label { position: absolute; left: -2px; bottom: calc(100% + 6px); max-width: 220px; padding: 4px 7px; border-radius: 5px; background: #141414; color: white; font: 600 10px/1.2 system-ui, sans-serif; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #no-editor-selection .no-editor-handle { position: absolute; width: 11px; height: 11px; border: 2px solid white; border-radius: 50%; background: #eda33b; pointer-events: auto; }
    #no-editor-selection [data-handle="nw"] { left: -7px; top: -7px; cursor: nwse-resize; }
    #no-editor-selection [data-handle="n"] { left: calc(50% - 5px); top: -7px; cursor: ns-resize; }
    #no-editor-selection [data-handle="ne"] { right: -7px; top: -7px; cursor: nesw-resize; }
    #no-editor-selection [data-handle="e"] { right: -7px; top: calc(50% - 5px); cursor: ew-resize; }
    #no-editor-selection [data-handle="se"] { right: -7px; bottom: -7px; cursor: nwse-resize; }
    #no-editor-selection [data-handle="s"] { left: calc(50% - 5px); bottom: -7px; cursor: ns-resize; }
    #no-editor-selection [data-handle="sw"] { left: -7px; bottom: -7px; cursor: nesw-resize; }
    #no-editor-selection [data-handle="w"] { left: -7px; top: calc(50% - 5px); cursor: ew-resize; }
  `
  document.head.appendChild(style)

  function isAutoId(id) {
    return Boolean(autoControls) && AUTO_ID.test(id)
  }

  function controlsFor(id) {
    if (id !== '*' && Object.hasOwn(allowed, id) && Array.isArray(allowed[id])) return allowed[id]
    return isAutoId(id) ? autoControls : null
  }

  function textEditable(element) {
    return element.tagName !== 'IMG' && [...element.querySelectorAll('*')].every((child) => INLINE_TAGS.has(child.tagName))
  }

  function ownTextNodes(element) {
    return [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim())
  }

  // Where a text change lands: the whole element when it only holds text, or
  // its single text node when it also holds an icon ("Agendar →" with an <svg>),
  // so the icon survives. Anything more structured has no editable text.
  function textTarget(element) {
    if (element.tagName === 'IMG') return null
    if (textEditable(element)) return element
    const nodes = ownTextNodes(element)
    return nodes.length === 1 ? nodes[0] : null
  }

  function inline(element) {
    return getComputedStyle(element).display === 'inline'
  }

  // Text as the visitor reads it. Animated headings often split words into
  // inline-block spans spaced by margin, so neither textContent nor innerText
  // carries the spaces; <br> becomes a line break.
  function smartText(node) {
    let text = ''
    let previous = null
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        text += child.nodeValue
        previous = null
        continue
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue
      if (child.tagName === 'BR') {
        text += '\n'
        previous = null
        continue
      }
      const piece = smartText(child)
      const gap = !inline(child) || Number.parseFloat(getComputedStyle(child).marginLeft) > 0
        || (previous && (!inline(previous) || Number.parseFloat(getComputedStyle(previous).marginRight) > 0))
      if (piece && gap && text && !/\s$/.test(text) && !/^\s/.test(piece)) text += ' '
      text += piece
      previous = child
    }
    return text
  }

  function readText(element) {
    const target = textTarget(element)
    return target?.nodeType === Node.TEXT_NODE ? target.nodeValue : smartText(element)
  }

  // Keep the untouched markup (word spans, <em>, icons) so undo restores it exactly.
  function snapshotContent(id, element) {
    if (pristineContent.has(id)) return
    const target = textTarget(element) || element
    pristineContent.set(id, target.nodeType === Node.TEXT_NODE
      ? { node: target, value: target.nodeValue }
      : { element: target, nodes: [...target.childNodes].map((node) => node.cloneNode(true)) })
  }

  function writeText(id, element, value) {
    // Writing the same text again would reset the caret while the client types.
    if (readText(element) === value) return
    snapshotContent(id, element)
    const target = textTarget(element) || element
    if (target.nodeType === Node.TEXT_NODE) {
      target.nodeValue = value
      return
    }
    target.replaceChildren(...value.split('\n').flatMap((line, index) => (
      index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]
    )))
  }

  // Automatic elements only expose the controls that make sense for them.
  function elementControls(id, element) {
    const controls = controlsFor(id)
    if (!controls || !isAutoId(id) || Object.hasOwn(allowed, id)) return controls
    const image = element.tagName === 'IMG'
    return controls.filter((control) => {
      if (control === 'text') return textTarget(element) !== null
      if (control === 'logo') return image
      return !image
    })
  }

  function originalSrc(image) {
    return image.getAttribute('data-no-editor-src') ?? image.getAttribute('src') ?? ''
  }

  function srcIdFor(image) {
    let path
    try {
      const url = new URL(originalSrc(image), location.href)
      path = url.origin === location.origin ? url.pathname : `${url.host}${url.pathname}`
    } catch {
      return ''
    }
    const id = `${SRC_PREFIX}${path.replace(/^\/+/, '').replace(/[^A-Za-z0-9/._-]/g, '_')}`
    return id.length > SRC_PREFIX.length && AUTO_ID.test(id) ? id : ''
  }

  function autoIdFor(element) {
    if (element.tagName === 'IMG') {
      const id = srcIdFor(element)
      if (id) return id
    }
    const parts = []
    for (let node = element; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
      if (node.id && ANCHOR_ID.test(node.id) && document.getElementById(node.id) === node) {
        parts.push(`#${node.id}`)
        const id = `auto:${parts.reverse().join('/')}`
        return AUTO_ID.test(id) ? id : ''
      }
      let index = 1
      for (let sibling = node.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.tagName === node.tagName) index++
      }
      parts.push(`${node.tagName.toLowerCase()}.${index}`)
    }
    const id = `auto:${parts.reverse().join('/')}`
    return AUTO_ID.test(id) ? id : ''
  }

  function resolveAuto(id) {
    const parts = id.slice('auto:'.length).split('/')
    let node = document.body
    if (parts[0]?.startsWith('#')) node = document.getElementById(parts.shift().slice(1))
    for (const part of parts) {
      const match = /^([a-z][a-z0-9-]*)\.(\d+)$/.exec(part)
      if (!node || !match) return null
      const tag = match[1].toUpperCase()
      let remaining = Number(match[2])
      let next = null
      for (const child of node.children) {
        if (child.tagName === tag && --remaining === 0) {
          next = child
          break
        }
      }
      node = next
    }
    return node && node !== document.body ? node : null
  }

  function elementsFor(id) {
    if (!id) return []
    if (isAutoId(id) && !Object.hasOwn(allowed, id)) {
      if (id.startsWith(SRC_PREFIX)) return [...document.querySelectorAll('img')].filter((image) => srcIdFor(image) === id)
      const element = resolveAuto(id)
      return element ? [element] : []
    }
    return [...document.querySelectorAll('[data-editor]')].filter(
      (element) => element.getAttribute('data-editor') === id,
    )
  }

  function idFor(element) {
    const mapped = element.getAttribute('data-editor')
    if (mapped && controlsFor(mapped)) return mapped
    return autoControls ? autoIdFor(element) : ''
  }

  function isAutoCandidate(element) {
    if (element === document.body || element === document.documentElement || element.closest('#no-editor-selection, svg')) return false
    if (element.tagName === 'IMG') return true
    if (TEXT_TAGS.has(element.tagName)) return (element.textContent || '').trim() !== ''
    return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.nodeValue.trim())
  }

  function editableFrom(target) {
    const start = target instanceof Element ? target : target?.parentElement
    if (!start || start.closest('#no-editor-selection')) return null
    const mapped = start.closest('[data-editor]')
    if (mapped && controlsFor(mapped.getAttribute('data-editor'))) return mapped
    if (!autoControls) return null
    for (let element = start; element && element !== document.body; element = element.parentElement) {
      if (!isAutoCandidate(element)) continue
      // A click on an <em> or <strong> means the whole heading or paragraph.
      let candidate = element
      while (INLINE_TAGS.has(candidate.tagName) && candidate.parentElement && candidate.parentElement !== document.body
        && isAutoCandidate(candidate.parentElement) && textEditable(candidate.parentElement)) candidate = candidate.parentElement
      return candidate
    }
    return null
  }

  // Decorative layers (gradients, video veils) often sit on top of the text;
  // look through them before giving up on the click.
  function pickAt(event) {
    const direct = editableFrom(event.target)
    if (direct || !autoControls || typeof document.elementsFromPoint !== 'function') return direct
    for (const element of document.elementsFromPoint(event.clientX, event.clientY)) {
      const candidate = editableFrom(element)
      if (candidate) return candidate
    }
    return null
  }

  function selectedElement() {
    return elementsFor(selectedId)[0] || null
  }

  function ensureOverlay() {
    if (overlay) return overlay
    overlay = document.createElement('div')
    overlay.id = 'no-editor-selection'
    overlay.hidden = true
    const label = document.createElement('span')
    label.className = 'no-editor-label'
    overlay.appendChild(label)
    for (const direction of ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']) {
      const handle = document.createElement('span')
      handle.className = 'no-editor-handle'
      handle.dataset.handle = direction
      handle.addEventListener('pointerdown', beginResize)
      overlay.appendChild(handle)
    }
    document.body.appendChild(overlay)
    return overlay
  }

  function updateOverlay() {
    if (!editorMode && !overlay) return
    const box = ensureOverlay()
    const element = editorMode ? selectedElement() : null
    if (!element) {
      box.hidden = true
      return
    }
    const rect = element.getBoundingClientRect()
    box.hidden = false
    box.style.left = `${rect.left}px`
    box.style.top = `${rect.top}px`
    box.style.width = `${rect.width}px`
    box.style.height = `${rect.height}px`
    const label = box.querySelector('.no-editor-label')
    const text = labels.get(selectedId) || selectedId
    if (label.textContent !== text) label.textContent = text
  }

  function setHovered(element) {
    if (hovered === element) return
    hovered?.removeAttribute('data-no-editor-hover')
    hovered = element
    hovered?.setAttribute('data-no-editor-hover', '')
  }

  function post(type, componentId, changes, values, extra) {
    const payload = {
      source: 'no-editor-preview',
      type,
      version: 1,
      projectId,
      baseVersionId: versionId,
      componentId,
      ...extra,
    }
    if (changes) payload.changes = changes
    if (values) payload.values = values
    window.parent.postMessage(payload, acceptedParentOrigin)
  }

  function hexColor(value) {
    const match = value.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!match) return '#111111'
    return `#${match.slice(1, 4).map((part) => Number(part).toString(16).padStart(2, '0')).join('')}`
  }

  function positionValues(element) {
    return {
      left: Number.parseFloat(element.style.left) || 0,
      top: Number.parseFloat(element.style.top) || 0,
    }
  }

  function currentValues(element) {
    const rect = element.getBoundingClientRect()
    const computed = getComputedStyle(element)
    const position = positionValues(element)
    const values = {
      text: element.tagName === 'IMG' ? '' : readText(element),
      size: String(Math.round(Number.parseFloat(computed.fontSize) || 16)),
      color: hexColor(computed.color),
      x: String(Math.round(position.left)),
      y: String(Math.round(position.top)),
      width: String(Math.round(rect.width)),
      height: String(Math.round(rect.height)),
    }
    if (element.tagName === 'IMG') values.logo = element.currentSrc || element.src || ''
    return values
  }

  // Snapshot the untouched element once, so the export can show "before → after"
  // and undo can put back the inline styles the prototype itself set.
  function remember(id, element) {
    if (originals.has(id)) return
    originals.set(id, currentValues(element))
    const { position, left, top, width, height, fontSize, color } = element.style
    pristineStyle.set(id, {
      position, left, top, width, height, fontSize, color,
      src: element.getAttribute('src'),
      srcset: element.getAttribute('srcset'),
      sizes: element.getAttribute('sizes'),
      sources: pictureSources(element).map((source) => [source, source.getAttribute('srcset')]),
    })
  }

  function pictureSources(element) {
    return element.parentElement?.tagName === 'PICTURE'
      ? [...element.parentElement.querySelectorAll('source')]
      : []
  }

  function setAttribute(element, name, value) {
    if (value === null) element.removeAttribute(name)
    else element.setAttribute(name, value)
  }

  function restore(id, element, field) {
    const style = pristineStyle.get(id)
    if (!style) return
    if (field === 'text') {
      const content = pristineContent.get(id)
      if (!content) return
      if (content.node) content.node.nodeValue = content.value
      else content.element.replaceChildren(...content.nodes.map((node) => node.cloneNode(true)))
      pristineContent.delete(id)
    } else if (field === 'size') element.style.fontSize = style.fontSize
    else if (field === 'color') element.style.color = style.color
    else if (field === 'logo') {
      element.removeAttribute('data-no-editor-src')
      setAttribute(element, 'src', style.src)
      setAttribute(element, 'srcset', style.srcset)
      setAttribute(element, 'sizes', style.sizes)
      for (const [source, srcset] of style.sources) setAttribute(source, 'srcset', srcset)
    }
    else if (field === 'x') element.style.left = style.left
    else if (field === 'y') element.style.top = style.top
    else if (field === 'width') element.style.width = style.width
    else if (field === 'height') element.style.height = style.height
  }

  function shorten(value, size) {
    const clean = value.replace(/\s+/g, ' ').trim()
    return clean.length > size ? `${clean.slice(0, size - 1)}…` : clean
  }

  function labelFor(id, element) {
    const tag = element.tagName
    const kind = tag === 'IMG'
      ? 'Imagem'
      : /^H[1-6]$/.test(tag)
        ? KIND[tag]
        : element.closest('button')
          ? 'Botão'
          : element.closest('a')
            ? 'Link'
            : KIND[tag] || 'Texto'
    const sample = shorten(tag === 'IMG' ? element.getAttribute('alt') || '' : originals.get(id)?.text ?? readText(element), 48)
    const label = sample ? `${kind} “${sample}”` : kind
    // Photos often share one alt text; the file name tells them apart.
    const file = tag === 'IMG' ? originalSrc(element).split(/[?#]/)[0].split('/').pop() : ''
    return file ? `${label} · ${file}` : label
  }

  function screenFor(element) {
    const region = element.closest('section, header, footer, nav, aside, dialog, [role="dialog"]')
    if (!region) return 'Página'
    if (region.tagName === 'HEADER') return 'Topo'
    if (region.tagName === 'FOOTER') return 'Rodapé'
    if (region.tagName === 'NAV') return 'Menu'
    if (region.tagName === 'DIALOG' || region.getAttribute('role') === 'dialog') return 'Janela'
    const heading = region.querySelector('h1, h2, h3')
    // The original heading text, so a section keeps its name after the client edits it.
    const title = heading ? shorten(originals.get(idFor(heading))?.text ?? smartText(heading), 40) : ''
    if (title) return title
    if (region.id) return region.id
    return `Seção ${[...document.querySelectorAll('section')].indexOf(region) + 1}`
  }

  function select(element) {
    const id = element ? idFor(element) : ''
    if (!id || !controlsFor(id)) return
    selectedId = id
    remember(id, element)
    const auto = isAutoId(id) && !Object.hasOwn(allowed, id)
    if (auto && !labels.has(id)) labels.set(id, labelFor(id, element))
    updateOverlay()
    post('NO_EDITOR_SELECT', id, null, currentValues(element), {
      original: originals.get(id),
      ...(auto ? { meta: { label: labels.get(id), screen: screenFor(element), controls: elementControls(id, element) } } : {}),
    })
  }

  function applyLayout(element, change) {
    const numeric = (value) => typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : null
    const x = numeric(change.x)
    const y = numeric(change.y)
    const width = numeric(change.width)
    const height = numeric(change.height)
    if (x !== null || y !== null) element.style.position = 'relative'
    if (x !== null && x >= -2000 && x <= 2000) element.style.left = `${x}px`
    if (y !== null && y >= -2000 && y <= 2000) element.style.top = `${y}px`
    if (change.width === '') element.style.removeProperty('width')
    else if (width !== null && width >= 20 && width <= 4000) element.style.width = `${width}px`
    if (change.height === '') element.style.removeProperty('height')
    else if (height !== null && height >= 20 && height <= 4000) element.style.height = `${height}px`
  }

  function applyChanges(changes, restoreMissing = true) {
    // Fields that left the draft (undo, discard) go back to the original look.
    for (const [id, fields] of restoreMissing ? appliedFields : []) {
      const change = changes[id] && typeof changes[id] === 'object' ? changes[id] : {}
      const elements = elementsFor(id)
      let moved = false
      for (const field of [...fields]) {
        if (Object.hasOwn(change, field)) continue
        for (const element of elements) restore(id, element, field)
        fields.delete(field)
        moved ||= field === 'x' || field === 'y'
      }
      if (moved && !fields.has('x') && !fields.has('y')) {
        for (const element of elements) element.style.position = pristineStyle.get(id)?.position ?? ''
      }
      if (!fields.size) appliedFields.delete(id)
    }
    for (const [id, change] of Object.entries(changes)) {
      if (!change || typeof change !== 'object' || Array.isArray(change)) continue
      for (const element of elementsFor(id)) {
        const controls = elementControls(id, element)
        if (!controls) continue
        remember(id, element)
        const fields = appliedFields.get(id) ?? new Set()
        appliedFields.set(id, fields)
        for (const field of [...contentFields, ...layoutFields]) if (Object.hasOwn(change, field)) fields.add(field)
        if (controls.includes('text') && typeof change.text === 'string' && element.tagName !== 'IMG') writeText(id, element, change.text)
        if (controls.includes('size') && /^\d+(\.\d+)?$/.test(change.size) && Number(change.size) >= 8 && Number(change.size) <= 160) element.style.fontSize = `${Number(change.size)}px`
        if (controls.includes('color') && /^#[0-9a-f]{6}$/i.test(change.color)) element.style.color = change.color
        if (controls.includes('logo') && typeof change.logo === 'string' && element.tagName === 'IMG') {
          try {
            const url = new URL(change.logo)
            if (url.protocol === 'https:' && element.getAttribute('src') !== url.href) {
              if (!element.hasAttribute('data-no-editor-src')) element.setAttribute('data-no-editor-src', element.getAttribute('src') ?? '')
              // srcset and <picture> sources win over src; drop them so the new image shows.
              element.removeAttribute('srcset')
              element.removeAttribute('sizes')
              for (const source of pictureSources(element)) source.removeAttribute('srcset')
              element.src = url.href
            }
          } catch {
            // Reject malformed and non-HTTPS logo URLs.
          }
        }
        if (layoutFields.some((field) => Object.hasOwn(change, field))) applyLayout(element, change)
      }
    }
    scheduleOverlay()
  }

  function endTextEditing() {
    if (!editingElement) return
    const element = editingElement
    editingElement = null
    editingId = ''
    element.removeAttribute('contenteditable')
    element.removeEventListener('input', publishText)
    element.removeEventListener('blur', endTextEditing)
  }

  function publishText() {
    if (editingId && editingElement) post('NO_EDITOR_CHANGE', editingId, { text: readText(editingElement) })
    updateOverlay()
  }

  function beginTextEditing(event) {
    if (!editorMode || (editingElement && editingElement.contains(event.target))) return
    const element = pickAt(event)
    const id = element ? idFor(element) : ''
    // Inline editing only where the element is pure text; icon buttons use the panel field.
    if (!id || !elementControls(id, element)?.includes('text') || textTarget(element) !== element) return
    event.preventDefault()
    event.stopPropagation()
    endTextEditing()
    select(element)
    snapshotContent(id, element)
    editingElement = element
    editingId = id
    element.setAttribute('contenteditable', 'true')
    element.addEventListener('input', publishText)
    element.addEventListener('blur', endTextEditing)
    element.focus()
    const range = document.createRange()
    range.selectNodeContents(element)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
  }

  function beginMove(event) {
    if (!editorMode || event.button !== 0 || event.target.closest?.('#no-editor-selection')) return
    if (editingElement && editingElement.contains(event.target)) return
    const element = pickAt(event)
    if (!element) return
    select(element)
    const current = positionValues(element)
    gesture = {
      type: 'move',
      id: selectedId,
      element,
      startX: event.clientX,
      startY: event.clientY,
      left: current.left,
      top: current.top,
      moved: false,
    }
  }

  function beginResize(event) {
    if (!editorMode || event.button !== 0) return
    const element = selectedElement()
    if (!element) return
    event.preventDefault()
    event.stopPropagation()
    const rect = element.getBoundingClientRect()
    const current = positionValues(element)
    gesture = {
      type: 'resize',
      id: selectedId,
      element,
      direction: event.currentTarget.dataset.handle,
      startX: event.clientX,
      startY: event.clientY,
      left: current.left,
      top: current.top,
      width: rect.width,
      height: rect.height,
    }
  }

  function updateGesture(event) {
    if (!gesture) {
      if (editorMode && event.target !== hoverTarget) {
        hoverTarget = event.target
        setHovered(pickAt(event))
      }
      return
    }
    const dx = event.clientX - gesture.startX
    const dy = event.clientY - gesture.startY
    if (gesture.type === 'move') {
      if (!gesture.moved && Math.hypot(dx, dy) < 3) return
      gesture.moved = true
      event.preventDefault()
      const x = Math.round(gesture.left + dx)
      const y = Math.round(gesture.top + dy)
      gesture.element.style.position = 'relative'
      gesture.element.style.left = `${x}px`
      gesture.element.style.top = `${y}px`
      post('NO_EDITOR_CHANGE', gesture.id, { x: String(x), y: String(y) })
    } else {
      event.preventDefault()
      const direction = gesture.direction
      let x = gesture.left
      let y = gesture.top
      let width = gesture.width
      let height = gesture.height
      if (direction.includes('e')) width = Math.max(20, gesture.width + dx)
      if (direction.includes('s')) height = Math.max(20, gesture.height + dy)
      if (direction.includes('w')) {
        width = Math.max(20, gesture.width - dx)
        x = gesture.left + (gesture.width - width)
      }
      if (direction.includes('n')) {
        height = Math.max(20, gesture.height - dy)
        y = gesture.top + (gesture.height - height)
      }
      const changes = {
        x: String(Math.round(x)),
        y: String(Math.round(y)),
        width: String(Math.round(width)),
        height: String(Math.round(height)),
      }
      applyLayout(gesture.element, changes)
      post('NO_EDITOR_CHANGE', gesture.id, changes)
    }
    updateOverlay()
  }

  function endGesture(event) {
    if (!gesture) return
    if (gesture.moved) {
      event.preventDefault()
      event.stopPropagation()
    }
    gesture = null
  }

  document.addEventListener('pointerdown', beginMove, true)
  document.addEventListener('pointermove', updateGesture, true)
  document.addEventListener('pointerup', endGesture, true)
  document.addEventListener('dblclick', beginTextEditing, true)
  // In editor mode a click selects; it never navigates, submits or opens the
  // prototype's own menus. Turning the mode off restores normal navigation.
  document.addEventListener('click', (event) => {
    if (!editorMode || event.target.closest?.('#no-editor-selection')) return
    if (editingElement && editingElement.contains(event.target)) return
    event.preventDefault()
    event.stopPropagation()
    const element = pickAt(event)
    if (element) select(element)
  }, true)
  // Ctrl/Cmd+Z inside the preview undoes in the dashboard; while typing in a
  // text, the browser's own undo keeps working.
  document.addEventListener('keydown', (event) => {
    if (!editorMode || editingElement || event.shiftKey || event.altKey || !(event.ctrlKey || event.metaKey)
      || event.key.toLowerCase() !== 'z') return
    event.preventDefault()
    post('NO_EDITOR_UNDO', '')
  }, true)
  window.addEventListener('scroll', scheduleOverlay, true)
  window.addEventListener('resize', scheduleOverlay)

  // A carousel that remounts a replaced photo gets the client's image again.
  function scheduleImages() {
    if (imageFrame || !Object.keys(lastChanges).some((id) => id.startsWith(SRC_PREFIX))) return
    imageFrame = requestAnimationFrame(() => {
      imageFrame = 0
      applyChanges(Object.fromEntries(Object.entries(lastChanges).filter(([id]) => id.startsWith(SRC_PREFIX))), false)
    })
  }

  new MutationObserver((records) => {
    // The selection label is UI owned by this bridge, not a preview mutation.
    // Observing our own textContent writes caused an endless animation-frame loop.
    if (records.some((record) => !overlay?.contains(record.target))) {
      scheduleOverlay()
      scheduleImages()
    }
  }).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })

  window.addEventListener('message', (event) => {
    const message = event.data
    if (event.source !== window.parent || event.origin !== acceptedParentOrigin || !message
      || message.source !== 'no-editor' || message.type !== 'NO_EDITOR_PREVIEW' || message.version !== 1
      || message.projectId !== projectId || message.baseVersionId !== versionId
      || !message.changes || typeof message.changes !== 'object' || Array.isArray(message.changes)) return

    editorMode = message.editorMode === true
    document.documentElement.classList.toggle('no-editor-mode', editorMode)
    if (typeof message.selectedComponent === 'string' && controlsFor(message.selectedComponent)) selectedId = message.selectedComponent
    if (!editorMode) {
      endTextEditing()
      hoverTarget = null
      setHovered(null)
    }
    lastChanges = message.changes
    applyChanges(message.changes)
    updateOverlay()
  })
})()

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
  let editorMode = false
  let selectedId = ''
  let overlay
  let editingElement
  let gesture
  let overlayFrame = 0

  function scheduleOverlay() {
    if (!editorMode || overlayFrame) return
    overlayFrame = requestAnimationFrame(() => {
      overlayFrame = 0
      updateOverlay()
    })
  }

  const style = document.createElement('style')
  style.textContent = `
    html.no-editor-mode [data-editor] { cursor: pointer !important; }
    html.no-editor-mode [data-editor]:hover { outline: 2px dashed #eda33b !important; outline-offset: 4px !important; }
    html.no-editor-mode [data-editor][contenteditable="true"] { cursor: text !important; outline: 2px solid #eda33b !important; }
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

  function selectedElement() {
    if (!selectedId) return null
    return [...document.querySelectorAll('[data-editor]')].find(
      (element) => element.getAttribute('data-editor') === selectedId,
    ) || null
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
    if (label.textContent !== selectedId) label.textContent = selectedId
  }

  function post(type, componentId, changes, values) {
    const payload = {
      source: 'no-editor-preview',
      type,
      version: 1,
      projectId,
      baseVersionId: versionId,
      componentId,
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

  function select(element) {
    const id = element?.getAttribute('data-editor') || ''
    if (!id || !Object.hasOwn(allowed, id)) return
    selectedId = id
    updateOverlay()
    const rect = element.getBoundingClientRect()
    const computed = getComputedStyle(element)
    const position = positionValues(element)
    post('NO_EDITOR_SELECT', id, null, {
      text: element.tagName === 'IMG' ? '' : element.textContent || '',
      size: String(Math.round(Number.parseFloat(computed.fontSize) || 16)),
      color: hexColor(computed.color),
      x: String(Math.round(position.left)),
      y: String(Math.round(position.top)),
      width: String(Math.round(rect.width)),
      height: String(Math.round(rect.height)),
    })
  }

  function positionValues(element) {
    return {
      left: Number.parseFloat(element.style.left) || 0,
      top: Number.parseFloat(element.style.top) || 0,
    }
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

  function applyChanges(changes) {
    for (const [id, controls] of Object.entries(allowed)) {
      if (!Array.isArray(controls) || !Object.hasOwn(changes, id)) continue
      const change = changes[id]
      if (!change || typeof change !== 'object' || Array.isArray(change)) continue
      for (const element of document.querySelectorAll('[data-editor]')) {
        if (element.getAttribute('data-editor') !== id) continue
        if (controls.includes('text') && typeof change.text === 'string' && element.tagName !== 'IMG') element.textContent = change.text
        if (controls.includes('size') && /^\d+(\.\d+)?$/.test(change.size) && Number(change.size) >= 8 && Number(change.size) <= 160) element.style.fontSize = `${Number(change.size)}px`
        if (controls.includes('color') && /^#[0-9a-f]{6}$/i.test(change.color)) element.style.color = change.color
        if (controls.includes('logo') && typeof change.logo === 'string' && element.tagName === 'IMG') {
          try {
            const url = new URL(change.logo)
            if (url.protocol === 'https:') element.src = url.href
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
    element.removeAttribute('contenteditable')
    element.removeEventListener('input', publishText)
    element.removeEventListener('blur', endTextEditing)
  }

  function publishText(event) {
    const element = event.currentTarget
    const id = element.getAttribute('data-editor')
    if (id) post('NO_EDITOR_CHANGE', id, { text: element.textContent || '' })
    updateOverlay()
  }

  function beginTextEditing(event) {
    if (!editorMode) return
    const element = event.target.closest?.('[data-editor]')
    const id = element?.getAttribute('data-editor')
    if (!id || !allowed[id]?.includes('text') || element.tagName === 'IMG') return
    event.preventDefault()
    event.stopPropagation()
    endTextEditing()
    select(element)
    editingElement = element
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
    const element = event.target.closest?.('[data-editor]')
    if (!element) return
    select(element)
    const current = positionValues(element)
    gesture = {
      type: 'move',
      id: element.getAttribute('data-editor'),
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
    if (!gesture) return
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
  document.addEventListener('click', (event) => {
    if (!editorMode) return
    const element = event.target.closest?.('[data-editor]')
    if (!element) return
    event.preventDefault()
    event.stopPropagation()
    select(element)
  }, true)
  window.addEventListener('scroll', scheduleOverlay, true)
  window.addEventListener('resize', scheduleOverlay)

  new MutationObserver((records) => {
    // The selection label is UI owned by this bridge, not a preview mutation.
    // Observing our own textContent writes caused an endless animation-frame loop.
    if (records.some((record) => !overlay?.contains(record.target))) scheduleOverlay()
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
    if (typeof message.selectedComponent === 'string' && Object.hasOwn(allowed, message.selectedComponent)) selectedId = message.selectedComponent
    if (!editorMode) endTextEditing()
    applyChanges(message.changes)
    updateOverlay()
  })
})()

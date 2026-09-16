/* Include only in a marked preview build, never in the immutable production build.
 * <script src=".../no-editor-preview.js" data-parent-origin="https://app.notechstack.com.br"
 * data-project-id="..." data-version-id="..." data-components='{"hero":["text","size","color","logo"]}'></script>
 */
(() => {
  'use strict'
  const script = document.currentScript
  if (!script || window.parent === window) return
  const parentOrigin = script.dataset.parentOrigin
  const projectId = script.dataset.projectId
  const versionId = script.dataset.versionId
  let allowed
  try {
    if (!parentOrigin || new URL(parentOrigin).origin !== parentOrigin || !projectId || !versionId) return
    allowed = JSON.parse(script.dataset.components || '{}')
    if (!allowed || typeof allowed !== 'object' || Array.isArray(allowed)) return
  } catch { return }
  window.addEventListener('message', (event) => {
    const message = event.data
    if (event.source !== window.parent || event.origin !== parentOrigin || !message
      || message.source !== 'no-editor' || message.type !== 'NO_EDITOR_PREVIEW' || message.version !== 1
      || message.projectId !== projectId || message.baseVersionId !== versionId
      || !message.changes || typeof message.changes !== 'object' || Array.isArray(message.changes)) return
    for (const [id, controls] of Object.entries(allowed)) {
      if (!Array.isArray(controls) || !Object.hasOwn(message.changes, id)) continue
      const change = message.changes[id]
      if (!change || typeof change !== 'object' || Array.isArray(change)) continue
      for (const element of document.querySelectorAll('[data-editor]')) {
        if (element.getAttribute('data-editor') !== id) continue
        if (controls.includes('text') && typeof change.text === 'string' && element.tagName !== 'IMG') element.textContent = change.text
        if (controls.includes('size') && /^\d+(\.\d+)?$/.test(change.size) && Number(change.size) >= 8 && Number(change.size) <= 160) element.style.fontSize = `${Number(change.size)}px`
        if (controls.includes('color') && /^#[0-9a-f]{6}$/i.test(change.color)) element.style.color = change.color
        if (controls.includes('logo') && typeof change.logo === 'string' && element.tagName === 'IMG') {
          try { const url = new URL(change.logo); if (url.protocol === 'https:') element.src = url.href } catch { /* reject non-HTTPS URLs */ }
        }
      }
    }
  })
})()

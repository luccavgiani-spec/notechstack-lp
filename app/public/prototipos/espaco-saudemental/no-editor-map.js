/* Mapa de componentes editáveis desta build de preview (Espaço Saúde Mental).
 *
 * O runtime oficial (`/no-editor-preview.js`) aplica os ajustes em elementos
 * marcados com `data-editor`. A LP é React e não carrega essas marcas, então
 * este arquivo — que existe só na cópia de preview, nunca no repositório da
 * cliente — carimba os atributos nos elementos certos depois que o React monta
 * e os recarimba quando um trecho é remontado.
 *
 * Os ids aqui precisam bater com `editor_version_configs.allowed_components`
 * da versão atual do projeto.
 */
;(() => {
  'use strict'

  const heroSection = () => document.querySelector('main > section')

  const MAPA = {
    marca_topo: () => document.querySelector('header button'),
    hero_titulo: () => heroSection()?.querySelector('h1'),
    hero_texto: () => heroSection()?.querySelector('p'),
    hero_cta: () => heroSection()?.querySelector('button'),
    valores_titulo: () => document.querySelector('#valores h2'),
  }

  function carimbar() {
    for (const [id, encontrar] of Object.entries(MAPA)) {
      let alvo
      try {
        alvo = encontrar()
      } catch {
        continue
      }
      if (!alvo || alvo.getAttribute('data-editor') === id) continue
      for (const antigo of document.querySelectorAll(`[data-editor="${id}"]`)) {
        antigo.removeAttribute('data-editor')
      }
      alvo.setAttribute('data-editor', id)
    }
  }

  let agendado = false
  function agendarCarimbo() {
    if (agendado) return
    agendado = true
    requestAnimationFrame(() => {
      agendado = false
      carimbar()
    })
  }

  // O React monta depois do script de módulo; o observer cobre tanto a montagem
  // inicial quanto as remontagens (carrossel, acordeão da FAQ, modal da agenda).
  new MutationObserver(agendarCarimbo).observe(document.documentElement, {
    childList: true,
    subtree: true,
  })
  carimbar()
  document.addEventListener('DOMContentLoaded', carimbar)
  window.addEventListener('load', carimbar)
})()

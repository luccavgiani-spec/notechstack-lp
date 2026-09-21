import { useCallback, useEffect, useRef, useState } from 'react'
import {
  finalizeEditorExport,
  loadEditorConfig,
  submitEditorExport,
  uploadEditorExportFiles,
  type EditorConfig,
} from './client-dashboard-service'

type DraftValue = {
  text: string
  size: string
  color: string
  logo: string
  x: string
  y: string
  width: string
  height: string
}
type Draft = Record<string, Partial<DraftValue>>
const contentControls = ['text', 'size', 'color', 'logo'] as const
const layoutControls = ['x', 'y', 'width', 'height'] as const
const emptyValue: DraftValue = {
  text: '',
  size: '16',
  color: '#111111',
  logo: '',
  x: '0',
  y: '0',
  width: '',
  height: '',
}
const keyFor = (projectId: string, versionId: string) =>
  `no_editor:${projectId}:${versionId}`

function controlsFor(component: EditorConfig['allowedComponents'][number]) {
  return [...new Set([...(component.controls ?? contentControls), ...layoutControls])]
}

function exportControlsFor(component: EditorConfig['allowedComponents'][number]) {
  return component.controls ?? contentControls
}

function validLayoutValue(field: string, value: string) {
  if (value === '' && (field === 'width' || field === 'height')) return true
  if (!/^-?\d+(\.\d+)?$/.test(value)) return false
  const numeric = Number(value)
  if (field === 'x' || field === 'y') return numeric >= -2000 && numeric <= 2000
  return numeric >= 20 && numeric <= 4000
}

function readDraft(projectId: string, config: EditorConfig): Draft {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(keyFor(projectId, config.versionId)) ?? '{}',
    )
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: Draft = {}
    for (const component of config.allowedComponents) {
      const candidate: unknown = (value as Record<string, unknown>)[
        component.id
      ]
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        Array.isArray(candidate)
      )
        continue
      const fields = candidate as Record<string, unknown>
      const legacyFullDraft = [...contentControls, ...layoutControls].every(
        (field) => typeof fields[field] === 'string',
      )
      const nextValue: Partial<DraftValue> = {}
      for (const field of [...contentControls, ...layoutControls] as const) {
        if (
          controlsFor(component).includes(field) &&
          typeof fields[field] === 'string' &&
          (!legacyFullDraft || fields[field] !== emptyValue[field])
        )
          nextValue[field] = fields[field]
      }
      if (
        nextValue.color !== undefined &&
        !/^#[0-9a-f]{6}$/i.test(nextValue.color)
      )
        delete nextValue.color
      if (
        nextValue.size !== undefined &&
        (!Number.isFinite(Number(nextValue.size)) ||
          Number(nextValue.size) < 8 ||
          Number(nextValue.size) > 160)
      )
        delete nextValue.size
      for (const field of layoutControls) {
        const fieldValue = nextValue[field]
        if (fieldValue !== undefined && !validLayoutValue(field, fieldValue))
          delete nextValue[field]
      }
      if (Object.keys(nextValue).length) result[component.id] = nextValue
    }
    return result
  } catch {
    return {}
  }
}

function download(name: string, value: string) {
  const url = URL.createObjectURL(
    new Blob([value], {
      type: name.endsWith('.json') ? 'application/json' : 'text/plain',
    }),
  )
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  URL.revokeObjectURL(url)
}

function previewUrl(config: EditorConfig | null) {
  if (!config?.bridgeEnabled) return null
  try {
    const url = new URL(config.buildReference)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (
      window.location.hostname === 'localhost' &&
      url.pathname.startsWith('/prototipos/')
    ) {
      const localPath = url.pathname.endsWith('/')
        ? `${url.pathname}index.html`
        : url.pathname
      return new URL(`${localPath}${url.search}${url.hash}`, window.location.origin)
    }
    return url
  } catch {
    return null
  }
}

export function EditorModule({ projectId }: { projectId: string }) {
  const [previewRevision, setPreviewRevision] = useState(0)
  const [selectedComponent, setSelectedComponent] = useState('')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [editorMode, setEditorMode] = useState(false)
  const [config, setConfig] = useState<EditorConfig | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [previewValues, setPreviewValues] = useState<Draft>({})
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [message, setMessage] = useState('')
  const frameRef = useRef<HTMLIFrameElement>(null)

  const change = useCallback(
    (id: string, field: keyof DraftValue, value: string) => {
      setConfirmDiscard(false)
      setDraft((old) => ({
        ...old,
        [id]: { ...old[id], [field]: value },
      }))
    },
    [],
  )

  const load = useCallback(() => {
    setLoading(true)
    setLoadFailed(false)
    void loadEditorConfig(projectId)
      .then((next) => {
        setConfig(next)
        setDraft(next ? readDraft(projectId, next) : {})
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setLoading(false))
  }, [projectId])
  useEffect(() => {
    let active = true
    void loadEditorConfig(projectId)
      .then((next) => {
        if (!active) return
        setConfig(next)
        setDraft(next ? readDraft(projectId, next) : {})
      })
      .catch(() => {
        if (active) setLoadFailed(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [projectId])

  const sendPreview = useCallback(() => {
    const target = previewUrl(config)
    if (!target || !config || !frameRef.current?.contentWindow) return
    frameRef.current.contentWindow.postMessage(
      {
        source: 'no-editor',
        type: 'NO_EDITOR_PREVIEW',
        version: 1,
        projectId,
        baseVersionId: config.versionId,
        changes: draft,
        selectedComponent,
        editorMode,
      },
      target.origin,
    )
  }, [config, draft, editorMode, projectId, selectedComponent])
  useEffect(() => sendPreview(), [sendPreview])

  useEffect(() => {
    const receivePreview = (event: MessageEvent) => {
      const target = previewUrl(config)
      const payload: unknown = event.data
      if (
        !editorMode ||
        !target ||
        !config ||
        event.origin !== target.origin ||
        event.source !== frameRef.current?.contentWindow ||
        !payload ||
        typeof payload !== 'object'
      )
        return
      const message = payload as Record<string, unknown>
      if (
        message.source !== 'no-editor-preview' ||
        message.version !== 1 ||
        message.projectId !== projectId ||
        message.baseVersionId !== config.versionId ||
        typeof message.componentId !== 'string'
      )
        return
      const component = config.allowedComponents.find(
        (item) => item.id === message.componentId,
      )
      if (!component) return
      setSelectedComponent(component.id)
      if (
        message.values &&
        typeof message.values === 'object' &&
        !Array.isArray(message.values)
      ) {
        const nextValue: Partial<DraftValue> = {}
        for (const [field, next] of Object.entries(message.values)) {
          if (
            (controlsFor(component) as readonly string[]).includes(field) &&
            typeof next === 'string' &&
            (!layoutControls.includes(field as (typeof layoutControls)[number]) ||
              validLayoutValue(field, next))
          )
            nextValue[field as keyof DraftValue] = next
        }
        setPreviewValues((current) => ({
          ...current,
          [component.id]: nextValue,
        }))
      }
      if (message.type !== 'NO_EDITOR_CHANGE') return
      if (
        !message.changes ||
        typeof message.changes !== 'object' ||
        Array.isArray(message.changes)
      )
        return
      const allowedControls = controlsFor(component)
      for (const [field, nextValue] of Object.entries(message.changes)) {
        if (
          !allowedControls.includes(field) ||
          typeof nextValue !== 'string' ||
          (layoutControls.includes(field as (typeof layoutControls)[number]) &&
            !validLayoutValue(field, nextValue))
        )
          continue
        change(component.id, field as keyof DraftValue, nextValue)
      }
    }
    window.addEventListener('message', receivePreview)
    return () => window.removeEventListener('message', receivePreview)
  }, [change, config, editorMode, projectId])

  if (loading)
    return (
      <section
        className="rounded-2xl border border-borda bg-white p-6"
        role="status"
      >
        Carregando Editor…
      </section>
    )
  if (loadFailed)
    return (
      <section className="rounded-2xl border border-vermelho bg-vermelho-tint p-6">
        <h2 className="text-xl font-bold">Editor indisponível</h2>
        <button
          type="button"
          className="mt-4 rounded-xl bg-tinta px-4 py-2 text-white"
          onClick={load}
        >
          Tentar de novo
        </button>
      </section>
    )
  if (!config)
    return (
      <section className="rounded-2xl border border-borda bg-white p-6">
        <h2 className="text-xl font-bold">Editor</h2>
        <p className="mt-2 text-cinza">
          Nenhuma configuração de edição foi liberada para a versão atual.
        </p>
      </section>
    )

  const target = previewUrl(config)
  const save = () => {
    try {
      localStorage.setItem(
        keyFor(projectId, config.versionId),
        JSON.stringify(draft),
      )
      setMessage('Ajustes salvos neste navegador.')
    } catch {
      setMessage(
        'Não foi possível salvar neste navegador. Seus ajustes continuam abertos.',
      )
    }
  }
  const discard = () => {
    localStorage.removeItem(keyFor(projectId, config.versionId))
    setDraft({})
    setPreviewRevision((revision) => revision + 1)
    setConfirmDiscard(false)
    setMessage('Rascunho descartado.')
  }
  const send = async () => {
    const changes = Object.entries(draft).flatMap(([component, value]) => {
      const allowed = config.allowedComponents.find(
        (item) => item.id === component,
      )
      const after = Object.fromEntries(
        Object.entries(value).filter(([field]) =>
          allowed
            ? (exportControlsFor(allowed) as readonly string[]).includes(field)
            : false,
        ),
      )
      return Object.keys(after).length
        ? [{
            screen: allowed?.screen ?? 'geral',
            component,
            before: {},
            after,
          }]
        : []
    })
    if (changes.length === 0) {
      setMessage('Faça ao menos um ajuste antes de enviar.')
      return
    }
    setSending(true)
    setMessage('')
    try {
      localStorage.setItem(
        keyFor(projectId, config.versionId),
        JSON.stringify(draft),
      )
      const coreFiles = {
        'editor.md': `# Ajustes ${config.label}\n\n${changes.map((item) => `## ${item.screen} / ${item.component}\n\n${JSON.stringify(item.after, null, 2)}`).join('\n\n')}`,
        'editor.cfg': JSON.stringify(draft, null, 2),
        'editor.css': Object.entries(draft)
          .map(([id, value]) => {
            const declarations = [
              value.size ? `font-size: ${value.size}px` : '',
              value.color ? `color: ${value.color}` : '',
              value.x !== undefined || value.y !== undefined
                ? 'position: relative'
                : '',
              value.x !== undefined ? `left: ${value.x}px` : '',
              value.y !== undefined ? `top: ${value.y}px` : '',
              value.width ? `width: ${value.width}px` : '',
              value.height ? `height: ${value.height}px` : '',
            ].filter(Boolean)
            return declarations.length
              ? `[data-editor="${id}"] { ${declarations.join('; ')}; }`
              : ''
          })
          .filter(Boolean)
          .join('\n'),
      }
      const baseManifest = {
        schema_version: 1,
        project_id: projectId,
        base_version_id: config.versionId,
        base_version_label: config.label,
        build_reference: config.buildReference,
        changes,
        files: [...Object.keys(coreFiles), 'manifest.json'],
      }
      const result = await submitEditorExport(
        projectId,
        config.versionId,
        changes,
        baseManifest,
      )
      const manifest = JSON.stringify(
        { ...baseManifest, content_sha256: result.contentSha256 },
        null,
        2,
      )
      const files = { ...coreFiles, 'manifest.json': manifest }
      await uploadEditorExportFiles(projectId, result.contentSha256, files)
      await finalizeEditorExport(result.exportId)
      Object.entries(files).forEach(([name, value]) => download(name, value))
      localStorage.setItem(
        keyFor(projectId, config.versionId),
        JSON.stringify(draft),
      )
      setMessage(
        result.conflict
          ? 'Pacote enviado com alerta de versão-base desatualizada; a Nó fará a conciliação.'
          : result.contentReplay
            ? 'Este mesmo pacote já estava recebido; os quatro arquivos foram recuperados sem duplicar o checklist.'
            : 'Pacote privado enviado para análise. A Nó implementa na próxima versão.',
      )
    } catch {
      setMessage(
        'Não foi possível concluir o envio. O rascunho foi preservado; tente novamente.',
      )
    } finally {
      setSending(false)
    }
  }

  const screen = 'Página única'
  const component = config.allowedComponents.find(
    (item) => item.id === selectedComponent,
  )
  const controls = component ? controlsFor(component) : []
  const value = component
    ? {
        ...emptyValue,
        ...previewValues[component.id],
        ...draft[component.id],
      }
    : emptyValue
  return (
    <section className="editor-workspace">
      <aside className="editor-screens">
        <p className="eyebrow">Página</p>
        <button type="button" className="selected" aria-current="page">
          {screen}
        </button>
        <div className="editor-base">
          <p className="eyebrow">Versão base</p>
          <h2>Editor · {config.label}</h2>
          <p>{config.buildReference}</p>
        </div>
      </aside>
      <div className="editor-canvas">
        <header>
          <span>Pré-visualização</span>
          <div className="editor-toolbar">
            <div className="device-toggle">
              <button
                aria-pressed={device === 'desktop'}
                onClick={() => setDevice('desktop')}
              >
                ▱ Desktop
              </button>
              <button
                aria-pressed={device === 'mobile'}
                onClick={() => setDevice('mobile')}
              >
                ▯ Celular
              </button>
            </div>
            <button
              type="button"
              className="editor-mode-toggle"
              aria-pressed={editorMode}
              onClick={() => setEditorMode((active) => !active)}
            >
              {editorMode ? '✓ Modo editor' : '✦ Modo editor'}
            </button>
          </div>
          <small>{target ? 'Preview controlado' : 'Ajustes locais'}</small>
        </header>
        <div
          className={`editor-preview ${device}${editorMode ? ' is-editing' : ''}`}
        >
          {target ? (
            <iframe
              key={previewRevision}
              ref={frameRef}
              title={`Preview controlado ${config.label}`}
              src={target.href}
              onLoad={sendPreview}
              sandbox="allow-forms allow-scripts allow-same-origin"
            />
          ) : (
            <div className="local-preview">
              <p className="eyebrow">{screen ?? 'Prévia'}</p>
              <p className="preview-disclaimer">
                A versão ainda não disponibiliza prévia integrada. Confira
                abaixo os ajustes do componente selecionado.
              </p>
              {component ? (
                <div
                  style={{ fontSize: `${value.size}px`, color: value.color }}
                >
                  {value.text || component.label || component.id}
                </div>
              ) : (
                <p>Nenhum componente liberado.</p>
              )}
              {value.logo ? (
                <p className="preview-disclaimer">Logo: {value.logo}</p>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <aside className="editor-inspector">
        <p className="eyebrow">Elemento selecionado</p>
        {component ? (
          <div className="selected-component-card">
            <strong>{component.label ?? component.id}</strong>
            <small>{component.screen ?? 'geral'}</small>
          </div>
        ) : (
          <div className="selection-empty">
            <span aria-hidden="true">{editorMode ? '↖' : '✦'}</span>
            <p>
              {editorMode
                ? 'Selecione um texto, botão ou imagem diretamente no preview.'
                : 'Ative o Modo editor para selecionar e ajustar um elemento no preview.'}
            </p>
          </div>
        )}
        {component ? (
          <fieldset className="component-controls" disabled={sending}>
            <legend>{component.label ?? component.id}</legend>
            {controls.includes('text') ? (
              <label>
                Texto
                <input
                  aria-label={`Texto ${component.id}`}
                  value={value.text}
                  onChange={(event) =>
                    change(component.id, 'text', event.target.value)
                  }
                  placeholder="Digite seu ajuste"
                />
              </label>
            ) : null}
            {controls.includes('size') ? (
              <label>
                Tamanho <span>{value.size} px</span>
                <input
                  aria-label={`Tamanho ${component.id}`}
                  type="range"
                  min="8"
                  max="160"
                  value={value.size}
                  onChange={(event) =>
                    change(component.id, 'size', event.target.value)
                  }
                />
              </label>
            ) : null}
            {controls.includes('color') ? (
              <label>
                Cor
                <div className="color-options">
                  <input
                    aria-label={`Cor ${component.id}`}
                    type="color"
                    value={value.color}
                    onChange={(event) =>
                      change(component.id, 'color', event.target.value)
                    }
                  />
                  {['#141414', '#3D63DB', '#EDA33B', '#30A46C'].map((color) => (
                    <button
                      type="button"
                      key={color}
                      aria-label={`Usar cor ${color}`}
                      aria-pressed={value.color === color}
                      style={{ background: color }}
                      onClick={() => change(component.id, 'color', color)}
                    />
                  ))}
                </div>
              </label>
            ) : null}
            {controls.includes('logo') ? (
              <label>
                Logo
                <input
                  aria-label={`Logo ${component.id}`}
                  value={value.logo}
                  onChange={(event) =>
                    change(component.id, 'logo', event.target.value)
                  }
                  placeholder="URL do logo"
                />
              </label>
            ) : null}
            <div className="layout-readout">
              <span>Posição</span>
              <strong>{value.x}, {value.y}</strong>
              <span>Tamanho</span>
              <strong>{value.width || 'auto'} × {value.height || 'auto'}</strong>
              <button
                type="button"
                onClick={() => {
                  change(component.id, 'x', '0')
                  change(component.id, 'y', '0')
                  change(component.id, 'width', '')
                  change(component.id, 'height', '')
                }}
              >
                Redefinir posição e tamanho
              </button>
            </div>
          </fieldset>
        ) : null}
        <p className="editor-help">
          No Modo editor, clique para selecionar, arraste para mover, use as
          alças para redimensionar e dê duplo clique em textos para editar.
          “Salvar” guarda o rascunho neste navegador.
        </p>
        <div className="editor-actions">
          <p className="eyebrow">
            {Object.keys(draft).length
              ? `${Object.keys(draft).length} componente(s) ajustado(s)`
              : 'Nenhum ajuste no rascunho'}
          </p>
          <button disabled={sending} className="button-outline" onClick={save}>
            Salvar ajustes
          </button>
          <button
            disabled={sending}
            className="button-green"
            onClick={() => void send()}
          >
            {sending ? 'Enviando…' : 'Enviar para análise'}
          </button>
          {!confirmDiscard ? (
            <button
              disabled={sending}
              className="discard-button"
              onClick={() => setConfirmDiscard(true)}
            >
              Descartar rascunho
            </button>
          ) : (
            <>
              <button className="discard-button" onClick={discard}>
                Confirmar descarte
              </button>
              <button onClick={() => setConfirmDiscard(false)}>Cancelar</button>
            </>
          )}
          {message ? <p role="status">{message}</p> : null}
        </div>
      </aside>
    </section>
  )
}

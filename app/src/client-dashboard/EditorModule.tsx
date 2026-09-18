import { useCallback, useEffect, useRef, useState } from 'react'
import {
  finalizeEditorExport,
  loadEditorConfig,
  submitEditorExport,
  uploadEditorExportFiles,
  type EditorConfig,
} from './client-dashboard-service'

type DraftValue = { text: string; size: string; color: string; logo: string }
type Draft = Record<string, DraftValue>
const emptyValue: DraftValue = {
  text: '',
  size: '16',
  color: '#111111',
  logo: '',
}
const keyFor = (projectId: string, versionId: string) =>
  `no_editor:${projectId}:${versionId}`

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
      result[component.id] = { ...emptyValue }
      for (const field of ['text', 'size', 'color', 'logo'] as const) {
        if (
          (component.controls ?? ['text', 'size', 'color', 'logo']).includes(
            field,
          ) &&
          typeof fields[field] === 'string'
        )
          result[component.id][field] = fields[field]
      }
      if (!/^#[0-9a-f]{6}$/i.test(result[component.id].color))
        result[component.id].color = emptyValue.color
      if (
        !Number.isFinite(Number(result[component.id].size)) ||
        Number(result[component.id].size) < 8 ||
        Number(result[component.id].size) > 160
      )
        result[component.id].size = emptyValue.size
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
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

export function EditorModule({ projectId }: { projectId: string }) {
  const [previewRevision, setPreviewRevision] = useState(0)
  const [selectedScreen, setSelectedScreen] = useState('')
  const [selectedComponent, setSelectedComponent] = useState('')
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [config, setConfig] = useState<EditorConfig | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [sending, setSending] = useState(false)
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [message, setMessage] = useState('')
  const frameRef = useRef<HTMLIFrameElement>(null)

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
      },
      target.origin,
    )
  }, [config, draft, projectId])
  useEffect(() => sendPreview(), [sendPreview])

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
  const change = (id: string, field: keyof DraftValue, value: string) => {
    setConfirmDiscard(false)
    setDraft((old) => ({
      ...old,
      [id]: { ...emptyValue, ...old[id], [field]: value },
    }))
  }
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
    const changes = Object.entries(draft).map(([component, value]) => {
      const allowed = config.allowedComponents.find(
        (item) => item.id === component,
      )
      const after = Object.fromEntries(
        Object.entries(value).filter(([field]) =>
          (allowed?.controls ?? ['text', 'size', 'color', 'logo']).includes(
            field,
          ),
        ),
      )
      return {
        screen: allowed?.screen ?? 'geral',
        component,
        before: {},
        after,
      }
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
          .map(
            ([id, value]) =>
              `[data-editor="${id}"] { font-size: ${value.size}px; color: ${value.color}; }`,
          )
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

  const screens = [
    ...new Set(config.allowedComponents.map((item) => item.screen ?? 'geral')),
  ]
  const screen = screens.includes(selectedScreen) ? selectedScreen : screens[0]
  const components = config.allowedComponents.filter(
    (item) => (item.screen ?? 'geral') === screen,
  )
  const component =
    components.find((item) => item.id === selectedComponent) ?? components[0]
  const controls = component?.controls ?? ['text', 'size', 'color', 'logo']
  const value = component ? (draft[component.id] ?? emptyValue) : emptyValue
  return (
    <section className="editor-workspace">
      <aside className="editor-screens">
        <p className="eyebrow">Telas</p>
        {screens.map((name) => (
          <button
            key={name}
            className={screen === name ? 'selected' : ''}
            onClick={() => {
              setSelectedScreen(name)
              setSelectedComponent('')
            }}
          >
            {name}
          </button>
        ))}
        <div className="editor-base">
          <p className="eyebrow">Versão base</p>
          <h2>Editor · {config.label}</h2>
          <p>{config.buildReference}</p>
        </div>
      </aside>
      <div className="editor-canvas">
        <header>
          <span>Pré-visualização</span>
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
          <small>{target ? 'Preview controlado' : 'Ajustes locais'}</small>
        </header>
        <div className={`editor-preview ${device}`}>
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
        <p className="eyebrow">Componentes liberados</p>
        <div className="component-list">
          {components.map((item) => (
            <button
              key={item.id}
              className={component?.id === item.id ? 'selected' : ''}
              onClick={() => setSelectedComponent(item.id)}
            >
              <span>{item.label ?? item.id}</span>
              <small>
                {(item.controls ?? ['text', 'size', 'color', 'logo'])
                  .map(
                    (control) =>
                      ({
                        text: 'texto',
                        size: 'tam',
                        color: 'cor',
                        logo: 'logo',
                      })[control] ?? control,
                  )
                  .join(' · ')}
              </small>
            </button>
          ))}
        </div>
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
          </fieldset>
        ) : null}
        <p className="editor-help">
          Nada aqui altera o sistema. “Salvar” guarda o rascunho neste
          navegador; “Enviar para análise” manda um pacote privado para a nó.
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

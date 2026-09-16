import { useCallback, useEffect, useRef, useState } from 'react'
import { finalizeEditorExport, loadEditorConfig, submitEditorExport, uploadEditorExportFiles, type EditorConfig } from './client-dashboard-service'

type DraftValue = { text: string; size: string; color: string; logo: string }
type Draft = Record<string, DraftValue>
const emptyValue: DraftValue = { text: '', size: '16', color: '#111111', logo: '' }
const keyFor = (projectId: string, versionId: string) => `no_editor:${projectId}:${versionId}`

function readDraft(projectId: string, config: EditorConfig): Draft {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyFor(projectId, config.versionId)) ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
    const result: Draft = {}
    for (const component of config.allowedComponents) {
      const candidate: unknown = (value as Record<string, unknown>)[component.id]
      if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
      const fields = candidate as Record<string, unknown>
      result[component.id] = { ...emptyValue }
      for (const field of ['text', 'size', 'color', 'logo'] as const) {
        if ((component.controls ?? ['text', 'size', 'color', 'logo']).includes(field) && typeof fields[field] === 'string') result[component.id][field] = fields[field]
      }
      if (!/^#[0-9a-f]{6}$/i.test(result[component.id].color)) result[component.id].color = emptyValue.color
      if (!Number.isFinite(Number(result[component.id].size)) || Number(result[component.id].size) < 8 || Number(result[component.id].size) > 160) result[component.id].size = emptyValue.size
    }
    return result
  } catch { return {} }
}

function download(name: string, value: string) {
  const url = URL.createObjectURL(new Blob([value], { type: name.endsWith('.json') ? 'application/json' : 'text/plain' }))
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
  } catch { return null }
}

export function EditorModule({ projectId }: { projectId: string }) {
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
    void loadEditorConfig(projectId).then((next) => {
      setConfig(next)
      setDraft(next ? readDraft(projectId, next) : {})
    }).catch(() => setLoadFailed(true)).finally(() => setLoading(false))
  }, [projectId])
  useEffect(() => {
    let active = true
    void loadEditorConfig(projectId).then((next) => {
      if (!active) return
      setConfig(next)
      setDraft(next ? readDraft(projectId, next) : {})
    }).catch(() => { if (active) setLoadFailed(true) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [projectId])

  const sendPreview = useCallback(() => {
    const target = previewUrl(config)
    if (!target || !config || !frameRef.current?.contentWindow) return
    frameRef.current.contentWindow.postMessage({ source: 'no-editor', type: 'NO_EDITOR_PREVIEW', version: 1, projectId, baseVersionId: config.versionId, changes: draft }, target.origin)
  }, [config, draft, projectId])
  useEffect(() => sendPreview(), [sendPreview])

  if (loading) return <section className="rounded-2xl border border-borda bg-white p-6" role="status">Carregando Editor…</section>
  if (loadFailed) return <section className="rounded-2xl border border-vermelho bg-vermelho-tint p-6"><h2 className="text-xl font-bold">Editor indisponível</h2><button type="button" className="mt-4 rounded-xl bg-tinta px-4 py-2 text-white" onClick={load}>Tentar de novo</button></section>
  if (!config) return <section className="rounded-2xl border border-borda bg-white p-6"><h2 className="text-xl font-bold">Editor</h2><p className="mt-2 text-cinza">Nenhuma configuração de edição foi liberada para a versão atual.</p></section>

  const target = previewUrl(config)
  const change = (id: string, field: keyof DraftValue, value: string) => {
    setConfirmDiscard(false)
    setDraft((old) => ({ ...old, [id]: { ...emptyValue, ...old[id], [field]: value } }))
  }
  const save = () => { localStorage.setItem(keyFor(projectId, config.versionId), JSON.stringify(draft)); setMessage('Ajustes salvos neste navegador.') }
  const discard = () => { localStorage.removeItem(keyFor(projectId, config.versionId)); setDraft({}); setConfirmDiscard(false); setMessage('Rascunho descartado.') }
  const send = async () => {
    const changes = Object.entries(draft).map(([component, value]) => {
      const allowed = config.allowedComponents.find((item) => item.id === component)
      const after = Object.fromEntries(Object.entries(value).filter(([field]) => (allowed?.controls ?? ['text', 'size', 'color', 'logo']).includes(field)))
      return { screen: allowed?.screen ?? 'geral', component, before: {}, after }
    })
    if (changes.length === 0) { setMessage('Faça ao menos um ajuste antes de enviar.'); return }
    setSending(true)
    setMessage('')
    try {
      localStorage.setItem(keyFor(projectId, config.versionId), JSON.stringify(draft))
      const coreFiles = {
        'editor.md': `# Ajustes ${config.label}\n\n${changes.map((item) => `## ${item.screen} / ${item.component}\n\n${JSON.stringify(item.after, null, 2)}`).join('\n\n')}`,
        'editor.cfg': JSON.stringify(draft, null, 2),
        'editor.css': Object.entries(draft).map(([id, value]) => `[data-editor="${id}"] { font-size: ${value.size}px; color: ${value.color}; }`).join('\n'),
      }
      const baseManifest = { schema_version: 1, project_id: projectId, base_version_id: config.versionId, base_version_label: config.label, build_reference: config.buildReference, changes, files: [...Object.keys(coreFiles), 'manifest.json'] }
      const result = await submitEditorExport(projectId, config.versionId, changes, baseManifest)
      const manifest = JSON.stringify({ ...baseManifest, content_sha256: result.contentSha256 }, null, 2)
      const files = { ...coreFiles, 'manifest.json': manifest }
      await uploadEditorExportFiles(projectId, result.contentSha256, files)
      await finalizeEditorExport(result.exportId)
      Object.entries(files).forEach(([name, value]) => download(name, value))
      localStorage.setItem(keyFor(projectId, config.versionId), JSON.stringify(draft))
      setMessage(result.conflict ? 'Pacote enviado com alerta de versão-base desatualizada; a Nó fará a conciliação.' : result.contentReplay ? 'Este mesmo pacote já estava recebido; os quatro arquivos foram recuperados sem duplicar o checklist.' : 'Pacote privado enviado para análise. A Nó implementa na próxima versão.')
    } catch { setMessage('Não foi possível concluir o envio. O rascunho foi preservado; tente novamente.') }
    finally { setSending(false) }
  }

  return <section className="rounded-2xl border border-borda bg-white p-6">
    <h2 className="text-xl font-bold">Editor · {config.label}</h2><p className="mt-2 text-cinza">Experimente ajustes autorizados e envie um pacote rastreável para a próxima versão.</p>
    {target ? <div className="mt-5 overflow-hidden rounded-xl border border-borda"><iframe ref={frameRef} title={`Preview controlado ${config.label}`} src={target.href} onLoad={sendPreview} className="h-[28rem] w-full" sandbox="allow-forms allow-scripts allow-same-origin" /></div> : null}
    <div className="mt-5 space-y-4">{config.allowedComponents.map((component) => {
      const controls = component.controls ?? ['text', 'size', 'color', 'logo']
      return <fieldset className="rounded-xl bg-osso p-4" key={component.id}><legend className="font-semibold">{component.label ?? component.id}</legend>{component.screen ? <p className="mb-2 font-mono text-xs text-cinza">Tela: {component.screen}</p> : null}
        {controls.includes('text') ? <input aria-label={`Texto ${component.id}`} className="mt-2 w-full rounded border p-2" value={draft[component.id]?.text ?? ''} onChange={(event) => change(component.id, 'text', event.target.value)} placeholder="Texto" /> : null}
        <div className="mt-2 flex flex-wrap gap-2">{controls.includes('size') ? <input aria-label={`Tamanho ${component.id}`} type="number" min="8" max="160" className="w-24 rounded border p-2" value={draft[component.id]?.size ?? '16'} onChange={(event) => change(component.id, 'size', event.target.value)} /> : null}{controls.includes('color') ? <input aria-label={`Cor ${component.id}`} type="color" value={draft[component.id]?.color ?? '#111111'} onChange={(event) => change(component.id, 'color', event.target.value)} /> : null}{controls.includes('logo') ? <input aria-label={`Logo ${component.id}`} className="min-w-52 flex-1 rounded border p-2" value={draft[component.id]?.logo ?? ''} onChange={(event) => change(component.id, 'logo', event.target.value)} placeholder="URL do logo" /> : null}</div>
      </fieldset>
    })}</div>
    <div className="mt-5 flex flex-wrap gap-3"><button type="button" className="rounded-xl border px-4 py-2" onClick={save}>Salvar ajustes</button>{!confirmDiscard ? <button type="button" className="rounded-xl border border-vermelho px-4 py-2 text-vermelho" onClick={() => setConfirmDiscard(true)}>Descartar rascunho</button> : <><button type="button" className="rounded-xl bg-vermelho px-4 py-2 text-white" onClick={discard}>Confirmar descarte</button><button type="button" className="rounded-xl border px-4 py-2" onClick={() => setConfirmDiscard(false)}>Cancelar</button></>}<button type="button" disabled={sending} className="rounded-xl bg-tinta px-4 py-2 text-white disabled:opacity-50" onClick={() => void send()}>{sending ? 'Enviando…' : 'Enviar para análise'}</button></div>
    {message ? <p role="status" className="mt-3 text-sm">{message}</p> : null}
  </section>
}

import { supabase } from '../lib/supabase'

export type AccessStatus = 'INICIAL_15_DIAS' | 'ATIVO_ATE_FIM_DO_PROJETO' | 'EXPIRADO'
export type ModuleKey =
  | 'como_funciona'
  | 'prototipo'
  | 'etapas'
  | 'editor'
  | 'versoes'
  | 'marca'
export type TierKey = 'essencial' | 'basico' | 'completo'
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

export type ProjectShell = {
  project_id: string
  project_name: string
  effective_access_status: AccessStatus
  access_released_at: string | null
  modules: Partial<Record<ModuleKey, 'ativo' | 'bloqueado'>>
}

export type Tier = {
  escopo: JsonValue
  profundidade: JsonValue
  exclusoes: JsonValue
  complexidade: JsonValue
  prazo_dias: number
  valor_centavos?: number | null
  faixa?: string | null
}

export type Roadmap = {
  stack: JsonValue
  costs: JsonValue
  next_steps: JsonValue
  references: JsonValue
  tiers: Partial<Record<TierKey, Tier>>
  preferred_tier: TierKey | null
  prototype_url: string | null
  published_at: string | null
}

export type KanbanStatus = 'a_fazer' | 'em_andamento' | 'concluido'
export type KanbanItem = {
  id: string
  title: string
  phase: string | null
  macro_version: string | null
  status: KanbanStatus
  scheduled_date: string | null
  position: number
}

export type ProjectVersion = {
  id: string
  label: string
  macro: 'V1' | 'V2' | 'V3'
  status: string
  published_at: string
  changelog: string
  build_reference: string
  is_current: boolean
  created_at: string
  editor_checklists: EditorVersionChecklist[]
}

export type EditorChecklistGroup = {
  screen: string
  component: string
  changes: Array<{ before: Record<string, JsonValue>; after: Record<string, JsonValue> }>
}

export type EditorVersionChecklist = {
  id: string
  versionId: string
  status: string
  items: EditorChecklistGroup[]
  baseVersionLabel: string
}

export type DashboardData = {
  shell: ProjectShell | null
  roadmap: Roadmap | null
  kanban: KanbanItem[]
  versions?: ProjectVersion[]
}

export async function loadClientDashboard(projectId: string): Promise<DashboardData> {
  const [shellResult, roadmapResult, kanbanResult, versionsResult, checklistsResult] = await Promise.all([
    supabase.rpc('get_client_project_shell', { p_project_id: projectId }).maybeSingle(),
    supabase
      .from('roadmaps')
      .select('stack, costs, next_steps, references, tiers, preferred_tier, prototype_url, published_at')
      .eq('project_id', projectId)
      .maybeSingle(),
    supabase
      .from('kanban_items')
      .select('id, title, phase, macro_version, status, scheduled_date, position')
      .eq('project_id', projectId)
      .order('position', { ascending: true })
      .order('scheduled_date', { ascending: true, nullsFirst: false }),
    supabase
      .from('project_versions')
      .select('id, label, macro, status, published_at, changelog, build_reference, is_current, created_at')
      .eq('project_id', projectId)
      .order('published_at', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.rpc('list_client_version_checklists', { p_project_id: projectId }),
  ])

  const error = shellResult.error ?? roadmapResult.error ?? kanbanResult.error ?? versionsResult.error ?? checklistsResult.error
  if (error) {
    throw error
  }

  const checklists = (checklistsResult.data ?? []) as EditorVersionChecklist[]
  return {
    shell: shellResult.data as ProjectShell | null,
    roadmap: roadmapResult.data as Roadmap | null,
    kanban: (kanbanResult.data ?? []) as KanbanItem[],
    versions: ((versionsResult.data ?? []) as Omit<ProjectVersion, 'editor_checklists'>[]).map((version) => ({
      ...version,
      editor_checklists: checklists.filter((checklist) => checklist.versionId === version.id),
    })),
  }
}

export async function savePreferredTier(projectId: string, tier: TierKey) {
  const { data, error } = await supabase
    .rpc('set_preferred_tier', { p_project_id: projectId, p_tier: tier })
    .single()

  if (error) {
    throw error
  }

  return data as { preferred_tier: TierKey; changed: boolean }
}

export function calculateProgress(items: KanbanItem[]) {
  if (items.length === 0) {
    return 0
  }

  const completed = items.filter((item) => item.status === 'concluido').length
  return Math.round((completed / items.length) * 100)
}

export type EditorConfig = { versionId: string; label: string; buildReference: string; allowedComponents: Array<{ id: string; label?: string; screen?: string; controls?: string[] }>; bridgeEnabled: boolean }
export type EditorExportResult = { exportId: string; replayed: boolean; contentReplay: boolean; conflict: boolean; contentSha256: string }
export async function loadEditorConfig(projectId: string): Promise<EditorConfig | null> {
  const { data, error } = await supabase.rpc('get_client_editor_config', { p_project_id: projectId }).maybeSingle()
  if (error) throw error
  return data as EditorConfig | null
}
export async function submitEditorExport(projectId: string, baseVersionId: string, changes: unknown[], manifest: Record<string, unknown>, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.rpc('submit_client_editor_export', { p_project_id: projectId, p_base_version_id: baseVersionId, p_changes: changes, p_manifest: manifest, p_request_id: requestId }).single()
  if (error) throw error
  return data as EditorExportResult
}
export async function uploadEditorExportFiles(projectId: string, contentSha256: string, files: Record<string, string>) {
  for (const [name, value] of Object.entries(files)) {
    const contentType = name.endsWith('.json') ? 'application/json' : 'text/plain'
    const { error } = await supabase.storage
      .from('editor-exports')
      .upload(`${projectId}/${contentSha256}/${name}`, new Blob([value], { type: contentType }), { upsert: false, contentType })
    if (error && !error.message.toLocaleLowerCase().includes('already exists')) throw error
  }
}

export async function finalizeEditorExport(exportId: string) {
  const { error } = await supabase.rpc('finalize_client_editor_export', { p_export_id: exportId })
  if (error) throw error
}

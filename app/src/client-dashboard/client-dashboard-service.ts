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

export type DashboardData = {
  shell: ProjectShell | null
  roadmap: Roadmap | null
  kanban: KanbanItem[]
}

export async function loadClientDashboard(projectId: string): Promise<DashboardData> {
  const [shellResult, roadmapResult, kanbanResult] = await Promise.all([
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
  ])

  const error = shellResult.error ?? roadmapResult.error ?? kanbanResult.error
  if (error) {
    throw error
  }

  return {
    shell: shellResult.data as ProjectShell | null,
    roadmap: roadmapResult.data as Roadmap | null,
    kanban: (kanbanResult.data ?? []) as KanbanItem[],
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

import { supabase } from '../lib/supabase'

export type LeadStatus =
  | 'FORMULARIO_PREENCHIDO'
  | 'PAGAMENTO_PENDENTE'
  | 'ROADMAP_PAGO'
  | 'REFERENCIAS_PENDENTES'
  | 'EM_PRODUCAO'
  | 'DASHBOARD_LIBERADO'
  | 'JANELA_DE_DECISAO'
  | 'CONVERTIDO'
  | 'NAO_CONVERTIDO'

export type ProjectStatus =
  | 'CONVERTIDO'
  | 'AGENDADO'
  | 'V1_EM_DESENVOLVIMENTO'
  | 'V1_PUBLICADA'
  | 'EM_REVISAO_CLIENTE'
  | 'ALTERACOES_RECEBIDAS'
  | 'V2_EM_DESENVOLVIMENTO'
  | 'V2_PUBLICADA'
  | 'V3_GO_LIVE'
  | 'CONCLUIDO'
  | 'ARQUIVADO'

export type TierKey = 'essencial' | 'basico' | 'completo'
export type PaymentStatus = string | null
export type KanbanStatus = 'a_fazer' | 'em_andamento' | 'concluido'

export type ProjectCard = {
  id: string
  name: string
  clientName: string
  companyName: string | null
  niche: string | null
  leadStatus: LeadStatus
  projectStatus: ProjectStatus | null
  accessStatus: string | null
  effectiveAccessStatus: string | null
  tier: TierKey | null
  createdAt: string
  nextScheduledDate: string | null
  paymentStatus: PaymentStatus
  modules: Record<string, string>
}

export type CommercialTerms = {
  project_id: string
  tier: TierKey
  amount_cents: number
  payment_method: string
  installments: number
  deadline_days: number
  starts_on: string | null
  financial_status: string | null
  notes: string | null
  updated_at: string
}

export type KanbanItem = {
  id: string
  project_id: string
  title: string
  phase: string | null
  macro_version: 'V1' | 'V2' | 'V3' | null
  status: KanbanStatus
  scheduled_date: string | null
  completed_at: string | null
  position: number
}

export type ProjectDetail = ProjectCard & {
  contact: string | null
  origin: string | null
  enteredAt: string
  diagnosis: {
    answers: unknown
    references: unknown
    materials: unknown
    observations: unknown
  }
  commercialTerms: CommercialTerms | null
  execution: {
    startedAt: string | null
    deadline: string | null
    phase: string | null
    version: string | null
    nextDelivery: string | null
    clientDashboardUrl: string | null
    technicalLinks: unknown
    internalNotes: string | null
  }
  deliverables: { roadmap: unknown; prototypeUrl: string | null }
  kanban: KanbanItem[]
}

export type ActivityEvent = {
  id: number
  projectId: string | null
  projectName: string | null
  actorId: string | null
  actorLabel: string | null
  type: string
  occurredAt: string
  payload: Record<string, unknown>
}

export type ActivityKanbanItem = KanbanItem & { project_name: string }

export type ProjectFilters = {
  niche?: string
  state?: string
  tier?: TierKey
  deadline?: 'atrasado' | 'hoje' | 'proximos_7_dias' | 'sem_data'
  paymentStatus?: string
  conversion?: 'convertido' | 'nao_convertido'
  lifecycle?: 'ativo' | 'concluido' | 'arquivado'
  search?: string
}

const saoPauloFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function saoPauloDate(value: Date | string = new Date()): string {
  return saoPauloFormatter.format(new Date(value))
}

export function sortProjectCards(cards: ProjectCard[]): ProjectCard[] {
  return [...cards].sort((a, b) => {
    if (a.nextScheduledDate === null && b.nextScheduledDate !== null) return 1
    if (a.nextScheduledDate !== null && b.nextScheduledDate === null) return -1
    if (a.nextScheduledDate !== b.nextScheduledDate) {
      return (a.nextScheduledDate ?? '').localeCompare(b.nextScheduledDate ?? '')
    }
    return b.createdAt.localeCompare(a.createdAt) || a.name.localeCompare(b.name, 'pt-BR')
  })
}

export function filterProjects(cards: ProjectCard[], filters: ProjectFilters, today = saoPauloDate()): ProjectCard[] {
  const query = filters.search?.trim().toLocaleLowerCase('pt-BR') ?? ''
  const todayMs = Date.parse(`${today}T00:00:00Z`)
  const weekMs = todayMs + 7 * 24 * 60 * 60 * 1000
  return sortProjectCards(cards.filter((card) => {
    const haystack = [card.clientName, card.companyName, card.name].filter(Boolean).join(' ').toLocaleLowerCase('pt-BR')
    if (query && !haystack.includes(query)) return false
    if (filters.niche && card.niche !== filters.niche) return false
    if (filters.state && (card.projectStatus ?? card.leadStatus) !== filters.state) return false
    if (filters.tier && card.tier !== filters.tier) return false
    if (filters.paymentStatus && (card.paymentStatus ?? 'sem_registro') !== filters.paymentStatus) return false
    if (filters.conversion === 'convertido' && card.leadStatus !== 'CONVERTIDO') return false
    if (filters.conversion === 'nao_convertido' && card.leadStatus === 'CONVERTIDO') return false
    if (filters.lifecycle === 'concluido' && card.projectStatus !== 'CONCLUIDO') return false
    if (filters.lifecycle === 'arquivado' && card.projectStatus !== 'ARQUIVADO') return false
    if (filters.lifecycle === 'ativo' && (card.projectStatus === 'CONCLUIDO' || card.projectStatus === 'ARQUIVADO')) return false
    if (filters.deadline) {
      if (filters.deadline === 'sem_data' && card.nextScheduledDate !== null) return false
      if (filters.deadline !== 'sem_data' && card.nextScheduledDate === null) return false
      if (card.nextScheduledDate !== null) {
        const dateMs = Date.parse(`${card.nextScheduledDate}T00:00:00Z`)
        if (filters.deadline === 'atrasado' && dateMs >= todayMs) return false
        if (filters.deadline === 'hoje' && dateMs !== todayMs) return false
        if (filters.deadline === 'proximos_7_dias' && (dateMs < todayMs || dateMs > weekMs)) return false
      }
    }
    return true
  }))
}

export function sortKanbanItems(items: KanbanItem[]): KanbanItem[] {
  return [...items].sort((a, b) => a.position - b.position || (a.scheduled_date ?? '9999-12-31').localeCompare(b.scheduled_date ?? '9999-12-31'))
}

export type ActivityView = 'hoje' | 'ontem' | 'pendencias' | 'atrasados' | 'ultimos_7_dias' | 'por_projeto' | 'por_evento'

export function activityViews(today = saoPauloDate()) {
  const day = new Date(`${today}T00:00:00Z`)
  const yesterday = new Date(day.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const sevenDaysAgo = new Date(day.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { today, yesterday, sevenDaysAgo }
}

export function filterActivityEvents(events: ActivityEvent[], view: ActivityView, today = saoPauloDate(), kanban: ActivityKanbanItem[] = []): ActivityEvent[] {
  const dates = activityViews(today)
  if (view === 'pendencias' || view === 'atrasados') {
    const target = kanban.filter((item) => item.status !== 'concluido' && (view === 'pendencias'
      ? (item.scheduled_date === dates.today || item.scheduled_date === null)
      : (item.scheduled_date !== null && item.scheduled_date < dates.today)))
    return target.map((item, index) => ({ id: -(index + 1), projectId: item.project_id, projectName: item.project_name, actorId: null, actorLabel: 'pendência', type: `kanban.${view}`, occurredAt: `${item.scheduled_date ?? dates.today}T12:00:00Z`, payload: { item_id: item.id, title: item.title } }))
  }
  const visible = [...events]
    .filter((event) => {
      const date = saoPauloDate(event.occurredAt)
      if (view === 'hoje') return date === dates.today
      if (view === 'ontem') return date === dates.yesterday
      if (view === 'ultimos_7_dias') return date >= dates.sevenDaysAgo && date <= dates.today
      return true
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  if (view === 'por_projeto') {
    return visible.sort((a, b) => (a.projectName ?? '').localeCompare(b.projectName ?? '', 'pt-BR') || b.occurredAt.localeCompare(a.occurredAt))
  }
  if (view === 'por_evento') {
    return visible.sort((a, b) => a.type.localeCompare(b.type, 'pt-BR') || b.occurredAt.localeCompare(a.occurredAt))
  }
  return visible
}

export async function listAdminProjects(): Promise<ProjectCard[]> {
  const { data, error } = await supabase.rpc('list_admin_projects')
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => {
    const value = row as Record<string, unknown>
    return {
      id: String(value.id), name: String(value.name), clientName: String(value.client_name ?? ''),
      companyName: value.company_name as string | null, niche: value.niche as string | null,
      leadStatus: value.lead_status as LeadStatus, projectStatus: value.project_status as ProjectStatus | null,
      accessStatus: value.access_status as string | null, effectiveAccessStatus: value.effective_access_status as string | null,
      tier: value.tier as TierKey | null, createdAt: String(value.created_at),
      nextScheduledDate: value.next_scheduled_date as string | null, paymentStatus: value.payment_status as string | null,
      modules: (value.modules ?? {}) as Record<string, string>,
    }
  })
}

export async function loadAdminProject(projectId: string): Promise<ProjectDetail | null> {
  const { data, error } = await supabase.rpc('get_admin_project', { p_project_id: projectId }).maybeSingle()
  if (error) throw error
  return data as ProjectDetail | null
}

export async function listAdminActivity(): Promise<ActivityEvent[]> {
  const { data, error } = await supabase.rpc('list_admin_activity')
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => {
    const value = row as Record<string, unknown>
    return {
      id: Number(value.id), projectId: value.project_id as string | null,
      projectName: value.project_name as string | null, actorId: value.actor_id as string | null,
      actorLabel: value.actor_label as string | null, type: String(value.type),
      occurredAt: String(value.occurred_at), payload: (value.payload ?? {}) as Record<string, unknown>,
    }
  })
}

export async function listAdminKanbanItems(): Promise<ActivityKanbanItem[]> {
  const { data, error } = await supabase.rpc('list_admin_kanban_items')
  if (error) throw error
  return (data ?? []) as ActivityKanbanItem[]
}

export async function saveCommercialTerms(projectId: string, values: Omit<CommercialTerms, 'project_id' | 'updated_at'>, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.rpc('update_commercial_terms', {
    p_project_id: projectId,
    p_tier: values.tier,
    p_amount_cents: values.amount_cents,
    p_payment_method: values.payment_method,
    p_installments: values.installments,
    p_deadline_days: values.deadline_days,
    p_starts_on: values.starts_on || null,
    p_financial_status: values.financial_status,
    p_notes: values.notes,
    p_request_id: requestId,
  }).single()
  if (error) throw error
  return data as CommercialTerms
}

export async function transitionLead(projectId: string, target: LeadStatus, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.rpc('transition_project_lead', { p_project_id: projectId, p_target: target, p_request_id: requestId }).single()
  if (error) throw error
  return data
}

export async function saveKanbanItem(projectId: string, item: Partial<KanbanItem> & { id?: string }, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.rpc('upsert_admin_kanban_item', {
    p_project_id: projectId, p_item_id: item.id ?? null, p_title: item.title ?? null,
    p_phase: item.phase ?? null, p_macro_version: item.macro_version ?? null,
    p_status: item.status ?? null, p_scheduled_date: item.scheduled_date ?? null,
    p_position: item.position ?? null, p_request_id: requestId,
  }).single()
  if (error) throw error
  return data as KanbanItem
}

export async function convertProject(values: { projectId: string; tier: TierKey; amountCents: number; paymentMethod: string; installments: number; deadlineDays: number }, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.functions.invoke('project-convert', { body: { ...values, requestId } })
  if (error) throw error
  return data as { projectId: string; leadStatus: LeadStatus; projectStatus: ProjectStatus; accessStatus: string }
}

export async function activateBrandModule(projectId: string, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.rpc('activate_brand_module', { p_project_id: projectId, p_request_id: requestId })
  if (error) throw error
  return data
}

export async function transitionProjectStatus(projectId: string, target: ProjectStatus, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.functions.invoke('project-status-transition', {
    body: { projectId, target, requestId },
  })
  if (error) throw error
  return data
}

export async function publishProjectVersion(values: { projectId: string; label: string; macro: 'V1' | 'V2' | 'V3'; changelog: string; buildReference: string }, requestId = crypto.randomUUID()) {
  const { data, error } = await supabase.functions.invoke('project-publish-version', {
    body: { ...values, requestId },
  })
  if (error) throw error
  return data as { versionId: string; projectStatus: ProjectStatus; replayed: boolean }
}

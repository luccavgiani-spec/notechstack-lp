import { supabase } from '../lib/supabase'

export type Agency = { id: string; name: string; slug: string; active: boolean }
export type AgencyProject = {
  id: string; name: string; clientId: string; clientName: string; status: string
  updatedAt: string; totalTasks: number; doneTasks: number; overdueTasks: number; nextDate: string | null
}
export type AgencyOverview = { agency: Agency; projects: AgencyProject[] }
export type AgencyDetail = {
  tasks: { id: string; title: string; phase: string | null; status: string; date: string | null }[]
  versions: { id: string; label: string; changelog: string; publishedAt: string; current: boolean }[]
}

export async function listAgencies(): Promise<Agency[]> {
  const { data, error } = await supabase.from('agencies').select('id,name,slug,active').order('name')
  if (error) throw error
  return data ?? []
}
export async function loadAgency(id: string): Promise<AgencyOverview> {
  const { data, error } = await supabase.rpc('get_agency_overview', { p_agency_id: id })
  if (error) throw error
  return data
}
export async function loadAgencyProject(agencyId: string, projectId: string): Promise<AgencyDetail> {
  const { data, error } = await supabase.rpc('get_agency_project', { p_agency_id: agencyId, p_project_id: projectId })
  if (error) throw error
  return data
}
export async function createAgency(name: string, slug: string) {
  const { error } = await supabase.from('agencies').insert({ name: name.trim(), slug: slug.trim() })
  if (error) throw error
}
export async function setAgencyProject(agencyId: string, projectId: string, linked: boolean) {
  const query = linked
    ? supabase.from('agency_projects').insert({ agency_id: agencyId, project_id: projectId })
    : supabase.from('agency_projects').delete().eq('agency_id', agencyId).eq('project_id', projectId)
  const { error } = await query
  if (error) throw error
}
export const statusLabel = (value: string) => ({
  FORMULARIO_PREENCHIDO: 'Formulário preenchido', PAGAMENTO_PENDENTE: 'Pagamento pendente',
  ROADMAP_PAGO: 'Roadmap pago', REFERENCIAS_PENDENTES: 'Referências pendentes', EM_PRODUCAO: 'Em produção',
  DASHBOARD_LIBERADO: 'Portal liberado', JANELA_DE_DECISAO: 'Em decisão', NAO_CONVERTIDO: 'Não contratado',
  CONVERTIDO: 'Contratado', AGENDADO: 'Agendado', V1_EM_DESENVOLVIMENTO: 'V1 em desenvolvimento',
  V1_PUBLICADA: 'V1 publicada', EM_REVISAO_CLIENTE: 'Em revisão', ALTERACOES_RECEBIDAS: 'Alterações recebidas',
  V2_EM_DESENVOLVIMENTO: 'V2 em desenvolvimento', V2_PUBLICADA: 'V2 publicada', V3_GO_LIVE: 'Publicação final',
  CONCLUIDO: 'Concluído', ARQUIVADO: 'Arquivado', a_fazer: 'A fazer', em_andamento: 'Em andamento', concluido: 'Concluído',
} as Record<string, string>)[value] ?? value.toLowerCase().replaceAll('_', ' ')

export function portfolioStats(projects: AgencyProject[]) {
  return {
    clients: new Set(projects.map(p => p.clientId)).size,
    active: projects.filter(p => !['CONCLUIDO', 'ARQUIVADO'].includes(p.status)).length,
    review: projects.filter(p => p.status === 'EM_REVISAO_CLIENTE').length,
    overdue: projects.filter(p => !['CONCLUIDO', 'ARQUIVADO'].includes(p.status)).reduce((sum, p) => sum + p.overdueTasks, 0),
  }
}

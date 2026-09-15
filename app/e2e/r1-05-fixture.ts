import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type R105Fixture = {
  admin: SupabaseClient
  email: string
  password: string
  userId: string
  clientId: string
  activeProjectId: string
  expiredProjectId: string
  emptyProjectId: string
}

function localSupabaseEnvironment() {
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: path.resolve(process.cwd(), '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const values = new Map<string, string>()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="(.*)"$/)
    if (match) values.set(match[1], match[2])
  }
  const apiUrl = values.get('API_URL')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY')
  if (!apiUrl || !serviceRoleKey) throw new Error('Local Supabase is not available for R1-05 E2E')
  return { apiUrl, serviceRoleKey }
}

export async function createR105Fixture(): Promise<R105Fixture> {
  const { apiUrl, serviceRoleKey } = localSupabaseEnvironment()
  const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } })
  const nonce = randomUUID()
  const email = `r105-${nonce}@example.test`
  const password = `R105-${randomUUID()}!aA1`
  const clientId = randomUUID()
  const activeProjectId = randomUUID()
  const expiredProjectId = randomUUID()
  const emptyProjectId = randomUUID()

  const { data: created, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'CLIENT' },
  })
  if (userError || !created.user) throw userError ?? new Error('E2E user was not created')

  const userId = created.user.id
  const { error: clientError } = await admin.from('clients').insert({
    id: clientId,
    name: 'Cliente E2E R1-05',
    slug: `r105-${nonce}`,
    email,
  })
  if (clientError) throw clientError

  const modules = {
    como_funciona: 'ativo', prototipo: 'ativo', etapas: 'ativo',
    editor: 'bloqueado', versoes: 'bloqueado', marca: 'bloqueado',
  }
  const { error: projectError } = await admin.from('projects').insert([
    {
      id: activeProjectId, client_id: clientId, name: 'Projeto E2E ativo',
      lead_status: 'JANELA_DE_DECISAO', access_status: 'INICIAL_15_DIAS',
      access_released_at: new Date().toISOString(), modules,
    },
    {
      id: expiredProjectId, client_id: clientId, name: 'Projeto E2E expirado',
      lead_status: 'JANELA_DE_DECISAO', access_status: 'INICIAL_15_DIAS',
      access_released_at: new Date(Date.now() - 16 * 86_400_000).toISOString(), modules,
    },
    {
      id: emptyProjectId, client_id: clientId, name: 'Projeto E2E vazio',
      lead_status: 'JANELA_DE_DECISAO', access_status: 'ATIVO_ATE_FIM_DO_PROJETO',
      access_released_at: new Date().toISOString(), modules,
    },
  ])
  if (projectError) throw projectError

  const { error: membershipError } = await admin.from('memberships').insert({
    client_id: clientId,
    user_id: userId,
    role: 'CLIENT',
  })
  if (membershipError) throw membershipError

  const tiers = {
    essencial: {
      escopo: ['Núcleo'], profundidade: 'enxuta', exclusoes: ['Automações'],
      complexidade: 'baixa', prazo_dias: 15, valor_centavos: null, faixa: null,
    },
    basico: {
      escopo: ['Operação'], profundidade: 'intermediária', exclusoes: ['IA'],
      complexidade: 'média', prazo_dias: 30, valor_centavos: 450000, faixa: null,
    },
    completo: {
      escopo: ['Produto'], profundidade: 'completa', exclusoes: [],
      complexidade: 'alta', prazo_dias: 45, valor_centavos: null, faixa: 'Sob proposta',
    },
  }
  const { error: roadmapError } = await admin.from('roadmaps').insert([
    {
      project_id: activeProjectId,
      stack: ['React', 'Supabase'], costs: ['Hospedagem'],
      next_steps: ['Validar protótipo'], references: ['Referência editorial'],
      tiers, prototype_url: 'https://prototype.local/start',
      published_at: new Date().toISOString(),
    },
    {
      project_id: expiredProjectId,
      references: [], stack: [], costs: [], next_steps: [], tiers: {},
    },
    {
      project_id: emptyProjectId,
      references: [], stack: [], costs: [], next_steps: [], tiers: {},
    },
  ])
  if (roadmapError) throw roadmapError

  const kanbanItems = Array.from({ length: 27 }, (_, index) => ({
    project_id: activeProjectId,
    title: `Etapa ${index + 1}`,
    phase: `Fase ${index + 1}`,
    macro_version: index % 2 === 0 ? 'V1' : 'V2',
    status: index < 17 ? 'concluido' : index < 22 ? 'em_andamento' : 'a_fazer',
    scheduled_date: '2026-09-20',
    position: index,
  }))
  const { error: kanbanError } = await admin.from('kanban_items').insert(kanbanItems)
  if (kanbanError) throw kanbanError

  return { admin, email, password, userId, clientId, activeProjectId, expiredProjectId, emptyProjectId }
}

export async function cleanupR105Fixture(fixture: R105Fixture | undefined) {
  if (!fixture) return
  const projectIds = [fixture.activeProjectId, fixture.expiredProjectId, fixture.emptyProjectId]
  await fixture.admin.from('activity_events').delete().in('project_id', projectIds)
  await fixture.admin.from('kanban_items').delete().in('project_id', projectIds)
  await fixture.admin.from('roadmaps').delete().in('project_id', projectIds)
  await fixture.admin.from('projects').delete().in('id', projectIds)
  await fixture.admin.from('memberships').delete().eq('client_id', fixture.clientId)
  await fixture.admin.from('clients').delete().eq('id', fixture.clientId)
  await fixture.admin.auth.admin.deleteUser(fixture.userId)
}

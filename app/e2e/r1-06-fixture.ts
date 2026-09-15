import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type R106Fixture = {
  admin: SupabaseClient
  adminEmail: string
  clientEmail: string
  password: string
  adminId: string
  clientId: string
  tenantId: string
  projectId: string
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
  if (!apiUrl || !serviceRoleKey) throw new Error('Local Supabase is not available for R1-06 E2E')
  return { apiUrl, serviceRoleKey }
}

export async function createR106Fixture(): Promise<R106Fixture> {
  const { apiUrl, serviceRoleKey } = localSupabaseEnvironment()
  const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } })
  const nonce = randomUUID()
  const password = `R106-${randomUUID()}!aA1`
  const adminEmail = `r106-admin-${nonce}@example.test`
  const clientEmail = `r106-client-${nonce}@example.test`
  const tenantId = randomUUID()
  const clientId = randomUUID()
  const projectId = randomUUID()

  const [adminResult, clientResult] = await Promise.all([
    admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, app_metadata: { role: 'NO_ADMIN' } }),
    admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true, app_metadata: { role: 'CLIENT' } }),
  ])
  if (adminResult.error || !adminResult.data.user) throw adminResult.error ?? new Error('R1-06 admin user was not created')
  if (clientResult.error || !clientResult.data.user) throw clientResult.error ?? new Error('R1-06 client user was not created')

  const adminId = adminResult.data.user.id
  const clientUserId = clientResult.data.user.id
  const { error: clientError } = await admin.from('clients').insert({ id: clientId, name: 'Cliente E2E R1-06', slug: `r106-${nonce}`, email: clientEmail })
  if (clientError) throw clientError
  const { error: membershipError } = await admin.from('memberships').insert({ client_id: clientId, user_id: clientUserId, role: 'CLIENT' })
  if (membershipError) throw membershipError
  const { error: projectError } = await admin.from('projects').insert({
    id: projectId,
    client_id: clientId,
    name: 'Projeto E2E R1-06',
    niche: 'servicos',
    lead_status: 'JANELA_DE_DECISAO',
    access_status: 'ATIVO_ATE_FIM_DO_PROJETO',
    access_released_at: new Date().toISOString(),
    modules: { como_funciona: 'ativo', prototipo: 'ativo', etapas: 'ativo', editor: 'bloqueado', versoes: 'bloqueado', marca: 'bloqueado' },
  })
  if (projectError) throw projectError
  const { error: roadmapError } = await admin.from('roadmaps').insert({ project_id: projectId, answers: { objetivo: 'Operar melhor' }, references: [], stack: [], costs: [], next_steps: [], tiers: {} })
  if (roadmapError) throw roadmapError
  const { error: kanbanError } = await admin.from('kanban_items').insert({ project_id: projectId, title: 'Primeira entrega', phase: 'descoberta', macro_version: 'V1', status: 'a_fazer', position: 1 })
  if (kanbanError) throw kanbanError
  await admin.from('activity_events').delete().eq('project_id', projectId)

  return { admin, adminEmail, clientEmail, password, adminId, clientId, tenantId, projectId }
}

export async function cleanupR106Fixture(fixture: R106Fixture | undefined) {
  if (!fixture) return
  await fixture.admin.from('activity_events').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('commercial_terms').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('kanban_items').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('roadmaps').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('projects').delete().eq('id', fixture.projectId)
  await fixture.admin.from('memberships').delete().eq('client_id', fixture.clientId)
  await fixture.admin.from('clients').delete().eq('id', fixture.clientId)
  await fixture.admin.auth.admin.deleteUser(fixture.adminId)
  const { data } = await fixture.admin.auth.admin.listUsers({ perPage: 1000 })
  const client = data.users.find((user) => user.email === fixture.clientEmail)
  if (client) await fixture.admin.auth.admin.deleteUser(client.id)
}

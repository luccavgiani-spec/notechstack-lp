import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type F209Fixture = {
  admin: SupabaseClient
  adminEmail: string
  clientEmail: string
  password: string
  adminId: string
  clientUserId: string
  clientId: string
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
  if (!apiUrl || !serviceRoleKey) throw new Error('Local Supabase is not available for F2-09 E2E')
  return { apiUrl, serviceRoleKey }
}

export async function createF209Fixture(): Promise<F209Fixture> {
  const { apiUrl, serviceRoleKey } = localSupabaseEnvironment()
  const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } })
  const nonce = randomUUID()
  const password = `F209-${randomUUID()}!aA1`
  const adminEmail = `f209-admin-${nonce}@example.test`
  const clientEmail = `f209-client-${nonce}@example.test`
  const clientId = randomUUID()
  const projectId = randomUUID()

  const [adminResult, clientResult] = await Promise.all([
    admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, app_metadata: { role: 'NO_ADMIN' } }),
    admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true, app_metadata: { role: 'CLIENT' } }),
  ])
  if (adminResult.error || !adminResult.data.user) throw adminResult.error ?? new Error('F2-09 admin user was not created')
  if (clientResult.error || !clientResult.data.user) throw clientResult.error ?? new Error('F2-09 client user was not created')

  const adminId = adminResult.data.user.id
  const clientUserId = clientResult.data.user.id
  const { error: clientError } = await admin.from('clients').insert({
    id: clientId,
    name: 'Cliente E2E F2-09',
    slug: `f209-${nonce}`,
    email: clientEmail,
  })
  if (clientError) throw clientError
  const { error: membershipError } = await admin.from('memberships').insert({ client_id: clientId, user_id: clientUserId, role: 'CLIENT' })
  if (membershipError) throw membershipError
  const { error: projectError } = await admin.from('projects').insert({
    id: projectId,
    client_id: clientId,
    name: 'Ciclo E2E F2-09',
    niche: 'software',
    lead_status: 'CONVERTIDO',
    project_status: 'AGENDADO',
    access_status: 'ATIVO_ATE_FIM_DO_PROJETO',
    access_released_at: new Date().toISOString(),
    modules: { como_funciona: 'ativo', prototipo: 'ativo', etapas: 'ativo', editor: 'bloqueado', versoes: 'bloqueado', marca: 'ativo' },
    tier: 'basico',
  })
  if (projectError) throw projectError
  const { error: roadmapError } = await admin.from('roadmaps').insert({
    project_id: projectId,
    answers: {}, references: [], stack: [], costs: [], next_steps: [], tiers: {},
    published_at: new Date().toISOString(),
  })
  if (roadmapError) throw roadmapError
  await admin.from('activity_events').delete().eq('project_id', projectId)

  return { admin, adminEmail, clientEmail, password, adminId, clientUserId, clientId, projectId }
}

export async function cleanupF209Fixture(fixture: F209Fixture | undefined) {
  if (!fixture) return
  await fixture.admin.from('activity_events').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('editor_exports').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('project_versions').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('roadmaps').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('projects').delete().eq('id', fixture.projectId)
  await fixture.admin.from('memberships').delete().eq('client_id', fixture.clientId)
  await fixture.admin.from('clients').delete().eq('id', fixture.clientId)
  await Promise.all([
    fixture.admin.auth.admin.deleteUser(fixture.adminId),
    fixture.admin.auth.admin.deleteUser(fixture.clientUserId),
  ])
}

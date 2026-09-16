import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type R107Fixture = {
  admin: SupabaseClient
  adminEmail: string
  gazetaEmail: string
  helloEmail: string
  password: string
  userIds: string[]
  gazetaClientId: string
  helloClientId: string
  gazetaProjectId: string
  helloProjectId: string
}

function localSupabaseEnvironment() {
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: path.resolve(process.cwd(), '..'), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
  })
  const values = new Map<string, string>()
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^([A-Z_]+)="(.*)"$/)
    if (match) values.set(match[1], match[2])
  }
  const apiUrl = values.get('API_URL')
  const serviceRoleKey = values.get('SERVICE_ROLE_KEY')
  if (!apiUrl || !serviceRoleKey) throw new Error('Local Supabase is not available for R1-07 E2E')
  return { apiUrl, serviceRoleKey }
}

function runSeed() {
  execFileSync(process.execPath, ['scripts/seed-exemplos.mjs'], {
    cwd: process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export async function createR107Fixture(): Promise<R107Fixture> {
  runSeed()
  const { apiUrl, serviceRoleKey } = localSupabaseEnvironment()
  const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } })
  const nonce = randomUUID()
  const password = `R107-${randomUUID()}!aA1`
  const adminEmail = `r107-admin-${nonce}@example.test`
  const gazetaEmail = `r107-gazeta-${nonce}@example.test`
  const helloEmail = `r107-hello-${nonce}@example.test`
  const created = await Promise.all([
    admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, app_metadata: { role: 'NO_ADMIN' } }),
    admin.auth.admin.createUser({ email: gazetaEmail, password, email_confirm: true, app_metadata: { role: 'CLIENT' } }),
    admin.auth.admin.createUser({ email: helloEmail, password, email_confirm: true, app_metadata: { role: 'CLIENT' } }),
  ])
  for (const result of created) if (result.error || !result.data.user) throw result.error ?? new Error('R1-07 auth fixture was not created')
  const userIds = created.map((result) => result.data.user!.id)

  const { data: clients, error: clientsError } = await admin.from('clients').select('id,slug').in('slug', ['gazeta-bragantina', 'hello-best'])
  if (clientsError || clients?.length !== 2) throw clientsError ?? new Error('R1-07 seed clients are unavailable')
  const gazetaClientId = clients.find(({ slug }) => slug === 'gazeta-bragantina')!.id
  const helloClientId = clients.find(({ slug }) => slug === 'hello-best')!.id
  const { data: projects, error: projectsError } = await admin.from('projects').select('id,client_id').in('client_id', [gazetaClientId, helloClientId])
  if (projectsError || projects?.length !== 2) throw projectsError ?? new Error('R1-07 seed projects are unavailable')
  const gazetaProjectId = projects.find(({ client_id }) => client_id === gazetaClientId)!.id
  const helloProjectId = projects.find(({ client_id }) => client_id === helloClientId)!.id

  const { error: membershipError } = await admin.from('memberships').insert([
    { client_id: gazetaClientId, user_id: userIds[1], role: 'CLIENT' },
    { client_id: helloClientId, user_id: userIds[2], role: 'CLIENT' },
  ])
  if (membershipError) throw membershipError

  const tier = (label: string, days: number) => ({
    escopo: [label], profundidade: label, exclusoes: [], complexidade: 'local',
    prazo_dias: days, valor_centavos: null, faixa: 'a preencher',
  })
  const content = {
    answers: { origem: 'R1-07 local' }, references: ['Hello Best'], stack: ['Lovable', 'Supabase'],
    costs: ['a preencher'], next_steps: ['Validar protótipo'],
    tiers: { essencial: tier('Essencial', 15), basico: tier('Básico', 30), completo: tier('Completo', 45) },
    prototype_url: 'https://hello-best.lovable.app',
  }
  const { error: activationError } = await admin.rpc('activate_dashboard', {
    p_project_id: helloProjectId,
    p_user_id: userIds[2],
    p_actor_id: userIds[0],
    p_content: content,
    p_request_id: `r107-e2e:${nonce}`,
  })
  if (activationError) throw activationError

  return { admin, adminEmail, gazetaEmail, helloEmail, password, userIds, gazetaClientId, helloClientId, gazetaProjectId, helloProjectId }
}

export async function setHelloAccessOffset(fixture: R107Fixture, offsetMilliseconds: number) {
  const releasedAt = new Date(Date.now() - 15 * 86_400_000 + offsetMilliseconds).toISOString()
  const { error } = await fixture.admin.from('projects').update({ access_released_at: releasedAt }).eq('id', fixture.helloProjectId)
  if (error) throw error
}

export async function cleanupR107Fixture(fixture: R107Fixture | undefined) {
  if (!fixture) return
  await fixture.admin.from('memberships').delete().in('user_id', fixture.userIds.slice(1))
  await Promise.all(fixture.userIds.map((userId) => fixture.admin.auth.admin.deleteUser(userId)))
  runSeed()
}

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type F311Fixture = {
  admin: SupabaseClient
  adminEmail: string
  clientEmail: string
  password: string
  adminId: string
  clientUserId: string
  clientId: string
  leadId: string
  projectId: string
  projectName: string
  installmentIds: string[]
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
  if (!apiUrl || !serviceRoleKey) throw new Error('Local Supabase is not available for F3-11 E2E')
  return { apiUrl, serviceRoleKey }
}

function localDatePlus(days: number) {
  const saoPauloToday = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  const date = new Date(`${saoPauloToday}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function createF311Fixture(): Promise<F311Fixture> {
  const { apiUrl, serviceRoleKey } = localSupabaseEnvironment()
  const admin = createClient(apiUrl, serviceRoleKey, { auth: { persistSession: false } })
  const nonce = randomUUID()
  const password = `F311-${randomUUID()}!aA1`
  const adminEmail = `f311-admin-${nonce}@example.test`
  const clientEmail = `f311-client-${nonce}@example.test`
  const clientId = randomUUID()
  const leadId = randomUUID()
  const projectId = randomUUID()
  const projectName = `Financeiro E2E F3-11 ${nonce.slice(0, 8)}`
  const [adminResult, clientResult] = await Promise.all([
    admin.auth.admin.createUser({ email: adminEmail, password, email_confirm: true, app_metadata: { role: 'NO_ADMIN' } }),
    admin.auth.admin.createUser({ email: clientEmail, password, email_confirm: true, app_metadata: { role: 'CLIENT' } }),
  ])
  if (adminResult.error || !adminResult.data.user) throw adminResult.error ?? new Error('F3-11 admin user was not created')
  if (clientResult.error || !clientResult.data.user) throw clientResult.error ?? new Error('F3-11 client user was not created')
  const adminId = adminResult.data.user.id
  const clientUserId = clientResult.data.user.id
  const { error: leadError } = await admin.from('leads').insert({ id: leadId, nome: 'Lead E2E F3-11', email: clientEmail })
  if (leadError) throw leadError
  const { error: clientError } = await admin.from('clients').insert({ id: clientId, name: 'Cliente E2E F3-11', slug: `f311-${nonce}`, email: clientEmail })
  if (clientError) throw clientError
  const { error: membershipError } = await admin.from('memberships').insert({ client_id: clientId, user_id: clientUserId, role: 'CLIENT' })
  if (membershipError) throw membershipError
  const { error: projectError } = await admin.from('projects').insert({
    id: projectId, client_id: clientId, lead_id: leadId, name: projectName, niche: 'servicos',
    lead_status: 'CONVERTIDO', project_status: 'CONVERTIDO', access_status: 'ATIVO_ATE_FIM_DO_PROJETO',
    access_released_at: new Date().toISOString(),
    modules: { como_funciona: 'ativo', prototipo: 'ativo', etapas: 'ativo', editor: 'ativo', versoes: 'ativo', marca: 'ativo' },
  })
  if (projectError) throw projectError
  const { error: paymentError } = await admin.from('payments').insert([
    { lead_id: leadId, project_id: projectId, purpose: 'roadmap', method: 'pix', amount_cents: 14990, status: 'approved', gateway_order_id: `f311-approved-${nonce}` },
    { lead_id: leadId, project_id: projectId, purpose: 'roadmap', method: 'pix', amount_cents: 3000, status: 'failed', gateway_order_id: `f311-failed-${nonce}` },
  ])
  if (paymentError) throw paymentError
  const { data: installments, error: installmentsError } = await admin.from('installments').insert([
    { project_id: projectId, number: 1, amount_cents: 100000, due_date: localDatePlus(15) },
    { project_id: projectId, number: 2, amount_cents: 100000, due_date: localDatePlus(30) },
    { project_id: projectId, number: 3, amount_cents: 100000, due_date: localDatePlus(45) },
    { project_id: projectId, number: 4, amount_cents: 50000, due_date: localDatePlus(-1) },
  ]).select('id')
  if (installmentsError || !installments) throw installmentsError ?? new Error('F3-11 installments were not created')
  await admin.from('activity_events').delete().eq('project_id', projectId)
  return { admin, adminEmail, clientEmail, password, adminId, clientUserId, clientId, leadId, projectId, projectName, installmentIds: installments.map(({ id }) => id) }
}

export async function cleanupF311Fixture(fixture: F311Fixture | undefined) {
  if (!fixture) return
  await fixture.admin.from('activity_events').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('installments').delete().eq('project_id', fixture.projectId)
  const paymentIds = (await fixture.admin.from('payments').select('id').eq('project_id', fixture.projectId)).data?.map(({ id }) => id) ?? []
  if (paymentIds.length > 0) await fixture.admin.from('payment_events').delete().in('payment_id', paymentIds)
  await fixture.admin.from('payments').delete().eq('project_id', fixture.projectId)
  await fixture.admin.from('projects').delete().eq('id', fixture.projectId)
  await fixture.admin.from('memberships').delete().eq('client_id', fixture.clientId)
  await fixture.admin.from('clients').delete().eq('id', fixture.clientId)
  await fixture.admin.from('leads').delete().eq('id', fixture.leadId)
  await Promise.all([fixture.admin.auth.admin.deleteUser(fixture.adminId), fixture.admin.auth.admin.deleteUser(fixture.clientUserId)])
}

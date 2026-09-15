import { supabase } from './lib/supabase'

export type SaldosMovementType = 'aprovacao' | 'recebimento' | 'reembolso' | 'estorno' | 'tentativa' | 'falha' | 'parcela' | 'parcela_vencida' | 'parcela_legada'
export type SaldosBucket = 'realized' | 'pending' | 'projected'

export type FinancialMovement = {
  id: string
  projectId: string | null
  projectName: string | null
  date: string | null
  amountCents: number
  type: SaldosMovementType | string
  status: string
  source: 'payment' | 'installment' | string
  installmentId: string | null
  bucket?: SaldosBucket
}

export type SaldosSnapshot = {
  today: string
  realizedCents: number
  pendingCents: number
  projectedCents: number
  projections: { '15': number; '30': number; '45': number }
  realized: FinancialMovement[]
  pending: FinancialMovement[]
  projected: FinancialMovement[]
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

export function daysUntilDue(dueDate: string, today = saoPauloDate()): number {
  const due = Date.parse(`${dueDate}T00:00:00Z`)
  const base = Date.parse(`${today}T00:00:00Z`)
  return Math.round((due - base) / 86_400_000)
}

export function classifyMovement(movement: FinancialMovement, today = saoPauloDate()): SaldosBucket {
  if (movement.bucket) return movement.bucket
  if (movement.status === 'approved' || movement.status === 'refunded' || movement.status === 'chargedback' || movement.status === 'recebida' || movement.type === 'aprovacao' || movement.type === 'recebimento' || movement.type === 'reembolso' || movement.type === 'estorno') return 'realized'
  if (movement.status === 'failed' || movement.status === 'canceled' || movement.status === 'pending' || movement.status === 'created' || movement.status === 'pendente' || movement.type === 'falha' || movement.type === 'parcela_vencida') return 'pending'
  if (movement.source === 'installment' && movement.date && daysUntilDue(movement.date.slice(0, 10), today) < 0) return 'pending'
  return 'projected'
}

export function classifyMovements(movements: FinancialMovement[], today = saoPauloDate()): Record<SaldosBucket, FinancialMovement[]> {
  const result: Record<SaldosBucket, FinancialMovement[]> = { realized: [], pending: [], projected: [] }
  for (const movement of movements) result[classifyMovement(movement, today)].push(movement)
  result.realized.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  result.pending.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
  result.projected.sort((a, b) => (a.date ?? '9999-12-31').localeCompare(b.date ?? '9999-12-31'))
  return result
}

export function projectionTotals(movements: FinancialMovement[], today = saoPauloDate()) {
  const future = movements.filter((movement) => movement.source === 'installment' && movement.status === 'prevista' && movement.date)
  return {
    '15': future.filter((movement) => { const days = daysUntilDue(movement.date!.slice(0, 10), today); return days >= 0 && days <= 15 }).reduce((total, movement) => total + movement.amountCents, 0),
    '30': future.filter((movement) => { const days = daysUntilDue(movement.date!.slice(0, 10), today); return days > 15 && days <= 30 }).reduce((total, movement) => total + movement.amountCents, 0),
    '45': future.filter((movement) => { const days = daysUntilDue(movement.date!.slice(0, 10), today); return days > 30 && days <= 45 }).reduce((total, movement) => total + movement.amountCents, 0),
  }
}

function movementFromApi(value: Record<string, unknown>): FinancialMovement {
  return {
    id: String(value.id ?? ''),
    projectId: value.project_id == null ? null : String(value.project_id),
    projectName: value.project_name == null ? null : String(value.project_name),
    date: value.occurred_at == null ? null : String(value.occurred_at),
    amountCents: Number(value.amount_cents ?? 0),
    type: String(value.type ?? 'movimento'),
    status: String(value.status ?? ''),
    source: String(value.source ?? 'payment'),
    installmentId: value.installment_id == null ? null : String(value.installment_id),
    bucket: value.bucket as SaldosBucket | undefined,
  }
}

function normalizeList(value: unknown): FinancialMovement[] {
  return Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === 'object')).map(movementFromApi) : []
}

export function normalizeSaldosSnapshot(value: unknown): SaldosSnapshot {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const projections = (raw.projections && typeof raw.projections === 'object' ? raw.projections : {}) as Record<string, unknown>
  const realized = normalizeList(raw.realized)
  const pending = normalizeList(raw.pending)
  const projected = normalizeList(raw.projected)
  return {
    today: String(raw.today ?? saoPauloDate()),
    realizedCents: Number(raw.realizedCents ?? realized.reduce((sum, item) => sum + item.amountCents, 0)),
    pendingCents: Number(raw.pendingCents ?? pending.reduce((sum, item) => sum + item.amountCents, 0)),
    projectedCents: Number(raw.projectedCents ?? projected.reduce((sum, item) => sum + item.amountCents, 0)),
    projections: { '15': Number(projections['15'] ?? 0), '30': Number(projections['30'] ?? 0), '45': Number(projections['45'] ?? 0) },
    realized,
    pending,
    projected,
  }
}

export async function listAdminSaldos(): Promise<SaldosSnapshot> {
  const { data, error } = await supabase.rpc('list_admin_saldos')
  if (error) throw error
  return normalizeSaldosSnapshot(data)
}

export async function upsertInstallment(values: { projectId: string; number: number; amountCents: number; dueDate: string }, requestId = crypto.randomUUID()): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('upsert_installment', {
    p_project_id: values.projectId,
    p_number: values.number,
    p_amount_cents: values.amountCents,
    p_due_date: values.dueDate,
    p_request_id: requestId,
  })
  if (error) throw error
  return data as Record<string, unknown>
}

export async function markInstallmentReceived(installmentId: string, receivedAt = new Date().toISOString(), requestId = crypto.randomUUID()): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('mark_installment_received', {
    p_installment_id: installmentId,
    p_received_at: receivedAt,
    p_request_id: requestId,
  })
  if (error) throw error
  return data as Record<string, unknown>
}

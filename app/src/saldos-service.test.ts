import { describe, expect, it, vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: {} }))
import { classifyMovements, daysUntilDue, projectionTotals, saoPauloDate, type FinancialMovement } from './saldos-service'

const movement = (overrides: Partial<FinancialMovement>): FinancialMovement => ({
  id: 'm', projectId: 'p', projectName: 'Projeto', date: '2026-09-15T12:00:00Z', amountCents: 1000,
  type: 'parcela', status: 'prevista', source: 'installment', installmentId: 'i', ...overrides,
})

describe('saldos service', () => {
  it('C1 classifica tipos e janelas financeiras', () => {
    const today = '2026-09-15'
    const groups = classifyMovements([
      movement({ id: 'approved', type: 'aprovacao', status: 'approved', source: 'payment', amountCents: 14990 }),
      movement({ id: 'refund', type: 'reembolso', status: 'refunded', source: 'payment', amountCents: -14990, date: '2026-09-16T12:00:00Z' }),
      movement({ id: 'late', date: '2026-09-14T00:00:00Z' }),
      movement({ id: 'future', date: '2026-09-30T00:00:00Z' }),
    ], today)
    expect(groups.realized.map((item) => item.id)).toEqual(['refund', 'approved'])
    expect(groups.pending.map((item) => item.id)).toEqual(['late'])
    expect(groups.projected.map((item) => item.id)).toEqual(['future'])
    expect(projectionTotals(groups.projected, today)).toEqual({ '15': 1000, '30': 0, '45': 0 })
  })

  it('C2 movimentos ordenam por data decrescente', () => {
    const groups = classifyMovements([
      movement({ id: 'old', status: 'approved', source: 'payment', date: '2026-09-01T00:00:00Z' }),
      movement({ id: 'new', status: 'approved', source: 'payment', date: '2026-09-02T00:00:00Z' }),
    ], '2026-09-15')
    expect(groups.realized.map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('C10 parcelas projetam faixas e legado sem data', () => {
    const today = '2026-09-15'
    const future = [
      movement({ id: 'd15', date: '2026-09-30T00:00:00Z' }),
      movement({ id: 'd30', date: '2026-10-15T00:00:00Z' }),
      movement({ id: 'd45', date: '2026-10-30T00:00:00Z' }),
      movement({ id: 'legacy', date: null, type: 'parcela_legada' }),
    ]
    expect(projectionTotals(future, today)).toEqual({ '15': 1000, '30': 1000, '45': 1000 })
    expect(classifyMovements(future, today).projected).toHaveLength(4)
    expect(daysUntilDue('2026-09-30', today)).toBe(15)
  })

  it('C12 parcela vencida vai para pendente', () => {
    expect(classifyMovements([movement({ date: '2026-09-14T00:00:00Z' })], '2026-09-15').pending).toHaveLength(1)
    expect(saoPauloDate('2026-09-15T03:00:00Z')).toMatch(/^2026-09-15$/)
  })
})

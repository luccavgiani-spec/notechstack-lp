import { describe, expect, it, vi } from 'vitest'
vi.mock('./lib/supabase', () => ({ supabase: {} }))
import { proposeThirtyDaySchedule } from './admin-dashboard/admin-dashboard-service'

describe('F3-12 motor de capacidade', () => {
  it('C7 mantém V1/V2/V3 na janela inclusiva de 30 dias e desloca dias lotados', () => {
    const occupied = Array.from({ length: 5 }, (_, index) => ({ id: String(index), status: 'a_fazer' as const, scheduled_date: '2026-09-16' }))
    const proposal = proposeThirtyDaySchedule(occupied as never, '2026-09-15', 5)
    expect(proposal.map((item) => [item.title, item.scheduled_date])).toContainEqual(['D+1 — referências', '2026-09-17'])
    expect(proposal.map((item) => [item.title, item.scheduled_date])).toEqual(expect.arrayContaining([['V1 — entrega', '2026-09-30'], ['V2 — entrega', '2026-10-07'], ['V3 — go-live', '2026-10-14']]))
  })
})

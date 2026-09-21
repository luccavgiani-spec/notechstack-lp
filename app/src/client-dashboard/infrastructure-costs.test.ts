import { describe, expect, it } from 'vitest'
import { DEFAULT_SCENARIO, estimateInfrastructure } from './infrastructure-costs'

describe('estimativa da stack da clínica', () => {
  it('cobra as bases uma vez e mantém Auth/Storage dentro das franquias', () => {
    const result = estimateInfrastructure(1000, DEFAULT_SCENARIO)
    expect(result.total).toBe(225)
    expect(result.rows.find((row) => row.key === 'auth')?.brl).toBe(0)
    expect(result.rows.find((row) => row.key === 'storage')?.brl).toBe(0)
  })
  it('acrescenta exatamente 500 reais de suporte independentemente do câmbio', () => {
    for (const exchange of [4.5, 5, 6]) {
      const scenario = { ...DEFAULT_SCENARIO, exchange }
      expect(estimateInfrastructure(61743, { ...scenario, support: true }).total - estimateInfrastructure(61743, scenario).total).toBeCloseTo(500, 2)
    }
  })
  it('respeita o limite de CDN e calcula excedentes discriminados', () => {
    expect(estimateInfrastructure(50000, DEFAULT_SCENARIO).rows[0].usd).toBe(20)
    expect(estimateInfrastructure(50001, DEFAULT_SCENARIO).rows[0].usd).toBe(40)
    const result = estimateInfrastructure(100000, DEFAULT_SCENARIO)
    expect(result.rows.find((row) => row.key === 'database')?.usd).toBe(25.5)
    expect(result.rows.find((row) => row.key === 'egress')?.usd).toBe(22.5)
    expect(result.total).toBeCloseTo(result.rows.reduce((sum, row) => sum + row.brl, 0), 2)
  })
  it('diferencia quantidades intermediárias e opcionais', () => {
    expect(estimateInfrastructure(63743, DEFAULT_SCENARIO).total).not.toBe(estimateInfrastructure(63793, DEFAULT_SCENARIO).total)
    expect(estimateInfrastructure(1000, { ...DEFAULT_SCENARIO, email: true }).total).toBe(325)
    expect(estimateInfrastructure(1000, { ...DEFAULT_SCENARIO, storage: true }).rows.find((row) => row.key === 'storage')?.brl).toBe(0.64)
  })
})

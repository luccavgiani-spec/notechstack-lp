import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { validateRoadmapContent } from '../../supabase/functions/_shared/roadmap-content'

const content = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'scripts/exemplos/roadmap-discordia-demo.json'), 'utf8'))

describe('case Discordia demonstrativo', () => {
  it('atende ao contrato de publicação com três opções', () => {
    expect(validateRoadmapContent(content)).toMatchObject({ valid: true, invalidFields: [] })
    expect(Object.keys(content.tiers)).toEqual(['essencial', 'basico', 'completo'])
    expect(content.preferred_tier).toBeNull()
  })

  it('identifica preços e prazos como fictícios, sem compromisso comercial', () => {
    expect(content.costs.join(' ')).toContain('Não constituem oferta, contrato ou cobrança')
    for (const tier of Object.values(content.tiers) as Array<{ profundidade: string; faixa: string; exclusoes: string[] }>) {
      expect(tier.profundidade).toContain('Fictício')
      expect(tier.faixa).toContain('sem cobrança')
      expect(tier.exclusoes).toContain('Qualquer compromisso comercial real')
    }
  })

  it('usa o case existente sem incluir dados pessoais do cliente', () => {
    expect(content.prototype_url).toBe('https://discordia-eight.vercel.app')
    expect(JSON.stringify(content)).not.toMatch(/@|herosyu|yutaka/i)
  })
})

import { describe, expect, it } from 'vitest'
import {
  ROADMAP_REQUIRED_FIELDS,
  ROADMAP_TIER_FIELDS,
  ROADMAP_TIER_KEYS,
  validateRoadmapContent,
} from '../../supabase/functions/_shared/roadmap-content'

const tier = {
  escopo: ['Fluxo principal'],
  profundidade: 'Operação inicial',
  exclusoes: [],
  complexidade: 'média',
  prazo_dias: 30,
  valor_centavos: null,
  faixa: 'sob proposta',
}

function content() {
  return {
    answers: { objetivo: 'Organizar a operação' },
    references: [],
    stack: ['React'],
    costs: [],
    next_steps: ['Validar'],
    tiers: {
      essencial: structuredClone(tier),
      basico: structuredClone(tier),
      completo: structuredClone(tier),
    },
  }
}

describe('C4 — contrato de conteúdo da Skill 01', () => {
  it.each(ROADMAP_REQUIRED_FIELDS)(
    'rejeita o campo obrigatório ausente: %s',
    (field) => {
      const candidate = content() as Record<string, unknown>
      delete candidate[field]
      expect(validateRoadmapContent(candidate)).toMatchObject({
        valid: false,
        invalidFields: [field],
      })
    },
  )

  it.each(ROADMAP_TIER_KEYS)(
    'rejeita a chave de tier ausente: %s',
    (tierKey) => {
      const candidate = content()
      delete candidate.tiers[tierKey]
      expect(validateRoadmapContent(candidate)).toMatchObject({
        valid: false,
        invalidFields: [`tiers.${tierKey}`],
      })
    },
  )

  it.each(ROADMAP_TIER_FIELDS)(
    'rejeita o campo aninhado ausente: %s',
    (field) => {
      const candidate = content()
      delete (candidate.tiers.essencial as Record<string, unknown>)[field]
      expect(validateRoadmapContent(candidate)).toMatchObject({
        valid: false,
        invalidFields: [`tiers.essencial.${field}`],
      })
    },
  )

  it('aceita opcionais ausentes, nulos ou tipados e rejeita valores fora do contrato', () => {
    expect(validateRoadmapContent(content()).valid).toBe(true)
    expect(validateRoadmapContent({
      ...content(),
      preferred_tier: null,
      prototype_url: null,
    }).valid).toBe(true)
    expect(validateRoadmapContent({
      ...content(),
      preferred_tier: 'basico',
      prototype_url: 'https://example.com/prototipo',
    }).valid).toBe(true)
    expect(validateRoadmapContent({ ...content(), preferred_tier: 'premium' })).toMatchObject({
      valid: false,
      invalidFields: ['preferred_tier'],
    })
    expect(validateRoadmapContent({ ...content(), prototype_url: 42 })).toMatchObject({
      valid: false,
      invalidFields: ['prototype_url'],
    })
  })
})

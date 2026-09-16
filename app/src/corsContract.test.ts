import { describe, expect, it } from 'vitest'
import { corsHeaders, handlePreflight } from '../../supabase/functions/_shared/cors'

describe('R1-08 — origens autorizadas do app publicado', () => {
  it.each([
    'https://notechstack.com.br',
    'https://www.notechstack.com.br',
    'https://app.notechstack.com.br',
    'https://notechstack-app.vercel.app',
  ])('permite somente a origem confiável %s', (origin) => {
    expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe(origin)
    expect(corsHeaders(origin).Vary).toBe('Origin')
  })

  it.each([
    null,
    'null',
    'http://notechstack-app.vercel.app',
    'https://outro-app.vercel.app',
    'https://notechstack-app-git-main-luccavgiani-5948s-projects.vercel.app',
    'https://notechstack-app.vercel.app.evil.example',
    'https://notechstack.com.br.evil.example',
  ])('não autoriza origem ausente ou externa %s', (origin) => {
    expect(corsHeaders(origin)['Access-Control-Allow-Origin']).toBe('https://notechstack.com.br')
  })

  it('responde preflight sem executar o contrato de negócio', () => {
    const response = handlePreflight(new Request('https://example.com/function', {
      method: 'OPTIONS', headers: { Origin: 'https://notechstack-app.vercel.app' },
    }))
    expect(response?.status).toBe(204)
    expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('https://notechstack-app.vercel.app')
    expect(handlePreflight(new Request('https://example.com/function'))).toBeNull()
  })
})

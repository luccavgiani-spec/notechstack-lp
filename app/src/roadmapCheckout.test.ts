/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type CheckoutApi = {
  checkout(input: Record<string, unknown>): Promise<Record<string, unknown>>
  _resetForTests(): void
}

const checkoutSource = readFileSync(
  resolve(process.cwd(), '../lp-narrador/cenas-lp/historia/roadmap-checkout.js'),
  'utf8',
)
const diagnosticSource = readFileSync(
  resolve(process.cwd(), '../lp-narrador/cenas-lp/historia/diagnostico.js'),
  'utf8',
)

const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))

describe('checkout do roadmap na home', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    Object.assign(window, {
      NO_CHECKOUT_CONFIG: {
        sendLeadUrl: 'https://local.test/send-lead-email',
        checkoutUrl: 'https://local.test/roadmap-checkout',
        tokenUrl: 'https://local.test/tokens',
        pagarmePublicKey: 'pk_test_publica',
      },
      NoRoadmapCheckout: undefined,
    })
    window.eval(checkoutSource)
  })

  it('mantém a oferta exata de R$ 149,90 e os três marcos', () => {
    expect(diagnosticSource).toContain('Transforme sua ideia em um plano que dá para executar.')
    expect(diagnosticSource).toContain('Por R$ 149,90, a Nó organiza o que você contou, monta um roadmap, prepara uma primeira direção de protótipo e mostra caminhos reais para colocar o produto no ar.')
    expect(diagnosticSource).toContain('Seu material fica pronto em até 3 dias após a confirmação do pagamento.')
    expect(diagnosticSource).toContain('Quero meu roadmap + protótipo — R$ 149,90')
    expect(diagnosticSource).not.toContain('R$ 199,90')
    expect(diagnosticSource).not.toContain('R$ 450,00')

    expect(diagnosticSource).toContain('Dia 1 — referências')
    expect(diagnosticSource).toContain('contato para referências, marca e contexto complementar.')
    expect(diagnosticSource).toContain('Dias 2 e 3 — organização')
    expect(diagnosticSource).toContain('plano, protótipo e caminhos de construção.')
    expect(diagnosticSource).toContain('Entrega — seu dashboard')
    expect(diagnosticSource).toContain('acesso próprio para navegar e decidir como continuar.')
  })

  it('envia contexto roadmap, tokeniza no browser e não manda PAN/CVV ao servidor', async () => {
    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      void init
      const url = String(input)
      if (url.includes('send-lead-email')) return ok({ saved: true, leadId: 'lead-1' })
      if (url.includes('/tokens')) return ok({ id: 'token_card_1' })
      return ok({ paymentId: 'payment-1', status: 'approved' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = window.NoRoadmapCheckout as CheckoutApi
    await api.checkout({
      lead: { nome: 'Ana', email: 'ana@example.com', whatsapp: '11999999999', sid: 'sid-1' },
      answers: { objetivo: 'novo', negocio: 'Loja', publico: 'clientes', ferramentas: 'WhatsApp', resultado: 'Organizar pedidos' },
      metodo: 'cartao',
      card: { number: '4000000000000010', holder_name: 'ANA TESTE', exp_month: 12, exp_year: 30, cvv: '123' },
    })

    const calls = fetchMock.mock.calls
    const leadBody = JSON.parse(String(calls[0][1]?.body))
    expect(leadBody).toMatchObject({ contexto: 'roadmap', sid: 'sid-1', nome: 'Ana' })

    expect(String(calls[1][0])).toBe('https://local.test/tokens?appId=pk_test_publica')
    expect(JSON.parse(String(calls[1][1]?.body))).toMatchObject({
      type: 'card',
      card: { number: '4000000000000010', cvv: '123' },
    })

    const checkoutBody = JSON.parse(String(calls[2][1]?.body))
    expect(checkoutBody).toMatchObject({ leadId: 'lead-1', sid: 'sid-1', metodo: 'cartao', cardToken: 'token_card_1' })
    expect(JSON.stringify(checkoutBody)).not.toMatch(/4000000000000010|"cvv"|exp_month|exp_year/i)
  })

  it('reaproveita o mesmo lead em dois submits da sessão', async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input)
      if (url.includes('send-lead-email')) return ok({ saved: true, leadId: 'lead-pix' })
      return ok({ paymentId: 'payment-pix', status: 'pending', pix: { qrCode: 'pix-123', qrCodeUrl: 'https://local.test/qr.png' } })
    })
    vi.stubGlobal('fetch', fetchMock)

    const api = window.NoRoadmapCheckout as CheckoutApi
    const input = {
      lead: { nome: 'Bia', email: 'bia@example.com', whatsapp: '11988888888', sid: 'sid-pix' },
      answers: { objetivo: 'novo', negocio: 'Clínica', publico: 'equipe', ferramentas: 'Planilha', resultado: 'Organizar agenda' },
      metodo: 'pix',
    }
    const first = await api.checkout(input)
    const second = await api.checkout(input)

    expect(first).toEqual(second)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('send-lead-email'))).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('roadmap-checkout'))).toHaveLength(2)
  })
})

declare global {
  interface Window {
    NO_CHECKOUT_CONFIG?: Record<string, string>
    NoRoadmapCheckout?: CheckoutApi
    VITE_PAGARME_PUBLIC_KEY?: string
  }
}

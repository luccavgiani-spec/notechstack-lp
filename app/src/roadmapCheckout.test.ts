/// <reference types="node" />

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fireEvent, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizePayerCpf } from '../../supabase/functions/_shared/payer-document'
import { normalizeBillingAddress } from '../../supabase/functions/_shared/billing-address'

type CheckoutApi = {
  checkout(input: Record<string, unknown>): Promise<Record<string, unknown>>
  _resetForTests(): void
  normalizePayerCpf(value: unknown): string | null
  normalizeBillingAddress(value: unknown): Record<string, unknown> | null
}

const checkoutSource = readFileSync(
  resolve(process.cwd(), '../lp-narrador/cenas-lp/historia/roadmap-checkout.js'),
  'utf8',
)
const diagnosticSource = readFileSync(
  resolve(process.cwd(), '../lp-narrador/cenas-lp/historia/diagnostico.js'),
  'utf8',
)
const publicConfigSource = readFileSync(
  resolve(process.cwd(), '../lp-narrador/cenas-lp/historia/pagarme-public-config.js'), 'utf8',
)
const homeSource = readFileSync(resolve(process.cwd(), '../lp-narrador/cenas-lp/lp-v7.html'), 'utf8')

const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }))

const billingAddress = { line_1: '123, Rua de Teste, Centro', zip_code: '01001-000', city: 'Sao Paulo', state: 'sp', country: 'BR' }
function fillBillingAddress() {
  fill('cobranca_endereco', billingAddress.line_1)
  fill('cobranca_cep', billingAddress.zip_code)
  fill('cobranca_cidade', billingAddress.city)
  fill('cobranca_uf', billingAddress.state)
}

function mountDiagnostic() {
  document.body.innerHTML = `
    <section id="diagnostico">
      <div class="dg-palco">
        <div class="dg-vaga"></div>
        <div class="dg-foto"><img alt=""></div>
        <div class="dg-tela">
          <div class="dg-nav">
            <button type="button" data-nav="voltar">voltar</button>
            <span class="dg-fase"></span>
            <button type="button" data-nav="proximo">próximo</button>
          </div>
          <form class="dg-corpo"></form>
          <div class="dg-pe">
            <span class="dg-dica"></span>
            <button type="button" class="dg-bt" data-nav="acao">próximo</button>
          </div>
        </div>
      </div>
    </section>`

  Object.defineProperty(Element.prototype, 'animate', {
    configurable: true,
    value: vi.fn(() => ({ cancel: vi.fn() })),
  })
  Object.assign(window, {
    leadSid: 'sid-dom',
    matchMedia: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    },
    scrollTo: vi.fn(),
  })
  vi.stubGlobal('ResizeObserver', class {
    observe() {}
    disconnect() {}
  })
  window.eval(diagnosticSource)
}

function fill(name: string, value: string) {
  const field = document.querySelector(`[name="${name}"]`)
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) {
    throw new Error(`Campo ${name} ausente`)
  }
  fireEvent.input(field, { target: { value } })
}

function next() {
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-nav="proximo"]')!)
}

function completeBriefing() {
  fill('nome', 'Ana')
  fireEvent.click(document.querySelector<HTMLButtonElement>('[data-nav="comecar"]')!)
  fireEvent.click(document.querySelector<HTMLInputElement>('input[name="objetivo"][value="novo"]')!)
  fill('negocio', 'Loja')
  next()
  fireEvent.click(document.querySelector<HTMLInputElement>('input[name="publico"][value="clientes"]')!)
  next()
  fill('ferramentas', 'WhatsApp')
  next()
  fill('resultado', 'Organizar todos os pedidos')
  next()
  fill('email', 'ana@example.com')
  fill('telefone', '11999999999')
  next()
}

describe('checkout do roadmap na home', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    document.body.innerHTML = ''
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

  it('renderiza a oferta exata de R$ 149,90 e os três marcos', () => {
    expect(diagnosticSource).toContain('Transforme sua ideia em um plano que dá para executar.')
    expect(diagnosticSource).toContain('Por R$ 149,90, a Nó organiza o que você contou, monta um roadmap, prepara um protótipo que você pode testar e mostra 3 opções para colocar o produto no ar, cada uma com o que entra, prazo e valor.')
    expect(diagnosticSource).toContain('Seu material fica pronto em até 3 dias após a confirmação do pagamento.')
    expect(diagnosticSource).toContain('Quero meu roadmap + protótipo — R$ 149,90')
    expect(diagnosticSource).not.toContain('R$ 199,90')
    expect(diagnosticSource).not.toContain('R$ 450,00')

    expect(diagnosticSource).toContain('Dia 1 — referências')
    expect(diagnosticSource).toContain('contato para referências, marca e contexto complementar.')
    expect(diagnosticSource).toContain('Dias 2 e 3 — organização')
    expect(diagnosticSource).toContain('plano, protótipo e caminhos de construção.')
    expect(diagnosticSource).toContain('Dia 3 — acesso ao app')
    expect(diagnosticSource).toContain('plano, protótipo e as 3 opções num acesso só seu. Você tem 15 dias para decidir como continuar.')

    mountDiagnostic()
    completeBriefing()

    const offer = document.querySelector<HTMLElement>('.dg-passo[data-passo="7"]')!
    expect(offer).toBeVisible()
    expect(offer.querySelector('.dg-preco-por')).toHaveTextContent(/^R\$ 149,90$/)
    expect(offer.querySelector('.dg-preco-rot')).toHaveTextContent(
      'Por R$ 149,90, a Nó organiza o que você contou, monta um roadmap, prepara um protótipo que você pode testar e mostra 3 opções para colocar o produto no ar, cada uma com o que entra, prazo e valor.',
    )
    expect(offer).not.toHaveTextContent('R$ 149,91')
    expect(offer).not.toHaveTextContent('R$ 199,90')
    expect(offer).not.toHaveTextContent('R$ 450,00')
    expect(offer.querySelectorAll('.dg-prazo li')).toHaveLength(3)
    expect(offer).toHaveTextContent('Dia 1 — referências')
    expect(offer).toHaveTextContent('Dias 2 e 3 — organização')
    expect(offer).toHaveTextContent('Dia 3 — acesso ao app')
  })

  it('carrega somente chave pública e preserva os endpoints configurados', () => {
    const previous = { ...window.NO_CHECKOUT_CONFIG }
    window.eval(publicConfigSource)
    expect(window.NO_CHECKOUT_CONFIG!.pagarmePublicKey).toMatch(/^pk_[A-Za-z0-9]+$/)
    expect(publicConfigSource).not.toMatch(/sk_[A-Za-z0-9]+/)
    expect(window.NO_CHECKOUT_CONFIG!.checkoutUrl).toBe(previous.checkoutUrl)
    expect(window.NO_CHECKOUT_CONFIG!.sendLeadUrl).toBe(previous.sendLeadUrl)
  })

  it('carrega configuração pública antes do checkout e diagnóstico com defer', () => {
    const configIndex = homeSource.indexOf('pagarme-public-config.js?v=1')
    expect(configIndex).toBeGreaterThan(-1)
    expect(configIndex).toBeLessThan(homeSource.search(/roadmap-checkout\.js\?v=\d+/))
    expect(configIndex).toBeLessThan(homeSource.search(/diagnostico\.js\?v=\d+/))
    expect(homeSource).toContain('pagarme-public-config.js?v=1" defer')
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
      document: '529.982.247-25',
      billingAddress,
      card: { number: '4000000000000010', holder_name: 'ANA TESTE', exp_month: 12, exp_year: 30, cvv: '123' },
    })

    const calls = fetchMock.mock.calls
    const leadBody = JSON.parse(String(calls[0][1]?.body))
    expect(leadBody).not.toHaveProperty('document')
    expect(leadBody).not.toHaveProperty('billingAddress')
    expect(JSON.stringify(leadBody)).not.toContain('52998224725')
    expect(leadBody).toMatchObject({
      contexto: 'roadmap',
      sid: 'sid-1',
      nome: 'Ana',
      email: 'ana@example.com',
      whatsapp: '11999999999',
    })

    expect(String(calls[1][0])).toBe('https://local.test/tokens?appId=pk_test_publica')
    expect(JSON.parse(String(calls[1][1]?.body))).toMatchObject({
      type: 'card',
      card: { number: '4000000000000010', cvv: '123' },
    })

    const checkoutBody = JSON.parse(String(calls[2][1]?.body))
    expect(checkoutBody).toMatchObject({ leadId: 'lead-1', sid: 'sid-1', metodo: 'cartao', cardToken: 'token_card_1', document: '52998224725' })
    expect(checkoutBody.billingAddress).toMatchObject({ zip_code: '01001000', state: 'SP' })
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
      document: '52998224725',
    }
    const first = await api.checkout(input)
    const second = await api.checkout(input)

    expect(first).toEqual(second)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('send-lead-email'))).toHaveLength(1)
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('roadmap-checkout'))).toHaveLength(2)
  })

  it('percorre o DOM, tokeniza o cartão e mostra o estado aprovado', async () => {
    const fetchMock = vi.fn((input: string | URL, init?: RequestInit) => {
      void init
      const url = String(input)
      if (url.includes('send-lead-email')) return ok({ saved: true, leadId: 'lead-dom-card' })
      if (url.includes('/tokens')) return ok({ id: 'token_dom_card' })
      return ok({ paymentId: 'payment-dom-card', status: 'approved' })
    })
    vi.stubGlobal('fetch', fetchMock)
    mountDiagnostic()
    completeBriefing()

    const action = document.querySelector<HTMLButtonElement>('[data-nav="acao"]')!
    expect(action).toHaveTextContent('Quero meu roadmap + protótipo — R$ 149,90')
    fireEvent.click(action)
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-pagamento="cartao"]')!)
    fill('cartao_nome', 'ANA TESTE')
    fill('cartao_numero', '4000000000000010')
    fill('cartao_validade', '12/30')
    fill('cartao_cvv', '123')
    fill('pagador_documento', '529.982.247-25')
    fillBillingAddress()
    fireEvent.click(action)

    await waitFor(() => expect(document.body).toHaveTextContent('pagamento aprovado'))
    expect(document.body).toHaveTextContent('No Dia 1, a Nó entra em contato pelo WhatsApp')
    const checkoutCall = fetchMock.mock.calls.find(([url]) => String(url).includes('roadmap-checkout'))
    const checkoutBody = JSON.parse(String(checkoutCall?.[1]?.body))
    expect(checkoutBody).toMatchObject({ metodo: 'cartao', cardToken: 'token_dom_card', sid: 'sid-dom' })
    expect(JSON.stringify(checkoutBody)).not.toMatch(/4000000000000010|"cvv"|exp_month|exp_year/i)
  })

  it('percorre o DOM e mostra QR e copia-e-cola do Pix', async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      if (String(input).includes('send-lead-email')) return ok({ saved: true, leadId: 'lead-dom-pix' })
      return ok({
        paymentId: 'payment-dom-pix',
        status: 'pending',
        pix: { qrCode: '000201-pix-dom', qrCodeUrl: 'https://local.test/pix.png' },
      })
    })
    vi.stubGlobal('fetch', fetchMock)
    mountDiagnostic()
    completeBriefing()

    const action = document.querySelector<HTMLButtonElement>('[data-nav="acao"]')!
    fireEvent.click(action)
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-pagamento="pix"]')!)
    fill('pagador_documento', '529.982.247-25')
    fireEvent.click(action)

    await waitFor(() => expect(document.body).toHaveTextContent('seu Pix está pronto'))
    expect(document.querySelector<HTMLTextAreaElement>('.dg-pix-codigo textarea')).toHaveValue('000201-pix-dom')
    expect(document.querySelector<HTMLImageElement>('.dg-pix-qr')).toHaveAttribute('src', 'https://local.test/pix.png')
  })

  it('mantém o formulário de cartão aberto e permite retry na recusa', async () => {
    const fetchMock = vi.fn((input: string | URL) => {
      const url = String(input)
      if (url.includes('send-lead-email')) return ok({ saved: true, leadId: 'lead-dom-failed' })
      if (url.includes('/tokens')) return ok({ id: 'token_dom_failed' })
      return ok({ paymentId: 'payment-dom-failed', status: 'failed' })
    })
    vi.stubGlobal('fetch', fetchMock)
    mountDiagnostic()
    completeBriefing()

    const action = document.querySelector<HTMLButtonElement>('[data-nav="acao"]')!
    fireEvent.click(action)
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-pagamento="cartao"]')!)
    fill('cartao_nome', 'ANA TESTE')
    fill('cartao_numero', '4000000000000028')
    fill('cartao_validade', '12/30')
    fill('cartao_cvv', '123')
    fill('pagador_documento', '52998224725')
    fillBillingAddress()
    fireEvent.click(action)

    await waitFor(() => expect(document.body).toHaveTextContent('pagamento recusado'))
    expect(document.querySelector('[name="cartao_numero"]')).toBeInTheDocument()
    expect(action).toBeVisible()
    expect(action).toBeEnabled()
    expect(action).toHaveTextContent('pagar →')
  })

  it('mostra loading e recupera de erro genérico com retry visível', async () => {
    let finishCheckout: ((response: Response) => void) | undefined
    const pendingCheckout = new Promise<Response>((resolve) => {
      finishCheckout = resolve
    })
    const fetchMock = vi.fn((input: string | URL) => {
      if (String(input).includes('send-lead-email')) return ok({ saved: true, leadId: 'lead-dom-error' })
      return pendingCheckout
    })
    vi.stubGlobal('fetch', fetchMock)
    mountDiagnostic()
    completeBriefing()

    const action = document.querySelector<HTMLButtonElement>('[data-nav="acao"]')!
    fireEvent.click(action)
    fireEvent.click(document.querySelector<HTMLButtonElement>('[data-pagamento="pix"]')!)
    fill('pagador_documento', '52998224725')
    fireEvent.click(action)

    await waitFor(() => expect(action).toHaveTextContent('processando…'))
    expect(action).toBeDisabled()

    finishCheckout?.(new Response(JSON.stringify({ error_code: 'PAGARME_ORDER_FAILED' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    }))

    await waitFor(() => expect(document.body).toHaveTextContent('não foi possível concluir agora'))
    expect(action).toBeVisible()
    expect(action).toBeEnabled()
    expect(action).toHaveTextContent('gerar Pix →')
  })
  it.each([
    ['52998224725', '52998224725'],
    ['529.982.247-25', '52998224725'],
    [' 529.982.247-25 ', '52998224725'],
    ['', null], [undefined, null], [null, null], [52998224725, null],
    ['11111111111', null], ['00000000000', null], ['52998224726', null],
    ['5299822472', null], ['529982247251', null], ['abc52998224725', null],
  ])('valida CPF igualmente no navegador e no servidor: %s', (input, expected) => {
    expect(normalizePayerCpf(input)).toBe(expected)
    expect(window.NoRoadmapCheckout!.normalizePayerCpf(input)).toBe(expected)
  })

  it.each(['', '11111111111'])('bloqueia CPF inválido antes de salvar lead ou chamar gateway: %s', async (document) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(window.NoRoadmapCheckout!.checkout({ document })).rejects.toMatchObject({ code: 'INVALID_PAYER_DOCUMENT' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(['pix', 'cartao'])('mostra CPF no DOM e impede envio vazio para %s', (method) => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    mountDiagnostic()
    completeBriefing()
    const action = document.querySelector<HTMLButtonElement>('[data-nav="acao"]')!
    fireEvent.click(action)
    fireEvent.click(document.querySelector<HTMLButtonElement>(`[data-pagamento="${method}"]`)!)
    expect(document.querySelector('[name="pagador_documento"]')).toHaveAttribute('autocomplete', 'off')
    fireEvent.click(action)
    expect(document.body).toHaveTextContent('confira o CPF do pagador')
    // o lead é gravado ao concluir a etapa 5 (antes do pagamento); CPF vazio
    // nunca chega ao checkout nem à tokenização
    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.every((url) => url.includes('send-lead-email'))).toBe(true)
  })

  it.each([
    undefined, null, {}, [], { ...billingAddress, zip_code: '123' },
    { ...billingAddress, zip_code: 'abc01001000' }, { ...billingAddress, state: 'ZZ' },
    { ...billingAddress, city: '' }, { ...billingAddress, line_1: '' }, { ...billingAddress, country: 'US' },
  ])('rejeita endereço incompleto igualmente no browser e backend: %j', (input) => {
    expect(normalizeBillingAddress(input)).toBeNull()
    expect(window.NoRoadmapCheckout!.normalizeBillingAddress(input)).toBeNull()
  })
  it('normaliza endereço de cobrança igualmente no browser e backend', () => {
    expect(normalizeBillingAddress(billingAddress)).toEqual({ ...billingAddress, zip_code: '01001000', state: 'SP' })
    expect(window.NoRoadmapCheckout!.normalizeBillingAddress(billingAddress)).toEqual(normalizeBillingAddress(billingAddress))
  })
  it('não salva lead nem tokeniza quando falta chave pública de cartão', async () => {
    window.NO_CHECKOUT_CONFIG!.pagarmePublicKey = ''
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(window.NoRoadmapCheckout!.checkout({ metodo: 'cartao', document: '52998224725', billingAddress })).rejects.toMatchObject({ code: 'PAGARME_PUBLIC_KEY_MISSING' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('rejeita endereço inválido antes de salvar lead ou tokenizar', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(window.NoRoadmapCheckout!.checkout({ metodo: 'cartao', document: '52998224725' })).rejects.toMatchObject({ code: 'INVALID_BILLING_ADDRESS' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

declare global {
  interface Window {
    NO_CHECKOUT_CONFIG?: Record<string, string>
    NoRoadmapCheckout?: CheckoutApi
    VITE_PAGARME_PUBLIC_KEY?: string
    leadSid?: string
  }
}

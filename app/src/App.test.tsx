import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Session, User } from '@supabase/supabase-js'
import { BrowserRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import { AuthProvider } from './auth/AuthProvider'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  listFactors: vi.fn(),
  challengeAndVerify: vi.fn(),
  enroll: vi.fn(),
  unenroll: vi.fn(),
  order: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      mfa: {
        listFactors: mocks.listFactors,
        challengeAndVerify: mocks.challengeAndVerify,
        enroll: mocks.enroll,
        unenroll: mocks.unenroll,
      },
    },
    from: mocks.from,
  },
}))

vi.mock('./client-dashboard/ClientDashboardPage', () => ({
  ClientDashboardPage: () => <h1>Seu primeiro plano está pronto.</h1>,
}))

function buildUser(role?: 'CLIENT' | 'NO_ADMIN'): User {
  return {
    id: role === 'NO_ADMIN' ? 'admin-user' : 'client-user',
    app_metadata: role ? { role } : {},
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-09-15T00:00:00.000Z',
  }
}

// JWT só com o payload que importa ao app: o claim `aal` da sessão.
function tokenAal(aal: 'aal1' | 'aal2'): string {
  const payload = btoa(JSON.stringify({ aal })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${payload}.assinatura`
}

function buildSession(role?: 'CLIENT' | 'NO_ADMIN', aal: 'aal1' | 'aal2' = 'aal1'): Session {
  return {
    access_token: role === 'NO_ADMIN' ? tokenAal(aal) : 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: buildUser(role),
  }
}

function renderAt(pathname: string) {
  window.history.pushState({}, '', pathname)
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>,
  )
}

async function submitLogin() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('E-mail'), 'pessoa@cliente.com')
  await user.type(screen.getByLabelText('Senha'), 'senha-segura')
  await user.click(screen.getByRole('button', { name: 'Entrar' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mocks.unsubscribe } },
  })
  mocks.order.mockResolvedValue({ data: [], error: null })
  mocks.select.mockReturnValue({ order: mocks.order })
  mocks.from.mockReturnValue({ select: mocks.select })
})

describe('criterion 11 — destinos pós-login', () => {
  it('leva CLIENT com um projeto para como-funciona do próprio projeto', async () => {
    const session = buildSession('CLIENT')
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    })
    mocks.order.mockResolvedValue({
      data: [{ id: 'projeto-a', name: 'Projeto Alfa' }],
      error: null,
    })

    renderAt('/login')
    await submitLogin()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/p/projeto-a/como-funciona')
    })
    expect(screen.getByRole('heading', { name: 'Seu primeiro plano está pronto.' })).toBeVisible()
  })

  it('leva CLIENT com mais de um projeto para a lista de projetos', async () => {
    const session = buildSession('CLIENT')
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: session.user, session },
      error: null,
    })
    mocks.order.mockResolvedValue({
      data: [
        { id: 'projeto-a', name: 'Projeto Alfa' },
        { id: 'projeto-b', name: 'Projeto Beta' },
      ],
      error: null,
    })

    renderAt('/login')
    await submitLogin()

    await waitFor(() => {
      expect(window.location.pathname).toBe('/p/projetos')
    })
    expect(
      await screen.findByRole('heading', { name: 'Escolha um projeto.' }),
    ).toBeVisible()
    const alfaLink = screen.getByRole('link', { name: 'Abrir Projeto Alfa' })
    const betaLink = screen.getByRole('link', { name: 'Abrir Projeto Beta' })
    expect(alfaLink).toHaveAttribute('href', '/p/projeto-a/como-funciona')
    expect(betaLink).toHaveAttribute('href', '/p/projeto-b/como-funciona')
    expect(mocks.from).toHaveBeenCalledTimes(1)

    await userEvent.click(betaLink)

    expect(window.location.pathname).toBe('/p/projeto-b/como-funciona')
    expect(screen.getByRole('heading', { name: 'Seu primeiro plano está pronto.' })).toBeVisible()
  })

  it('busca e lista projetos acessíveis ao abrir /p/projetos diretamente', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: buildSession('CLIENT') }, error: null })
    mocks.order.mockResolvedValue({
      data: [
        { id: 'projeto-a', name: 'Projeto Alfa' },
        { id: 'projeto-b', name: 'Projeto Beta' },
      ],
      error: null,
    })

    renderAt('/p/projetos')

    expect(await screen.findByRole('link', { name: 'Abrir Projeto Alfa' })).toHaveAttribute(
      'href',
      '/p/projeto-a/como-funciona',
    )
    expect(screen.getByRole('link', { name: 'Abrir Projeto Beta' })).toHaveAttribute(
      'href',
      '/p/projeto-b/como-funciona',
    )
    expect(mocks.from).toHaveBeenCalledWith('projects')
    expect(mocks.select).toHaveBeenCalledWith('id, name')
  })

  it('leva NO_ADMIN para a lista operacional só depois do segundo fator (C2)', async () => {
    const session = buildSession('NO_ADMIN')
    let avisarSessao: (evento: string, s: Session | null) => void = () => undefined
    mocks.onAuthStateChange.mockImplementation((cb: typeof avisarSessao) => {
      avisarSessao = cb
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }
    })
    mocks.signInWithPassword.mockResolvedValue({ data: { user: session.user, session }, error: null })
    mocks.listFactors.mockResolvedValue({ data: { all: [{ id: 'fator-1', factor_type: 'totp', status: 'verified' }], totp: [{ id: 'fator-1' }] }, error: null })
    mocks.challengeAndVerify.mockImplementation(async () => {
      avisarSessao('MFA_CHALLENGE_VERIFIED', buildSession('NO_ADMIN', 'aal2'))
      return { data: {}, error: null }
    })

    renderAt('/login')
    await submitLogin()

    expect(await screen.findByRole('heading', { name: /Confirme que é você/ })).toBeVisible()
    expect(window.location.pathname).toBe('/login')
    await userEvent.setup().type(screen.getByLabelText('Código de 6 dígitos'), '123456')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirmar código' }))

    expect(mocks.challengeAndVerify).toHaveBeenCalledWith({ factorId: 'fator-1', code: '123456' })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/no/projetos')
    })
    expect(await screen.findByRole('heading', { name: 'Todos os projetos.' })).toBeVisible()
    expect(mocks.from).not.toHaveBeenCalled()
  })

  it('NO_ADMIN sem fator cadastrado vê o QR code e a chave em texto', async () => {
    const session = buildSession('NO_ADMIN')
    mocks.signInWithPassword.mockResolvedValue({ data: { user: session.user, session }, error: null })
    mocks.listFactors.mockResolvedValue({ data: { all: [{ id: 'velho', factor_type: 'totp', status: 'unverified' }], totp: [] }, error: null })
    mocks.unenroll.mockResolvedValue({ data: {}, error: null })
    mocks.enroll.mockResolvedValue({ data: { id: 'novo', totp: { qr_code: 'data:image/svg+xml;utf-8,<svg/>', secret: 'JBSWY3DPEHPK3PXP' } }, error: null })

    renderAt('/login')
    await submitLogin()

    expect(await screen.findByRole('heading', { name: /Ative o segundo fator/ })).toBeVisible()
    expect(screen.getByTestId('mfa-secret')).toHaveTextContent('JBSWY3DPEHPK3PXP')
    expect(screen.getByAltText('QR code do segundo fator')).toBeVisible()
    expect(mocks.unenroll).toHaveBeenCalledWith({ factorId: 'velho' })
  })

  it('sessão NO_ADMIN aal1 que pede /no/* volta para o segundo fator', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: buildSession('NO_ADMIN', 'aal1') }, error: null })
    mocks.listFactors.mockResolvedValue({ data: { all: [], totp: [{ id: 'fator-1' }] }, error: null })

    renderAt('/no/saldos')

    await waitFor(() => expect(window.location.pathname).toBe('/login'))
    expect(await screen.findByRole('heading', { name: /Confirme que é você/ })).toBeVisible()
  })

  it('leva AGENCY_ADMIN para seu console sem abrir a operação global', async () => {
    const session = buildSession('CLIENT')
    session.user.app_metadata = { role: 'AGENCY_ADMIN' }
    mocks.signInWithPassword.mockResolvedValue({ data: { user: session.user, session }, error: null })
    renderAt('/login')
    await submitLogin()
    await waitFor(() => expect(window.location.pathname).toBe('/agencia'))
    expect(await screen.findByText(/Nenhuma agência vinculada à sua conta/)).toBeVisible()
    expect(mocks.from).toHaveBeenCalledWith('agencies')
    expect(mocks.from).not.toHaveBeenCalledWith('projects')
  })

  it('bloqueia AGENCY_ADMIN na gestão de agências da nó', async () => {
    const session = buildSession('CLIENT')
    session.user.app_metadata = { role: 'AGENCY_ADMIN' }
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    renderAt('/no/agencias')
    await waitFor(() => expect(window.location.pathname).toBe('/nao-autorizado'))
    expect(mocks.from).not.toHaveBeenCalled()
  })
})

describe('criterion 12 — falha de login', () => {
  it('mantém /login, exibe erro e limpa somente a senha', async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    })

    renderAt('/login')
    await submitLogin()

    expect(window.location.pathname).toBe('/login')
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível entrar')
    expect(screen.getByLabelText('Senha')).toHaveValue('')
    expect(screen.getByLabelText('E-mail')).toHaveValue('pessoa@cliente.com')
  })
})

describe('criterion 13 — guards de sessão e papel', () => {
  it.each(['/p/projeto-a/como-funciona', '/no/projetos', '/no/projetos/projeto-a', '/no/atividade', '/no/cronograma'])(
    'redireciona sessão ausente em %s para /login',
    async (protectedPath) => {
      renderAt(protectedPath)

      await waitFor(() => {
        expect(window.location.pathname).toBe('/login')
      })
      expect(screen.getByRole('heading', { name: /Entre no seu projeto/i })).toBeVisible()
    },
  )

  it('mostra não autorizado para CLIENT que pede uma rota /no/*', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: buildSession('CLIENT') }, error: null })

    renderAt('/no/projetos')

    expect(
      await screen.findByRole('heading', { name: 'Acesso não autorizado.' }),
    ).toBeVisible()
    expect(window.location.pathname).toBe('/nao-autorizado')
    expect(screen.getByText('Texto provisório · revisar copy')).toBeVisible()
  })

  it.each(['/no/projetos/projeto-a', '/no/atividade', '/no/cronograma'])(
    'mostra não autorizado para CLIENT em %s',
    async (adminPath) => {
      mocks.getSession.mockResolvedValue({ data: { session: buildSession('CLIENT') }, error: null })

      renderAt(adminPath)

      expect(await screen.findByRole('heading', { name: 'Acesso não autorizado.' })).toBeVisible()
      expect(window.location.pathname).toBe('/nao-autorizado')
    },
  )
})

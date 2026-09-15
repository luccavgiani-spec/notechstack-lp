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
  updateUser: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      updateUser: mocks.updateUser,
    },
  },
}))

vi.mock('./client-dashboard/ClientDashboardPage', () => ({
  ClientDashboardPage: () => <h1>Seu primeiro plano está pronto.</h1>,
}))

function buildUser(role: 'CLIENT' | 'NO_ADMIN' = 'CLIENT'): User {
  return {
    id: role === 'CLIENT' ? 'client-user' : 'admin-user',
    app_metadata: { role },
    user_metadata: {},
    aud: 'authenticated',
    created_at: '2026-09-15T00:00:00.000Z',
  }
}

function buildSession(role: 'CLIENT' | 'NO_ADMIN' = 'CLIENT'): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: buildUser(role),
  }
}

function renderAt(path: string) {
  window.history.pushState({}, '', path)
  return render(
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: mocks.unsubscribe } },
  })
})

describe('C7 — convite válido', () => {
  it('sets the password and redirects to its project', async () => {
    const session = buildSession()
    mocks.getSession.mockResolvedValue({ data: { session }, error: null })
    mocks.updateUser.mockResolvedValue({ data: { user: session.user }, error: null })

    renderAt('/acesso?projectId=projeto-a')

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova123!')
    await user.type(screen.getByLabelText('Confirme a senha'), 'SenhaNova123!')
    await user.click(screen.getByRole('button', { name: 'Salvar senha e entrar' }))

    expect(mocks.updateUser).toHaveBeenCalledWith({ password: 'SenhaNova123!' })
    await waitFor(() => {
      expect(window.location.pathname).toBe('/p/projeto-a/como-funciona')
    })
    expect(screen.getByRole('heading', { name: 'Seu primeiro plano está pronto.' })).toBeVisible()
  })

  it('keeps the form when the password update fails', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: buildSession() }, error: null })
    mocks.updateUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'password rejected' },
    })

    renderAt('/acesso?projectId=projeto-a')

    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Nova senha'), 'SenhaNova123!')
    await user.type(screen.getByLabelText('Confirme a senha'), 'SenhaNova123!')
    await user.click(screen.getByRole('button', { name: 'Salvar senha e entrar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível salvar sua senha')
    expect(window.location.pathname).toBe('/acesso')
  })
})

describe('C8 — convite indisponível', () => {
  it.each([
    ['used', '/acesso?projectId=projeto-a&error=access_denied&error_code=otp_expired'],
    ['invalid', '/acesso?projectId=projeto-a#error=access_denied&error_code=otp_invalid'],
    ['expired', '/acesso?projectId=projeto-a&error=access_denied&error_code=otp_expired'],
  ])('%s invite asks for a new link', async (_state, path) => {
    renderAt(path)

    expect(await screen.findByText('Convite vencido')).toBeVisible()
    expect(screen.getByText(/Peça um novo link à Nó/i)).toBeVisible()
    expect(mocks.updateUser).not.toHaveBeenCalled()
  })

  it('does not offer password setup to an authenticated operator', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: buildSession('NO_ADMIN') }, error: null })

    renderAt('/acesso?projectId=projeto-a')

    expect(await screen.findByText('Convite vencido')).toBeVisible()
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
  })
})

describe('loading', () => {
  it('keeps the page in a loading state while Auth resolves the invitation', () => {
    mocks.getSession.mockReturnValue(new Promise(() => undefined))

    renderAt('/acesso?projectId=projeto-a')

    expect(screen.getByRole('status')).toHaveTextContent('Carregando dados')
  })
})

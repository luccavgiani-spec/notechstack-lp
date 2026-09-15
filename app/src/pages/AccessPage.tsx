import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { BrandShell } from '../components/BrandShell'
import { LoadingScreen } from '../components/LoadingScreen'

const PASSWORD_ERROR = 'Não foi possível salvar sua senha. Tente novamente.'

function ExpiredInvite() {
  return (
    <BrandShell eyebrow="Primeiro acesso">
      <div className="rounded-2xl border border-borda bg-white p-7 shadow-card sm:p-9">
        <span className="mb-5 inline-flex rounded-full bg-vermelho-tint px-3 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] text-tinta">
          Convite vencido
        </span>
        <h1 className="text-3xl font-extrabold uppercase tracking-[-0.03em] sm:text-4xl">
          Este link não está mais ativo<span className="text-ambar">.</span>
        </h1>
        <p className="mt-3 max-w-[42ch] text-sm font-light leading-6 text-cinza">
          Peça um novo link à Nó para concluir seu primeiro acesso com segurança.
        </p>
      </div>
    </BrandShell>
  )
}

export function AccessPage() {
  const { loading, session, updatePassword } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const projectId = searchParams.get('projectId')

  if (loading) {
    return <LoadingScreen />
  }

  if (!session || session.user.app_metadata.role !== 'CLIENT' || !projectId) {
    return <ExpiredInvite />
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (password !== confirmation) {
      setErrorMessage('As senhas precisam ser iguais.')
      return
    }

    setSubmitting(true)
    const { user, error } = await updatePassword(password)

    if (error || !user) {
      setPassword('')
      setConfirmation('')
      setErrorMessage(PASSWORD_ERROR)
      setSubmitting(false)
      return
    }

    navigate(`/p/${projectId}/como-funciona`, { replace: true })
  }

  return (
    <BrandShell eyebrow="Primeiro acesso">
      <div className="rounded-2xl border border-borda bg-white p-7 shadow-card sm:p-9">
        <span className="mb-5 inline-flex rounded-full bg-verde-tint px-3 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] text-tinta">
          Convite confirmado
        </span>
        <h1 className="text-3xl font-extrabold uppercase tracking-[-0.03em] sm:text-4xl">
          Crie sua senha<span className="text-ambar">.</span>
        </h1>
        <p className="mt-3 max-w-[42ch] text-sm font-light leading-6 text-cinza">
          Defina uma senha para entrar no seu projeto sempre que precisar.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="new-password">
              Nova senha
            </label>
            <input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-borda bg-osso px-4 py-3 text-sm outline-none transition focus:border-azul focus:ring-2 focus:ring-azul/15"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="confirm-password">
              Confirme a senha
            </label>
            <input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              className="w-full rounded-xl border border-borda bg-osso px-4 py-3 text-sm outline-none transition focus:border-azul focus:ring-2 focus:ring-azul/15"
            />
          </div>

          {errorMessage ? (
            <p role="alert" className="rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-4 py-3 text-sm">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-tinta px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-tinta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar disabled:cursor-wait disabled:opacity-60"
          >
            {submitting ? 'Salvando…' : 'Salvar senha e entrar'}
          </button>
        </form>
      </div>
    </BrandShell>
  )
}

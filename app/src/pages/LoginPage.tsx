import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { BrandShell } from '../components/BrandShell'
import { listAccessibleProjects } from '../projects/project-service'

const GENERIC_LOGIN_ERROR = 'Não foi possível entrar. Confira seus dados e tente novamente.'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setSubmitting(true)

    const { user, error } = await signIn(email, password)

    if (error || !user) {
      setPassword('')
      setErrorMessage(GENERIC_LOGIN_ERROR)
      setSubmitting(false)
      return
    }

    if (user.app_metadata.role === 'NO_ADMIN') {
      navigate('/no/projetos', { replace: true })
      return
    }

    if (user.app_metadata.role === 'AGENCY_ADMIN') {
      navigate('/agencia', { replace: true })
      return
    }

    const { projects, error: projectsError } = await listAccessibleProjects()

    if (projectsError) {
      setPassword('')
      setErrorMessage(GENERIC_LOGIN_ERROR)
      setSubmitting(false)
      return
    }

    if (projects.length === 1) {
      navigate(`/p/${projects[0].id}/como-funciona`, { replace: true })
      return
    }

    navigate('/p/projetos', { replace: true, state: { projects } })
  }

  return (
    <BrandShell eyebrow="Portal do projeto">
      <div className="rounded-2xl border border-borda bg-white p-7 shadow-card sm:p-9">
        <span className="mb-5 inline-flex rounded-full bg-ambar-tint px-3 py-1 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] text-tinta">
          Texto provisório · revisar copy
        </span>
        <h1 className="text-3xl font-extrabold uppercase tracking-[-0.03em] sm:text-4xl">
          Entre no seu projeto<span className="text-ambar">.</span>
        </h1>
        <p className="mt-3 max-w-[42ch] text-sm font-light leading-6 text-cinza">
          Acesse o espaço onde estratégia, entregas e próximos passos se conectam.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-borda bg-osso px-4 py-3 text-sm outline-none transition focus:border-azul focus:ring-2 focus:ring-azul/15"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold" htmlFor="password">
              Senha
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
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
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </div>
    </BrandShell>
  )
}

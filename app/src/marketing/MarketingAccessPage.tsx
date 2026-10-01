import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { BrandShell } from '../components/BrandShell'

// Primeiro acesso do dot pelo link de convite. O /acesso do CLIENT fica intocado.
export function MarketingAccessPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    if (senha !== confirmacao) {
      setErro('As senhas precisam ser iguais.')
      return
    }
    setSalvando(true)
    const { user, error } = await updatePassword(senha)
    if (error || !user) {
      setSenha('')
      setConfirmacao('')
      setErro('Não foi possível salvar a senha. Tente de novo.')
      setSalvando(false)
      return
    }
    navigate('/no/marketing/visao-geral', { replace: true })
  }

  return (
    <BrandShell eyebrow="Conta do dot">
      <div className="rounded-2xl border border-borda bg-white p-7 shadow-card sm:p-9">
        <h1 className="text-3xl font-extrabold uppercase tracking-[-0.03em]">Crie a senha do dot<span className="text-ambar">.</span></h1>
        <p className="mt-3 text-sm font-light leading-6 text-cinza">Esta conta só enxerga o planner de marketing da nó.</p>
        <form className="mt-8 space-y-5" onSubmit={salvar}>
          <label className="block text-sm"><span className="mb-2 block font-semibold">Nova senha</span>
            <input type="password" autoComplete="new-password" minLength={12} required value={senha} onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-xl border border-borda bg-osso px-4 py-3 text-sm" />
          </label>
          <label className="block text-sm"><span className="mb-2 block font-semibold">Confirme a senha</span>
            <input type="password" autoComplete="new-password" minLength={12} required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)}
              className="w-full rounded-xl border border-borda bg-osso px-4 py-3 text-sm" />
          </label>
          {erro ? <p role="alert" className="rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-4 py-3 text-sm">{erro}</p> : null}
          <button type="submit" disabled={salvando} className="w-full rounded-xl bg-tinta px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
            {salvando ? 'Salvando…' : 'Salvar senha e entrar no planner'}
          </button>
        </form>
      </div>
    </BrandShell>
  )
}

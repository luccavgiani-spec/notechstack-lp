import { useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { supabase } from '../lib/supabase'
import { hojeSaoPaulo } from './format'
import { comPeriodo, erroDoPeriodo } from './periodo'
import { botaoSecundario, campo } from './ui'

const itemMenu = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-semibold transition ${isActive ? 'bg-tinta text-white' : 'border border-borda bg-white hover:border-azul'}`

export function MarketingLayout() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const periodo = params.get('periodo')
  const admin = session?.user.app_metadata.role === 'NO_ADMIN'

  async function sair() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  return (
    <main className="min-h-screen bg-osso text-tinta">
      <img className="h-1.5 w-full object-cover" src="/barra-topo-4-cores.svg" alt="" />
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8 lg:px-12">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-5">
          <Link to={comPeriodo('/no/marketing/visao-geral', periodo)} aria-label="Planner de marketing — início">
            <img className="h-auto w-36 sm:w-48" src="/no-tech-stack-tinta-ponto-ambar.svg" alt="nó tech stack" />
          </Link>
          <div className="text-right">
            <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-cinza">Planner de marketing</p>
            <p className="mt-1 text-sm">
              Conta: <strong>{admin ? 'Lucca (admin)' : 'dot (agente)'}</strong>{' · '}
              <button type="button" onClick={() => void sair()} className="text-cinza underline">Sair</button>
            </p>
          </div>
        </header>
        <nav aria-label="Telas do planner" className="-mx-1 flex gap-2 overflow-x-auto px-1 py-4">
          <NavLink to={comPeriodo('/no/marketing/visao-geral', periodo)} className={itemMenu}>Visão geral</NavLink>
          <NavLink to={comPeriodo('/no/marketing/campanhas', periodo)} className={itemMenu}>Campanhas</NavLink>
          <NavLink to={comPeriodo('/no/marketing/calendario', periodo)} className={itemMenu}>Calendário</NavLink>
          <NavLink to={comPeriodo('/no/marketing/registro', periodo)} className={itemMenu}>Registro</NavLink>
          <NavLink to={comPeriodo('/no/marketing/conexoes', periodo)} className={itemMenu}>Conexões</NavLink>
          {admin ? <NavLink to={comPeriodo('/no/marketing/leads', periodo)} className={itemMenu}>Leads</NavLink> : null}
          {admin ? <NavLink to={comPeriodo('/no/marketing/dot', periodo)} className={itemMenu}>Dot</NavLink> : null}
          {admin ? <Link to="/no/projetos" className="whitespace-nowrap px-3 py-2 text-sm text-cinza underline">Voltar para projetos</Link> : null}
        </nav>
        <Outlet />
      </div>
    </main>
  )
}

const PRESETS = [
  ['7d', 'Últimos 7 dias'],
  ['30d', 'Últimos 30 dias'],
  ['mes-passado', 'Mês passado'],
] as const

// Filtro único acima do conteúdo; o período mora na URL (link direto para o dot).
export function SeletorPeriodo() {
  const [params, setParams] = useSearchParams()
  const atual = params.get('periodo') ?? '7d'

  function aplicar(valor: string) {
    const proximo = new URLSearchParams(params)
    proximo.set('periodo', valor)
    setParams(proximo)
  }

  const link = (id: string) => {
    const proximo = new URLSearchParams(params)
    proximo.set('periodo', id)
    return `?${proximo.toString()}`
  }

  return (
    <div className="mb-5 flex flex-wrap items-end gap-2" role="group" aria-label="Período">
      {PRESETS.map(([id, rotulo]) => (
        <Link
          key={id}
          to={link(id)}
          aria-current={atual === id ? 'true' : undefined}
          className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${atual === id ? 'bg-azul text-white' : 'border border-borda bg-white hover:border-azul'}`}
        >
          {rotulo}
        </Link>
      ))}
      {/* key: voltar, avançar e recarregar remontam os campos a partir da URL. */}
      <FormPeriodo key={atual} atual={atual} onAplicar={aplicar} />
    </div>
  )
}

function FormPeriodo({ atual, onAplicar }: { atual: string; onAplicar: (valor: string) => void }) {
  const [hoje] = useState(() => hojeSaoPaulo())
  const [de, setDe] = useState(atual.includes('..') ? atual.split('..')[0] : '')
  const [ate, setAte] = useState(atual.includes('..') ? atual.split('..')[1] : '')
  const [erro, setErro] = useState<string | null>(null)

  // Data digitada pela metade chega aqui como '' (o <input type="date"> só
  // devolve data completa). Antes, isso fazia o Aplicar não fazer nada, calado.
  function aplicar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const problema = erroDoPeriodo(de, ate, hoje)
    setErro(problema)
    if (!problema) onAplicar(`${de}..${ate}`)
  }

  const invalido = erro ? { 'aria-invalid': true, 'aria-describedby': 'erro-periodo' } : {}
  return (
    <form onSubmit={aplicar} noValidate aria-label="Período personalizado" className="flex flex-wrap items-end gap-2">
      <label className="text-xs">
        <span className="mb-1 block font-semibold">De</span>
        <input type="date" className={`${campo} py-2`} value={de} max={hoje} onChange={(e) => setDe(e.target.value)} aria-label="Data inicial" {...invalido} />
      </label>
      <label className="text-xs">
        <span className="mb-1 block font-semibold">Até</span>
        <input type="date" className={`${campo} py-2`} value={ate} max={hoje} onChange={(e) => setAte(e.target.value)} aria-label="Data final" {...invalido} />
      </label>
      <button type="submit" className={botaoSecundario}>Aplicar período</button>
      {erro ? (
        <p id="erro-periodo" role="alert" className="basis-full rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-3 py-2 text-sm">{erro}</p>
      ) : null}
    </form>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getAdminScheduleSettings,
  listAdminProjects,
  listAdminScheduleItems,
  proposeThirtyDaySchedule,
  saveKanbanItem,
  scheduleLoad,
  setAdminDailyCapacity,
  wouldExceedDailyCapacity,
  type ActivityKanbanItem,
  type KanbanItem,
  type ProjectCard,
  type ScheduleProposalItem,
} from '../admin-dashboard/admin-dashboard-service'

const columns = [['a_fazer', 'A fazer'], ['em_andamento', 'Em andamento'], ['concluido', 'Concluído']] as const
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

type PendingSave = { projectId: string; item: Partial<KanbanItem> & { id?: string }; created: boolean }

export function SchedulePage() {
  const [items, setItems] = useState<ActivityKanbanItem[]>([])
  const [projectsData, setProjectsData] = useState<ProjectCard[]>([])
  const [capacity, setCapacity] = useState(5)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const [projectFilter, setProjectFilter] = useState('')
  const [macroFilter, setMacroFilter] = useState('')
  const [fromFilter, setFromFilter] = useState('')
  const [toFilter, setToFilter] = useState('')
  const [draft, setDraft] = useState({ projectId: '', title: '', macro: 'V1', date: today() })
  const [pending, setPending] = useState<PendingSave | null>(null)
  const [proposalProjectId, setProposalProjectId] = useState('')
  const [proposal, setProposal] = useState<ScheduleProposalItem[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void Promise.all([listAdminScheduleItems(), getAdminScheduleSettings(), listAdminProjects()])
      .then(([nextItems, settings, nextProjects]) => { if (!cancelled) { setItems(nextItems); setCapacity(settings.dailyItemCapacity); setProjectsData(nextProjects); setError(false) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [refresh])

  const projects = useMemo(() => [...new Map(items.map((item) => [item.project_id, item.project_name])).entries()], [items])
  const convertedProjects = useMemo(() => projectsData.filter((project) => project.projectStatus === 'CONVERTIDO'), [projectsData])
  const visible = useMemo(() => items.filter((item) => (!projectFilter || item.project_id === projectFilter) && (!macroFilter || item.macro_version === macroFilter) && (!fromFilter || (item.scheduled_date !== null && item.scheduled_date >= fromFilter)) && (!toFilter || (item.scheduled_date !== null && item.scheduled_date <= toFilter))), [items, projectFilter, macroFilter, fromFilter, toFilter])
  const start = today()
  const load = useMemo(() => scheduleLoad(items, start), [items, start])
  const reload = () => { setLoading(true); setRefresh((value) => value + 1) }

  async function persist(action: PendingSave) {
    setPending(null)
    try {
      await saveKanbanItem(action.projectId, action.item)
      setMessage(action.created ? 'Item criado no cronograma.' : 'Item atualizado no cronograma.')
      if (action.created) setDraft({ projectId: action.projectId, title: '', macro: 'V1', date: today() })
      reload()
    } catch { setMessage('Não foi possível gravar este item.') }
  }

  function attempt(action: PendingSave) {
    if (wouldExceedDailyCapacity(items, action.item, capacity)) { setPending(action); return }
    void persist(action)
  }

  async function updateCapacity(value: number) {
    try { setCapacity((await setAdminDailyCapacity(value)).dailyItemCapacity); setMessage('Capacidade diária atualizada.') } catch { setMessage('Não foi possível atualizar a capacidade.') }
  }

  async function confirmProposal() {
    if (!proposalProjectId || proposal.length === 0) return
    try {
      for (const item of proposal) await saveKanbanItem(proposalProjectId, item)
      setMessage('Proposta de 30 dias gravada no cronograma.')
      setProposal([])
      reload()
    } catch { setMessage('Não foi possível gravar a proposta completa.') }
  }

  if (loading) return <main className="min-h-screen bg-osso p-12 text-center text-cinza" role="status">Carregando cronograma…</main>
  if (error) return <main className="min-h-screen bg-osso p-12 text-center"><p>Não foi possível carregar o cronograma.</p><button className="mt-4 rounded-xl bg-tinta px-4 py-2 text-white" type="button" onClick={reload}>Tentar de novo</button></main>

  return <main className="min-h-screen bg-osso text-tinta"><img className="h-1.5 w-full object-cover" src="/barra-topo-4-cores.svg" alt="" /><div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 lg:px-12 lg:py-9"><header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6"><Link to="/no/projetos"><img className="h-auto w-40 sm:w-52" src="/no-tech-stack-tinta-ponto-ambar.svg" alt="nó tech stack" /></Link><div className="text-right"><p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-cinza">Operação Nó</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">Cronograma</h1></div></header><section className="py-8"><div className="flex flex-wrap items-end justify-between gap-4"><p className="max-w-2xl text-cinza">Carga unificada de projetos ativos. Conflitos precisam de confirmação antes de gravar.</p><label className="text-sm">Capacidade por dia<input aria-label="Capacidade por dia" className="ml-2 w-20 rounded-lg border border-borda px-2 py-1" type="number" min="1" max="100" value={capacity} onChange={(event) => void updateCapacity(Number(event.target.value))} /></label></div><div className="mt-5 grid gap-3 rounded-2xl border border-borda bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Projeto<select aria-label="Filtrar por projeto" className="ml-2 rounded-lg border border-borda px-2 py-1" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}><option value="">Todos</option>{projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label><label className="text-sm">Macroversão<select aria-label="Filtrar por macroversão" className="ml-2 rounded-lg border border-borda px-2 py-1" value={macroFilter} onChange={(event) => setMacroFilter(event.target.value)}><option value="">Todas</option><option value="V1">V1</option><option value="V2">V2</option><option value="V3">V3</option></select></label><label className="text-sm">De<input aria-label="Filtrar de" className="ml-2 rounded-lg border border-borda px-2 py-1" type="date" value={fromFilter} onChange={(event) => setFromFilter(event.target.value)} /></label><label className="text-sm">Até<input aria-label="Filtrar até" className="ml-2 rounded-lg border border-borda px-2 py-1" type="date" value={toFilter} onChange={(event) => setToFilter(event.target.value)} /></label></div><div className="mt-5 rounded-2xl border border-borda bg-white p-4"><h2 className="font-mono text-xs font-semibold uppercase tracking-[.14em] text-azul">Carga dos próximos 45 dias</h2><div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">{Object.entries(load).map(([date, count]) => <div className={`rounded-lg p-2 text-center text-xs ${count > capacity ? 'bg-vermelho-tint text-vermelho' : count === capacity ? 'bg-ambar-tint' : 'bg-osso'}`} key={date}><span className="block font-mono">{date.slice(5)}</span><strong>{count}/{capacity}</strong></div>)}</div></div>{convertedProjects.length > 0 ? <div className="mt-5 rounded-2xl border border-azul bg-azul-tint p-4"><h2 className="font-mono text-xs font-semibold uppercase tracking-[.14em] text-azul">Proposta de ciclo · 30 dias</h2><p className="mt-2 text-sm text-cinza">V1 no dia 15; V2 no 22; V3 no 29. Cada data cheia passa para a próxima vaga.</p><div className="mt-3 flex flex-wrap gap-2"><select aria-label="Projeto convertido" className="rounded-lg border border-borda bg-white px-2 py-1 text-sm" value={proposalProjectId} onChange={(event) => setProposalProjectId(event.target.value)}><option value="">Escolha o projeto convertido</option>{convertedProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><button type="button" className="rounded-xl border border-tinta bg-white px-4 py-2 text-sm font-semibold" disabled={!proposalProjectId} onClick={() => setProposal(proposeThirtyDaySchedule(items, start, capacity))}>Gerar proposta</button></div>{proposal.length ? <div className="mt-4 rounded-xl bg-white p-3"><ul className="space-y-1 text-sm">{proposal.map((item) => <li key={item.title}>{item.scheduled_date} · {item.title}{item.beyondHorizon ? ' · fora da janela de 30 dias' : ''}</li>)}</ul><div className="mt-3 flex gap-2"><button type="button" className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white" onClick={() => void confirmProposal()}>Confirmar proposta</button><button type="button" className="rounded-xl border border-borda px-4 py-2 text-sm" onClick={() => setProposal([])}>Descartar</button></div></div> : null}</div> : null}<form className="mt-5 grid gap-3 rounded-2xl border border-borda bg-white p-4 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); if (draft.projectId && draft.title.trim()) attempt({ projectId: draft.projectId, item: { title: draft.title.trim(), macro_version: draft.macro as KanbanItem['macro_version'], status: 'a_fazer', scheduled_date: draft.date || null, position: visible.length }, created: true }) }}><select aria-label="Projeto do novo item" className="rounded-lg border border-borda px-2 py-2 text-sm" value={draft.projectId} onChange={(event) => setDraft({ ...draft, projectId: event.target.value })}><option value="">Projeto do novo item</option>{projects.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select><input aria-label="Título do novo item" className="rounded-lg border border-borda px-2 py-2 text-sm" placeholder="Novo item" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /><input aria-label="Data do novo item" className="rounded-lg border border-borda px-2 py-2 text-sm" type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} /><button type="submit" className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white">Criar item</button></form>{pending ? <div className="mt-4 rounded-2xl border border-ambar bg-ambar-tint p-4"><p className="font-semibold">Conflito de capacidade: essa data passa de {capacity} itens. Confirmar mesmo assim?</p><div className="mt-3 flex gap-2"><button type="button" className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white" onClick={() => void persist(pending)}>Confirmar conflito</button><button type="button" className="rounded-xl border border-borda px-4 py-2 text-sm" onClick={() => setPending(null)}>Cancelar</button></div></div> : null}{message ? <p className="mt-4 text-sm" role="status">{message}</p> : null}{visible.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-borda bg-white p-10 text-center text-cinza">Nenhum item corresponde aos filtros. <Link className="underline" to="/no/projetos">Ver Projetos</Link>.</div> : <div className="mt-6 grid gap-4 lg:grid-cols-3">{columns.map(([status, label]) => <section className="rounded-2xl border border-borda bg-white p-4" key={status}><h2 className="font-semibold">{label}</h2><div className="mt-3 space-y-3">{visible.filter((item) => item.status === status).map((item) => <article className="rounded-xl bg-osso p-3" key={item.id}><p className="font-semibold">{item.title}</p><p className="mt-1 text-xs text-cinza">{item.project_name} · {item.macro_version ?? 'sem macro'}</p><div className="mt-3 flex gap-2"><select aria-label={`Coluna de ${item.title}`} className="rounded-lg border border-borda bg-white px-2 py-1 text-xs" value={item.status} onChange={(event) => attempt({ projectId: item.project_id, item: { ...item, status: event.target.value as KanbanItem['status'] }, created: false })}><option value="a_fazer">A fazer</option><option value="em_andamento">Em andamento</option><option value="concluido">Concluído</option></select><input aria-label={`Data de ${item.title}`} className="rounded-lg border border-borda bg-white px-2 py-1 text-xs" type="date" value={item.scheduled_date ?? ''} onChange={(event) => attempt({ projectId: item.project_id, item: { ...item, scheduled_date: event.target.value || null }, created: false })} /></div></article>)}</div></section>)}</div>}</section></div></main>
}

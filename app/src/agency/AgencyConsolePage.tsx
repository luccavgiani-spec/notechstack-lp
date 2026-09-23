import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { supabase } from '../lib/supabase'
import { listAgencies, loadAgency, loadAgencyProject, portfolioStats, statusLabel, type Agency, type AgencyDetail, type AgencyOverview, type AgencyProject } from './agency-service'
import './agency-console.css'
import './agency-project-detail.css'

const dateLabel = (value: string | null) => value ? new Intl.DateTimeFormat('pt-BR').format(new Date(value.length === 10 ? `${value}T12:00:00` : value)) : 'A definir'
const percent = (p: AgencyProject) => p.totalTasks ? Math.round(p.doneTasks / p.totalTasks * 100) : 0
const statusTone = (s: string) => s === 'CONCLUIDO' ? 'green' : s === 'EM_REVISAO_CLIENTE' ? 'amber' : ['AGENDADO', 'ARQUIVADO', 'ROADMAP_PAGO', 'REFERENCIAS_PENDENTES'].includes(s) ? 'neutral' : 'blue'

function Icon({ name }: { name: 'arrow' | 'search' | 'calendar' | 'layers' | 'check' | 'file' | 'clients' }) {
  const paths = {
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4m8-4v4M4 11h16m-12 4h3" /></>,
    layers: <path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" />,
    check: <path d="m5 12 4 4L19 6" />,
    file: <path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8m-8 4h6" />,
    clients: <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 5v2" /></>,
  }
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}
function Status({ value }: { value: string }) { return <span className={`ac-status ac-tone-${statusTone(value)}`}><i />{statusLabel(value)}</span> }
function Progress({ project }: { project: AgencyProject }) { return <div className="ac-progress"><div><strong>{percent(project)}%</strong><span>{project.doneTasks}/{project.totalTasks} entregas</span></div><progress aria-label={`Progresso de ${project.name}`} value={project.doneTasks} max={project.totalTasks || 1} /></div> }
function Footer() {
  return <footer className="ac-footer"><div className="ac-footer-brand"><img src="/no-tech-stack-tinta-ponto-ambar.svg" alt="nó tech stack" /><span>Sistemas, pessoas e IA.<br />Tudo no mesmo nó.</span></div><div className="ac-footer-context"><span>Console da agência</span>{import.meta.env.DEV && import.meta.env.VITE_AGENCY_LOCAL_PREVIEW === 'true' ? <span className="ac-local">Ambiente local de revisão</span> : null}</div></footer>
}
function Versions({ detail, expanded = false }: { detail: AgencyDetail; expanded?: boolean }) {
  const versions = expanded ? detail.versions : detail.versions.slice(0, 3)
  return versions.length ? <ol className="ac-timeline">{versions.map(v => <li key={v.id}><span className="ac-timeline-icon"><Icon name="file" /></span><div><strong>Versão {v.label}{v.current ? <span className="ac-current">Atual</span> : null}</strong><p>{v.changelog}</p></div><time dateTime={v.publishedAt}>{dateLabel(v.publishedAt)}<small>Publicada</small></time></li>)}</ol> : <div className="ac-empty"><Icon name="layers" /><p>Nenhuma versão publicada.</p><span>As entregas aparecerão aqui conforme forem publicadas.</span></div>
}
function ProjectInfo({ project, version }: { project: AgencyProject; version?: string }) {
  const entries: [string, ReactNode][] = [['Cliente', project.clientName], ['Projeto', project.name], ['Início do projeto', dateLabel(project.startedOn ?? null)], ['Entrega combinada', project.deliveryFrom && project.deliveryTo ? `${dateLabel(project.deliveryFrom)} a ${dateLabel(project.deliveryTo)}` : dateLabel(project.nextDate)], ['Prazo', project.deliveryNote ?? 'Conforme cronograma'], ['Status', <Status value={project.status} />], ['Versão atual', version ?? project.reviewLabel ?? 'Ainda não publicada'], ['Entregas concluídas', `${project.doneTasks} de ${project.totalTasks}`], ['Última atualização', dateLabel(project.updatedAt)]]
  return <dl className="ac-info">{entries.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
const columns = [
  { status: 'a_fazer', title: 'A fazer', tone: 'neutral' },
  { status: 'em_andamento', title: 'Em andamento', tone: 'amber' },
  { status: 'concluido', title: 'Concluído', tone: 'green' },
]
export function ProjectDetail({ agencyId, project, toolbar, previewDetail }: { agencyId: string; project: AgencyProject; toolbar: ReactNode; previewDetail?: AgencyDetail }) {
  const [detail, setDetail] = useState<AgencyDetail | null>(previewDetail ?? null)
  const [error, setError] = useState(false)
  const [tab, setTab] = useState('stages')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (previewDetail) return
    let active = true
    loadAgencyProject(agencyId, project.id).then(data => { if (active) setDetail(data) }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [agencyId, project.id, revision, previewDetail])
  const version = detail?.versions.find(v => v.current)
  return <div className="ac-project-detail"><header className="ac-detail-header"><div className="ac-container"><div className="ac-topbar ac-topbar-dark"><Link to={`/agencia/${agencyId}`} className="ac-logo"><img src="/no-tech-stack-branca-ponto-ambar.svg" alt="nó tech stack" /></Link><nav className="ac-breadcrumb" aria-label="Navegação do projeto"><Link to={`/agencia/${agencyId}`}>Clientes</Link><span>›</span><span>{project.clientName}</span></nav><div className="ac-topbar-actions"><Link className="ac-back-link" to={`/agencia/${agencyId}`}>Voltar aos clientes <Icon name="arrow" /></Link>{toolbar}</div></div>
    <div className="ac-project-heading"><div className="ac-project-identity"><span className="ac-avatar ac-avatar-large">{project.clientName.slice(0, 1)}</span><div><p className="ac-eyebrow">Cliente</p><h1>{project.name}</h1><p className="ac-project-client">{project.clientName}</p></div></div><div className="ac-project-metrics"><div className="ac-project-metric"><strong><svg className="ac-completion-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14" /><circle cx="18" cy="18" r="14" pathLength="100" strokeDasharray={`${percent(project)} 100`} /></svg>{percent(project)}%</strong><span>{project.doneTasks} de {project.totalTasks} concluídas</span><progress aria-label="Conclusão do projeto" value={project.doneTasks} max={project.totalTasks || 1} /></div><div className="ac-project-metric"><strong><Icon name="calendar" />{dateLabel(project.nextDate)}</strong><span>Próxima entrega</span><i className="ac-metric-rule" /></div><div className="ac-project-metric"><strong><i className={`ac-dot ac-tone-${statusTone(project.status)}`} />{statusLabel(project.status)}</strong><span>Status atual</span><i className="ac-metric-rule" /></div><div className="ac-project-metric"><strong><Icon name="layers" />{version?.label ?? project.reviewLabel ?? '—'}</strong><span>{version ? 'Versão atual' : project.reviewLabel ? 'Em análise' : 'Versão atual'}</span><i className="ac-metric-rule" /></div></div></div>
  </div></header><div className="ac-container ac-detail-content"><nav className="ac-tabs" aria-label="Seções do projeto">{[['stages', 'Etapas do projeto'], ['versions', 'Versões e entregas'], ['info', 'Informações']].map(([key, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} className={tab === key ? 'is-active' : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {error ? <div className="ac-message" role="alert">Não foi possível abrir este projeto. Confira seu vínculo com a agência.<button className="ac-button" onClick={() => { setError(false); setRevision(r => r + 1) }}>Tentar novamente</button></div> : !detail ? <p className="ac-message" role="status">Carregando projeto…</p> : <>{tab === 'stages' ? <><div className="ac-board-heading"><p>Etapas e entregas</p><span>Acompanhamento do projeto · somente leitura</span></div><section className="ac-board" aria-label="Etapas e entregas">{columns.map(column => {
      const tasks = detail.tasks.filter(t => t.status === column.status)
      return <section className={`ac-column ac-column-${column.tone}`} aria-label={column.title} key={column.status}><h2><i className="ac-dot" />{column.title}<span>({tasks.length})</span></h2><div className="ac-task-list">{tasks.map(task => <article className="ac-task" key={task.id}><div className="ac-task-title">{task.status === 'concluido' ? <span className="ac-task-check"><Icon name="check" /></span> : null}<h3>{task.title}</h3></div><div className="ac-task-meta">{task.phase ? <span className="ac-task-tag">{task.phase}</span> : null}{task.date ? <p className="ac-task-date"><Icon name="calendar" />{dateLabel(task.date)}</p> : null}</div></article>)}{!tasks.length ? <p className="ac-column-empty">Nenhuma tarefa nesta etapa.</p> : null}</div><div className="ac-column-foot">{tasks.length} {tasks.length === 1 ? 'tarefa' : 'tarefas'}</div></section>
    })}</section>{!detail.tasks.length ? <p className="ac-muted">Nenhuma tarefa cadastrada.</p> : null}<div className="ac-detail-bottom"><section className="ac-panel"><div className="ac-panel-heading"><h2>Últimas versões e entregas</h2><span className="ac-count">{detail.versions.length} versões</span></div><Versions detail={detail} /><button className="ac-button" onClick={() => setTab('versions')}>Ver histórico completo <Icon name="arrow" /></button></section><section className="ac-panel"><h2>Informações do projeto</h2><ProjectInfo project={project} version={version?.label} /></section></div></> : tab === 'versions' ? <section className="ac-panel ac-tab-panel"><h2>Versões publicadas</h2><Versions detail={detail} expanded /></section> : <section className="ac-panel ac-tab-panel"><h2>Informações do projeto</h2><ProjectInfo project={project} version={version?.label} /></section>}</>}
    <Footer /></div></div>
}
export function AgencyConsolePage() {
  const { agencyId, projectId } = useParams()
  const navigate = useNavigate()
  const { session } = useAuth()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [data, setData] = useState<AgencyOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const available = await listAgencies()
        if (!active) return
        setAgencies(available)
        const selected = agencyId ? available.find(a => a.id === agencyId) : available[0]
        if (agencyId && !selected) throw new Error('Agency unavailable')
        if (selected && !agencyId) { navigate(`/agencia/${selected.id}`, { replace: true }); return }
        const next = selected ? await loadAgency(selected.id) : null
        if (active) setData(next)
      } catch { if (active) setError(true) }
      finally { if (active) setLoading(false) }
    }
    void load()
    return () => { active = false }
  }, [agencyId, navigate, revision])
  const current = data?.agency.id === agencyId ? data : null
  const stats = portfolioStats(current?.projects ?? [])
  const selectedProject = current?.projects.find(p => p.id === projectId)
  const projects = (current?.projects ?? []).filter(p => `${p.name} ${p.clientName}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')) && (filter === 'all' || (filter === 'review' ? p.status === 'EM_REVISAO_CLIENTE' : filter === 'done' ? p.status === 'CONCLUIDO' : !['CONCLUIDO', 'ARQUIVADO'].includes(p.status))))
  const upcoming = (current?.projects ?? []).filter(p => p.nextDate && !['CONCLUIDO', 'ARQUIVADO'].includes(p.status)).length
  const isAdmin = session?.user.app_metadata.role === 'NO_ADMIN'
  function changeAgency(id: string) { setLoading(true); setError(false); setSearch(''); setFilter('all'); navigate(`/agencia/${id}`) }
  const toolbar = <>{agencies.length > 1 ? <select aria-label="Agência" value={agencyId ?? ''} onChange={e => changeAgency(e.target.value)}>{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select> : <span className="ac-agency-name">{current?.agency.name}</span>}{isAdmin ? <Link className="ac-button ac-button-primary" to="/no/agencias">Administrar agências <Icon name="arrow" /></Link> : null}<button className="ac-signout" onClick={async () => { const { error: signOutError } = await supabase.auth.signOut(); if (signOutError) { setError(true); return } navigate('/login', { replace: true }) }}>Sair</button></>
  return <main className="ac-app"><img className="ac-colorbar" src="/barra-topo-4-cores.svg" alt="" />{!loading && !error && current && selectedProject ? <ProjectDetail key={`${agencyId}:${projectId}`} agencyId={agencyId!} project={selectedProject} toolbar={toolbar} /> : <div className="ac-container"><header className="ac-topbar"><Link className="ac-logo" to={`/agencia/${agencyId ?? ''}`}><img src="/no-tech-stack-tinta-ponto-ambar.svg" alt="nó tech stack" /></Link><div className="ac-topbar-actions">{toolbar}</div></header>
    <section className="ac-hero"><p className="ac-eyebrow">Console da agência</p><h1>Seus clientes, todos em um só lugar.</h1><p className="ac-hero-description">Acompanhe o andamento dos projetos, prazos e próximos passos.</p>{current ? <dl className="ac-stats">{[['Clientes', stats.clients], ['Projetos ativos', stats.active], ['Em revisão', stats.review], ['Próximas entregas', upcoming]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : null}</section>
    {loading ? <p className="ac-message" role="status">Carregando agência…</p> : error ? <div role="alert" className="ac-message"><p>Não foi possível carregar este console. Confira seu acesso ou tente novamente.</p><button className="ac-button" onClick={() => { setError(false); setLoading(true); setRevision(r => r + 1) }}>Tentar novamente</button></div> : !current ? <p className="ac-message">Nenhuma agência vinculada à sua conta. Solicite o vínculo à nó.</p> : projectId ? <p role="alert" className="ac-message">Projeto não disponível para esta agência.</p> : <section className="ac-portfolio"><div className="ac-portfolio-heading"><h2>Clientes e projetos</h2><div className="ac-filters"><label className="ac-search"><Icon name="search" /><input aria-label="Buscar cliente ou projeto" placeholder="Buscar cliente ou projeto…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Situação dos projetos" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">Todos os status</option><option value="active">Em andamento</option><option value="review">Em revisão</option><option value="done">Concluídos</option></select></div></div>
      {!current.projects.length ? <div className="ac-portfolio-empty"><div className="ac-empty-illustration" aria-hidden="true"><span /><span /><span /><i><Icon name="clients" /></i></div><p className="ac-eyebrow">Tudo pronto para começar</p><h3>Seu próximo projeto começa aqui.</h3><p>Ainda não há clientes vinculados à {current.agency.name}.<br />Quando o primeiro projeto chegar, você acompanha cada etapa por aqui.</p>{isAdmin ? <Link to="/no/agencias" className="ac-button ac-button-primary">Vincular primeiro projeto <Icon name="arrow" /></Link> : <span className="ac-awaiting"><i />Aguardando o primeiro cliente</span>}</div> : !projects.length ? <p className="ac-message">Nenhum projeto corresponde à busca.</p> : <ul className="ac-project-list">{projects.map((p, index) => <li key={p.id}><Link to={`/agencia/${agencyId}/projetos/${p.id}`} className="ac-project-row"><div className="ac-row-identity"><span className={`ac-avatar ac-avatar-${index % 4}`}>{p.clientName.slice(0, 1)}</span><div><h3>{p.clientName}</h3><p>{p.name}</p></div></div><div className="ac-row-project"><span className="ac-label">Projeto</span><span>{p.name}</span></div><Progress project={p} /><div className="ac-row-delivery"><span className="ac-label">Próxima entrega</span><span>{dateLabel(p.nextDate)}</span>{p.overdueTasks > 0 ? <small>{p.overdueTasks} em atraso</small> : null}</div><Status value={p.status} /><span className="ac-row-arrow"><Icon name="arrow" /><span className="sr-only">Acompanhar projeto</span></span></Link></li>)}</ul>}
    </section>}<Footer /></div>}</main>
}

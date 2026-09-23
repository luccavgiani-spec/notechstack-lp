import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { listAdminProjects, type ProjectCard } from '../admin-dashboard/admin-dashboard-service'
import { createAgency, listAgencies, loadAgency, setAgencyProject, type Agency, type AgencyOverview } from './agency-service'

export function AgencyManagementPage() {
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [selected, setSelected] = useState('')
  const [overview, setOverview] = useState<AgencyOverview | null>(null)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    Promise.all([listAgencies(), listAdminProjects()]).then(([a, p]) => { if (active) { setAgencies(a); setProjects(p) } }).catch(() => { if (active) setMessage('Não foi possível carregar as agências. Confira se a camada de agências já foi ativada neste ambiente.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [revision])
  useEffect(() => {
    let active = true
    if (selected) loadAgency(selected).then(data => { if (active) setOverview(data) }).catch(() => { if (active) setMessage('Não foi possível carregar os vínculos.') })
    return () => { active = false }
  }, [selected, revision])
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage('')
    try { await createAgency(name, slug); setName(''); setSlug(''); setRevision(r => r + 1); setMessage('Agência criada.') }
    catch { setMessage('Não foi possível criar. Confira o nome e use um identificador único, em minúsculas e sem espaços.') }
    finally { setBusy(false) }
  }
  async function toggle(projectId: string, linked: boolean) {
    setBusy(true); setMessage('')
    try { await setAgencyProject(selected, projectId, linked); setOverview(await loadAgency(selected)); setMessage(linked ? 'Projeto vinculado à agência.' : 'Vínculo removido.') }
    catch { setMessage('Não foi possível alterar o vínculo. O projeto pode já pertencer a outra agência.') }
    finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-osso px-5 py-8 text-tinta"><div className="mx-auto max-w-5xl">
    <Link className="text-sm text-azul underline" to="/no/projetos">← Operação nó</Link><h1 className="mt-6 text-3xl font-bold">Agências</h1><p className="mt-3 text-cinza">Organize os parceiros e escolha quais projetos cada agência acompanha.</p>
    {message ? <p role="status" className="mt-5 rounded-xl border border-borda bg-white p-4">{message}</p> : null}
    {loading ? <p role="status" className="mt-5">Carregando…</p> : null}
    <form onSubmit={create} className="mt-8 grid gap-4 rounded-2xl border border-borda bg-white p-6 sm:grid-cols-3"><label className="text-sm">Nome da agência<input required maxLength={120} className="mt-2 w-full rounded-lg border border-borda p-3" value={name} onChange={e => setName(e.target.value)} /></label><label className="text-sm">Identificador<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="ex.: maisis" className="mt-2 w-full rounded-lg border border-borda p-3" value={slug} onChange={e => setSlug(e.target.value)} /></label><button disabled={busy} className="self-end rounded-lg bg-tinta px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Criar agência</button></form>
    <section className="mt-8 rounded-2xl border border-borda bg-white p-6"><h2 className="text-xl font-bold">Vínculos de projetos</h2><label className="mt-4 block text-sm">Agência<select className="mt-2 w-full rounded-lg border border-borda p-3" value={selected} onChange={e => { setSelected(e.target.value); setOverview(null); setMessage('') }}><option value="">Selecione uma agência</option>{agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
      {selected ? <Link className="mt-4 inline-block text-sm text-azul underline" to={`/agencia/${selected}`}>Abrir console desta agência →</Link> : null}
      {overview?.agency.id === selected ? <ul className="mt-5 divide-y divide-borda">{projects.map(p => <li className="py-4" key={p.id}><label className="flex items-center gap-3"><input type="checkbox" disabled={busy} checked={overview.projects.some(link => link.id === p.id)} onChange={e => void toggle(p.id, e.target.checked)} /><span><strong>{p.name}</strong><span className="block text-sm text-cinza">{p.clientName}</span></span></label></li>)}</ul> : null}
    </section>
  </div></main>
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listArchiveAssets, type ArchiveAsset } from '../admin-dashboard/admin-dashboard-service'

const TAG_FILTERS = [
  ['nicho', 'Nicho'], ['produto', 'Produto'], ['stack', 'Stack'], ['componente', 'Componente'], ['ux', 'UX'],
  ['problema', 'Problema resolvido'], ['complexidade', 'Complexidade'], ['data', 'Data'], ['origem', 'Origem'], ['direitos', 'Direitos'],
] as const

function tagsText(tags: Record<string, unknown>) {
  return Object.entries(tags).flatMap(([key, value]) => Array.isArray(value) ? value.map((item) => `${key}: ${String(item)}`) : []).join(' · ')
}

export function ArchiveLibraryPage() {
  const [assets, setAssets] = useState<ArchiveAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [tagFilters, setTagFilters] = useState<Record<string, string>>({})
  const [reusableOnly, setReusableOnly] = useState(false)
  const [caseOnly, setCaseOnly] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const reload = () => setRefresh((value) => value + 1)
  useEffect(() => {
    let cancelled = false
    const tags = Object.fromEntries(Object.entries(tagFilters).filter(([, value]) => value.trim()).map(([key, value]) => [key, [value.trim()]]))
    void listArchiveAssets({ tags, reusableOnly, caseOnly })
      .then((result) => { if (!cancelled) { setAssets(result); setError(false) } })
      .catch(() => { if (!cancelled) setError(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [tagFilters, reusableOnly, caseOnly, refresh])
  return <main className="min-h-screen bg-osso text-tinta"><img className="h-1.5 w-full object-cover" src="/barra-topo-4-cores.svg" alt="" /><div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 lg:px-12 lg:py-9"><header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6"><Link to="/no/projetos"><img className="h-auto w-40 sm:w-52" src="/no-tech-stack-tinta-ponto-ambar.svg" alt="nó tech stack" /></Link><div className="text-right"><p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-cinza">Operação Nó</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">Biblioteca</h1></div></header><section className="py-8"><p className="max-w-2xl text-cinza">Snapshots arquivados e autorizados para consulta interna. Materiais confidenciais não entram nesta busca.</p><div className="mt-5 grid gap-3 rounded-2xl border border-borda bg-white p-4 sm:grid-cols-2 lg:grid-cols-3">{TAG_FILTERS.map(([key, label]) => <label className="text-sm" key={key}>{label}<input aria-label={label} className="mt-1 w-full rounded-lg border border-borda px-2 py-1" value={tagFilters[key] ?? ''} onChange={(event) => setTagFilters((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<label className="text-sm"><input type="checkbox" checked={reusableOnly} onChange={(event) => setReusableOnly(event.target.checked)} /> Pode reutilizar</label><label className="text-sm"><input type="checkbox" checked={caseOnly} onChange={(event) => setCaseOnly(event.target.checked)} /> Autorizado para case</label></div>{loading ? <p className="py-12 text-center text-cinza" role="status">Carregando biblioteca…</p> : error ? <div className="mt-6 rounded-2xl border border-vermelho bg-vermelho-tint p-6 text-center"><p>Não foi possível carregar a biblioteca.</p><button type="button" className="mt-4 rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white" onClick={reload}>Tentar de novo</button></div> : assets.length === 0 ? <div className="mt-6 rounded-2xl border border-dashed border-borda bg-white p-10 text-center text-cinza">Nenhum ativo encontrado. Arquive um projeto para iniciar a biblioteca.</div> : <ul className="mt-6 grid gap-4 md:grid-cols-2">{assets.map((asset) => <li className="rounded-2xl border border-borda bg-white p-5" key={asset.id}><p className="font-mono text-xs uppercase tracking-[.12em] text-azul">{asset.rights_label}</p><h2 className="mt-2 text-xl font-bold"><Link className="underline" to={`/no/projetos/${asset.project_id}`}>{asset.project_name}</Link></h2><p className="mt-2 text-sm text-cinza">Versão de origem: {asset.source_version ?? 'sem versão publicada'}</p><p className="mt-3 text-xs text-cinza">{tagsText(asset.tags)}</p></li>)}</ul>}</section></div></main>
}

import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import {
  calculateProgress,
  loadClientDashboard,
  savePreferredTier,
  type DashboardData,
  type JsonValue,
  type KanbanItem,
  type KanbanStatus,
  type ModuleKey,
  type ProjectVersion,
  type Roadmap,
  type Tier,
  type TierKey,
} from './client-dashboard-service'
import { EditorModule } from './EditorModule'

const MODULES: Array<{ key: ModuleKey; number: string; label: string; path: string }> = [
  { key: 'como_funciona', number: '01', label: 'Como funciona', path: 'como-funciona' },
  { key: 'prototipo', number: '02', label: 'Protótipo', path: 'prototipo' },
  { key: 'etapas', number: '03', label: 'Etapas do plano', path: 'etapas' },
  { key: 'editor', number: '04', label: 'Editor', path: 'editor' },
  { key: 'versoes', number: '05', label: 'Versões', path: 'versoes' },
  { key: 'marca', number: '06', label: 'Marca & arquivos', path: 'marca' },
]

const TIER_ORDER: Array<{ key: TierKey; label: string; color: string }> = [
  { key: 'essencial', label: 'Essencial', color: 'border-azul' },
  { key: 'basico', label: 'Básico', color: 'border-ambar' },
  { key: 'completo', label: 'Completo', color: 'border-verde' },
]

const KANBAN_COLUMNS: Array<{ key: KanbanStatus; label: string; color: string }> = [
  { key: 'a_fazer', label: 'A fazer', color: 'bg-azul' },
  { key: 'em_andamento', label: 'Em andamento', color: 'bg-ambar' },
  { key: 'concluido', label: 'Concluído', color: 'bg-verde' },
]

type ClientDashboardPageProps = {
  module: ModuleKey
}

function toDisplayItems(value: JsonValue): string[] {
  if (Array.isArray(value)) {
    return value.map((item) =>
      typeof item === 'object' && item !== null ? JSON.stringify(item) : String(item),
    )
  }

  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).map(([key, item]) => `${key}: ${String(item)}`)
  }

  return value === null || value === '' ? [] : [String(value)]
}

function DataList({ title, value }: { title: string; value: JsonValue }) {
  const items = toDisplayItems(value)

  return (
    <section className="rounded-2xl border border-borda bg-white p-5">
      <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-cinza">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-cinza">Nenhum item publicado.</p>
      ) : (
        <ul className="mt-4 space-y-2 text-sm leading-6">
          {items.map((item, index) => (
            <li className="flex gap-2" key={`${item}-${index}`}>
              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-azul" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TierField({ label, value }: { label: string; value: JsonValue }) {
  const items = toDisplayItems(value)
  return (
    <div>
      <dt className="font-mono text-[0.625rem] uppercase tracking-[0.12em] text-cinza">{label}</dt>
      <dd className="mt-1 text-sm leading-6">{items.length > 0 ? items.join(' · ') : '—'}</dd>
    </div>
  )
}

function TierCard({
  tier,
  tierKey,
  label,
  color,
  selected,
  saving,
  onSelect,
}: {
  tier: Tier
  tierKey: TierKey
  label: string
  color: string
  selected: boolean
  saving: boolean
  onSelect: (tier: TierKey) => void
}) {
  return (
    <article
      className={`flex h-full flex-col rounded-2xl border-t-4 bg-white p-5 shadow-card ${color} ${
        selected ? 'ring-2 ring-azul ring-offset-2' : 'border-x border-b border-x-borda border-b-borda'
      }`}
      data-tier={tierKey}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-xl font-extrabold uppercase tracking-[-0.03em]">{label}</h3>
        {selected ? (
          <span className="rounded-full bg-azul-tint px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.1em] text-azul">
            Preferido
          </span>
        ) : null}
      </div>
      <dl className="mt-5 flex-1 space-y-4">
        <TierField label="Escopo" value={tier.escopo} />
        <TierField label="Profundidade" value={tier.profundidade} />
        <TierField label="Exclusões" value={tier.exclusoes} />
        <TierField label="Complexidade" value={tier.complexidade} />
        <TierField label="Prazo" value={`${tier.prazo_dias} dias`} />
        {tier.valor_centavos != null ? (
          <TierField
            label="Valor"
            value={new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
            }).format(tier.valor_centavos / 100)}
          />
        ) : null}
        {tier.faixa != null ? <TierField label="Faixa" value={tier.faixa} /> : null}
      </dl>
      <button
        type="button"
        onClick={() => onSelect(tierKey)}
        disabled={saving || selected}
        className="mt-6 w-full rounded-xl bg-tinta px-4 py-3 text-sm font-semibold text-white transition hover:bg-azul disabled:cursor-default disabled:bg-cinza focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        {saving ? 'Salvando…' : selected ? 'Tier preferido' : `Escolher ${label}`}
      </button>
    </article>
  )
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-borda bg-white p-8 text-center text-cinza">
      <span aria-hidden="true" className="mx-auto mb-4 block h-3 w-3 rounded-full bg-ambar" />
      {children}
    </div>
  )
}

function LockedState({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-borda bg-white p-7 shadow-card sm:p-10">
      <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-vermelho">Bloqueado</span>
      <h2 className="mt-4 text-3xl font-extrabold uppercase tracking-[-0.04em]">{title}</h2>
      <div className="mt-4 max-w-2xl space-y-3 font-light leading-7 text-cinza">{children}</div>
    </section>
  )
}

function OverviewModule({
  roadmap,
  selectedTier,
  savingTier,
  saveError,
  onSelectTier,
}: {
  roadmap: Roadmap | null
  selectedTier: TierKey | null
  savingTier: TierKey | null
  saveError: boolean
  onSelectTier: (tier: TierKey) => void
}) {
  if (!roadmap?.published_at) {
    return <EmptyState>Seu plano ainda está sendo preparado. Assim que for publicado, ele aparece aqui.</EmptyState>
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2">
        <DataList title="Stack" value={roadmap.stack} />
        <DataList title="Custos" value={roadmap.costs} />
        <DataList title="Próximos passos" value={roadmap.next_steps} />
        <DataList title="Referências" value={roadmap.references} />
      </div>

      <section>
        <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-azul">Caminhos de execução</p>
        <h2 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">
          Agora existem três formas de tirar esse plano do papel.
        </h2>
        <p className="mt-4 max-w-3xl font-light leading-7 text-cinza">
          A base é a mesma. O que muda é a profundidade da execução, o número de etapas e o nível de produto que faz sentido construir agora.
        </p>
        {saveError ? (
          <p role="alert" className="mt-4 rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-4 py-3 text-sm">
            Não foi possível salvar sua escolha. Tente novamente.
          </p>
        ) : null}
        <div className="mt-7 grid gap-5 lg:grid-cols-3" aria-label="Opções de execução">
          {TIER_ORDER.map(({ key, label, color }) => {
            const tier = roadmap.tiers[key]
            return tier ? (
              <TierCard
                key={key}
                tier={tier}
                tierKey={key}
                label={label}
                color={color}
                selected={selectedTier === key}
                saving={savingTier !== null}
                onSelect={onSelectTier}
              />
            ) : null
          })}
        </div>
      </section>
    </div>
  )
}

function PrototypeModule({ roadmap }: { roadmap: Roadmap | null }) {
  if (!roadmap?.published_at || !roadmap.prototype_url) {
    return <EmptyState>O protótipo ainda não foi publicado para este projeto.</EmptyState>
  }

  return (
    <section className="mx-auto max-w-xl text-center">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-azul">Protótipo navegável</p>
      <h2 className="mt-3 text-3xl font-extrabold uppercase tracking-[-0.04em]">Teste a primeira direção.</h2>
      <div className="mx-auto mt-8 w-full max-w-[390px] rounded-[3rem] bg-tinta p-3 shadow-[0_24px_70px_rgba(20,20,20,0.24)]">
        <div className="mx-auto mb-2 h-5 w-24 rounded-full bg-black" aria-hidden="true" />
        <div className="overflow-hidden rounded-[2.25rem] bg-white">
          <iframe
            className="h-[680px] w-full border-0"
            src={roadmap.prototype_url}
            title="Protótipo navegável do projeto"
          />
        </div>
      </div>
      <a
        href={roadmap.prototype_url}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-6 inline-flex rounded-xl border border-borda bg-white px-5 py-3 text-sm font-semibold text-azul transition hover:border-azul focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul"
      >
        Abrir protótipo em nova aba ↗
      </a>
    </section>
  )
}

function KanbanCard({ item }: { item: KanbanItem }) {
  return (
    <article className="rounded-xl border border-borda bg-white p-4 shadow-sm">
      <h3 className="font-semibold leading-6">{item.title}</h3>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
        <div><dt className="text-cinza">Fase</dt><dd className="mt-1 font-medium">{item.phase ?? '—'}</dd></div>
        <div><dt className="text-cinza">Macroversão</dt><dd className="mt-1 font-medium">{item.macro_version ?? '—'}</dd></div>
        <div className="col-span-2"><dt className="text-cinza">Data planejada</dt><dd className="mt-1 font-medium">{item.scheduled_date ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(`${item.scheduled_date}T00:00:00Z`)) : '—'}</dd></div>
      </dl>
    </article>
  )
}

function StagesModule({ items }: { items: KanbanItem[] }) {
  if (items.length === 0) {
    return <EmptyState>As etapas entram aqui assim que o plano de execução for organizado.</EmptyState>
  }

  const progress = calculateProgress(items)
  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-azul">Progresso do projeto</p>
          <h2 className="mt-2 text-4xl font-extrabold tracking-[-0.04em]">{progress}% concluído</h2>
        </div>
        <p className="text-sm text-cinza">Acompanhamento somente leitura</p>
      </div>
      <div className="mt-7 grid gap-5 xl:grid-cols-3">
        {KANBAN_COLUMNS.map((column) => {
          const columnItems = items.filter((item) => item.status === column.key)
          return (
            <section className="rounded-2xl bg-[#F3F3EF] p-4" key={column.key}>
              <header className="flex items-center justify-between gap-3">
                <h3 className="font-bold">{column.label}</h3>
                <span className={`min-w-7 rounded-full px-2 py-1 text-center font-mono text-xs text-white ${column.color}`}>
                  {columnItems.length}
                </span>
              </header>
              <div className="mt-4 space-y-3">
                {columnItems.length === 0 ? <p className="py-5 text-center text-sm text-cinza">Nenhum item.</p> : null}
                {columnItems.map((item) => <KanbanCard key={item.id} item={item} />)}
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function VersionsModule({ versions }: { versions: ProjectVersion[] }) {
  if (versions.length === 0) {
    return <EmptyState>A primeira versão ainda está sendo preparada.</EmptyState>
  }

  return (
    <section>
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-azul">Histórico de entregas</p>
      <h2 className="mt-2 text-4xl font-extrabold tracking-[-0.04em]">Versões do projeto</h2>
      <ol className="mt-7 space-y-4">
        {versions.map((version) => (
          <li className="rounded-2xl border border-borda bg-white p-5 shadow-card" key={version.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><h3 className="text-xl font-bold">{version.label}</h3><p className="mt-1 text-sm text-cinza">{version.status} · {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeZone: 'America/Sao_Paulo' }).format(new Date(version.published_at))}</p></div>
              {version.is_current ? <span className="rounded-full bg-verde px-3 py-1 font-mono text-[0.625rem] font-semibold uppercase tracking-[0.1em] text-white">Atual</span> : null}
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{version.changelog}</p>
            <p className="mt-3 font-mono text-xs text-cinza">Build: {version.build_reference}</p>
            {version.editor_checklists.map((checklist) => <div className="mt-4 rounded-xl bg-osso p-4" key={checklist.id}>
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.1em] text-azul">Ajustes do Editor incorporados</p>
              <p className="mt-1 text-xs text-cinza">Solicitados sobre {checklist.baseVersionLabel}</p>
              <ul className="mt-3 space-y-2">{checklist.items.map((group) => <li className="text-sm" key={`${group.screen}:${group.component}`}><span className="font-semibold">{group.screen} / {group.component}</span><span className="text-cinza"> · {group.changes.length} ajuste(s)</span>{group.changes.map((change, index) => <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2" key={index}><pre className="overflow-auto rounded bg-white p-2">Antes: {JSON.stringify(change.before, null, 2)}</pre><pre className="overflow-auto rounded bg-white p-2">Depois: {JSON.stringify(change.after, null, 2)}</pre></div>)}</li>)}</ul>
            </div>)}
          </li>
        ))}
      </ol>
    </section>
  )
}

function DashboardModule({
  module,
  data,
  selectedTier,
  savingTier,
  saveError,
  onSelectTier,
}: {
  module: ModuleKey
  data: DashboardData
  selectedTier: TierKey | null
  savingTier: TierKey | null
  saveError: boolean
  onSelectTier: (tier: TierKey) => void
}) {
  if (module === 'editor' && data.shell?.modules.editor !== 'ativo') {
    return <LockedState title="Editor"><p>O Editor é liberado quando a primeira versão do seu projeto fica pronta.</p><p>Você poderá testar textos, cores, logos e ajustes visuais antes de nos enviar suas preferências para a próxima versão.</p></LockedState>
  }
  if (module === 'versoes' && data.shell?.modules.versoes !== 'ativo') {
    return <LockedState title="Versões"><p>Suas versões aparecem aqui quando a construção começar.</p><p>Cada entrega fica registrada para você acompanhar a evolução do produto até o go-live.</p></LockedState>
  }
  if (module === 'como_funciona') {
    return <OverviewModule roadmap={data.roadmap} selectedTier={selectedTier} savingTier={savingTier} saveError={saveError} onSelectTier={onSelectTier} />
  }
  if (module === 'prototipo') {
    return <PrototypeModule roadmap={data.roadmap} />
  }
  if (module === 'etapas') {
    return <StagesModule items={data.kanban} />
  }
  if (module === 'editor') {
    return <EditorModule projectId={data.shell?.project_id ?? ''} />
  }
  if (module === 'versoes') {
    return <VersionsModule versions={data.versions ?? []} />
  }

  return (
    <LockedState title="Marca & arquivos">
      <p>Este espaço será liberado quando os arquivos e definições de marca entrarem na construção.</p>
      <p className="font-mono text-xs uppercase tracking-[0.1em]">Texto provisório · revisar copy</p>
    </LockedState>
  )
}

function ProjectNavigation({ projectId, currentModule }: { projectId: string; currentModule: ModuleKey }) {
  return (
    <nav aria-label="Módulos do projeto" className="lg:w-64 lg:shrink-0">
      <div className="flex gap-2 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
        {MODULES.map((item) => (
          <NavLink
            key={item.key}
            to={`/p/${encodeURIComponent(projectId)}/${item.path}`}
            aria-current={currentModule === item.key ? 'page' : undefined}
            className={({ isActive }) => `group flex min-w-max items-center gap-3 rounded-xl px-4 py-3 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul ${isActive ? 'bg-tinta text-white shadow-card' : 'bg-white text-tinta hover:bg-azul-tint'}`}
          >
            <span className="font-mono text-[0.625rem] tracking-[0.1em] text-cinza group-aria-[current=page]:text-ambar">{item.number}</span>
            <span className="font-semibold">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export function ClientDashboardPage({ module }: ClientDashboardPageProps) {
  const { projectId = '' } = useParams()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)
  const [loadErrorProjectId, setLoadErrorProjectId] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedTier, setSelectedTier] = useState<TierKey | null>(null)
  const [savingTier, setSavingTier] = useState<TierKey | null>(null)
  const [saveError, setSaveError] = useState(false)

  useEffect(() => {
    let active = true

    void loadClientDashboard(projectId)
      .then((nextData) => {
        if (!active) return
        setData(nextData)
        setLoadedProjectId(projectId)
        setLoadErrorProjectId(null)
        setSelectedTier(nextData.roadmap?.preferred_tier ?? null)
      })
      .catch(() => {
        if (!active) return
        setLoadErrorProjectId(projectId)
      })

    return () => {
      active = false
    }
  }, [projectId, reloadKey])

  async function selectTier(tier: TierKey) {
    if (tier === selectedTier || savingTier !== null) return
    setSavingTier(tier)
    setSaveError(false)
    try {
      const result = await savePreferredTier(projectId, tier)
      setSelectedTier(result.preferred_tier)
    } catch {
      setSaveError(true)
    } finally {
      setSavingTier(null)
    }
  }

  if (loadErrorProjectId === projectId) {
    return (
      <main className="grid min-h-screen place-items-center bg-osso px-6 text-tinta">
        <div className="max-w-md rounded-2xl border border-borda bg-white p-8 text-center shadow-card">
          <h1 className="text-2xl font-extrabold">Não foi possível carregar o projeto.</h1>
          <p className="mt-3 text-sm leading-6 text-cinza">Confira sua conexão e tente novamente.</p>
          <button type="button" onClick={() => { setLoadErrorProjectId(null); setData(null); setLoadedProjectId(null); setReloadKey((value) => value + 1) }} className="mt-6 rounded-xl bg-tinta px-5 py-3 text-sm font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-azul">
            Tentar de novo
          </button>
        </div>
      </main>
    )
  }

  if (!data || loadedProjectId !== projectId) {
    return <main className="grid min-h-screen place-items-center bg-osso text-cinza" role="status">Carregando dados…</main>
  }

  if (!data.shell) {
    return (
      <main className="grid min-h-screen place-items-center bg-osso px-6 text-center">
        <div><h1 className="text-3xl font-extrabold">Projeto não disponível.</h1><Link className="mt-5 inline-block text-azul underline" to="/p/projetos">Voltar aos projetos</Link></div>
      </main>
    )
  }

  if (data.shell.effective_access_status === 'EXPIRADO') {
    return (
      <main className="grid min-h-screen place-items-center bg-osso px-6 text-tinta">
        <section className="max-w-xl rounded-3xl border border-borda bg-white p-8 text-center shadow-card sm:p-12">
          <span className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-vermelho">Acesso expirado</span>
          <h1 className="mt-4 text-4xl font-extrabold tracking-[-0.04em]">Sua janela de análise terminou.</h1>
          <p className="mt-5 font-light leading-7 text-cinza">Fale com a Nó para retomar o projeto e manter o dashboard disponível durante a construção.</p>
          <p className="mt-5 font-mono text-xs uppercase tracking-[0.1em] text-cinza">Texto provisório · revisar copy</p>
        </section>
      </main>
    )
  }

  const showTrialNotice = data.shell.effective_access_status === 'INICIAL_15_DIAS'

  return (
    <main className="min-h-screen bg-osso text-tinta">
      <img className="h-1.5 w-full object-cover" src="/barra-topo-4-cores.svg" alt="" />
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 lg:px-12 lg:py-9">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-borda pb-6">
          <img className="h-auto w-40 sm:w-52" src="/no-tech-stack-tinta-ponto-ambar.svg" alt="nó tech stack" />
          <div className="text-right"><p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-cinza">Projeto</p><p className="mt-1 text-sm font-semibold">{data.shell.project_name}</p></div>
        </header>

        <section className="py-8 lg:py-11">
          <p className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-azul">Sua primeira entrega</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-[-0.05em] sm:text-5xl">Seu primeiro plano está pronto.</h1>
          <p className="mt-4 max-w-3xl font-light leading-7 text-cinza">Aqui você encontra a direção do produto, o protótipo inicial e as etapas que transformarão a ideia em sistema.</p>
          {showTrialNotice ? (
            <aside className="mt-6 max-w-3xl rounded-2xl border-l-4 border-ambar bg-white px-5 py-4 shadow-sm">
              <p className="font-semibold">Seu acesso de análise fica disponível por 15 dias.</p>
              <p className="mt-1 text-sm leading-6 text-cinza">Se você decidir seguir com a Nó, o acesso deixa de expirar e acompanha o projeto até a entrega.</p>
            </aside>
          ) : null}
        </section>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-9">
          <ProjectNavigation projectId={projectId} currentModule={module} />
          <div className="min-w-0 flex-1 pb-16">
            <DashboardModule module={module} data={data} selectedTier={selectedTier} savingTier={savingTier} saveError={saveError} onSelectTier={selectTier} />
          </div>
        </div>
      </div>
    </main>
  )
}

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listAdminSaldos, markInstallmentReceived, type FinancialMovement, type SaldosSnapshot } from '../saldos-service'

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-osso text-tinta"><img className="h-1.5 w-full object-cover" src="/barra-topo-4-cores.svg" alt="" /><div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-8 lg:px-12 lg:py-9"><header className="flex flex-wrap items-end justify-between gap-4 border-b border-borda pb-6"><Link to="/no/projetos"><img className="h-auto w-40 sm:w-52" src="/no-tech-stack-tinta-ponto-ambar.svg" alt="nó tech stack" /></Link><div className="text-right"><p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-cinza">Operação Nó</p><h1 className="mt-1 text-2xl font-extrabold tracking-[-0.04em]">Saldos</h1></div></header>{children}</div></main>
}

function money(cents: number) { return BRL.format(cents / 100) }

function MovementRow({ movement, onReceived }: { movement: FinancialMovement; onReceived: (movement: FinancialMovement) => void }) {
  const date = movement.date ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(movement.date)) : 'Sem data'
  const canReceive = movement.source === 'installment' && movement.installmentId && movement.status !== 'recebida'
  return <li className="grid gap-3 border-b border-borda py-4 last:border-b-0 sm:grid-cols-[1fr_auto] sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{movement.projectId ? <Link className="text-azul underline" to={`/no/projetos/${movement.projectId}`}>{movement.projectName ?? 'Projeto'}</Link> : 'Sem projeto'}</span><span className="rounded-full bg-azul-tint px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.08em]">{movement.type}</span></div><p className="mt-1 text-xs text-cinza">{date} · status {movement.status}</p></div><div className="flex flex-wrap items-center gap-3 sm:justify-end"><strong className={movement.amountCents < 0 ? 'text-vermelho' : ''}>{money(movement.amountCents)}</strong>{canReceive ? <button type="button" className="rounded-xl border border-borda bg-white px-3 py-2 text-xs font-semibold hover:border-azul" onClick={() => onReceived(movement)}>Marcar recebida</button> : null}</div></li>
}

function Block({ title, total, movements, onReceived }: { title: string; total: number; movements: FinancialMovement[]; onReceived: (movement: FinancialMovement) => void }) {
  return <section className="rounded-2xl border border-borda bg-white p-5"><div className="flex flex-wrap items-baseline justify-between gap-3"><h2 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-azul">{title}</h2><strong className="text-xl">{money(total)}</strong></div>{movements.length === 0 ? <p className="py-8 text-center text-sm text-cinza">Nenhum movimento nesta faixa.</p> : <ul className="mt-3">{movements.map((movement) => <MovementRow key={`${movement.id}:${movement.status}`} movement={movement} onReceived={onReceived} />)}</ul>}</section>
}

export function SaldosPage() {
  const [snapshot, setSnapshot] = useState<SaldosSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [pendingReceipt, setPendingReceipt] = useState<FinancialMovement | null>(null)
  const [message, setMessage] = useState('')
  const reload = () => { setLoading(true); setError(false); void listAdminSaldos().then(setSnapshot).catch(() => setError(true)).finally(() => setLoading(false)) }
  useEffect(() => {
    let active = true
    void listAdminSaldos()
      .then((value) => { if (active) setSnapshot(value) })
      .catch(() => { if (active) setError(true) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  async function confirmReceipt() {
    if (!pendingReceipt?.installmentId) return
    try { await markInstallmentReceived(pendingReceipt.installmentId); setPendingReceipt(null); setMessage('Parcela marcada como recebida.'); reload() } catch { setMessage('Não foi possível marcar a parcela como recebida.') }
  }
  return <Shell><section className="py-8 lg:py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="font-mono text-xs uppercase tracking-[0.14em] text-azul">Centro financeiro</p><h2 className="mt-2 text-4xl font-extrabold tracking-[-0.05em]">Quanto entrou e quanto falta.</h2><p className="mt-3 max-w-2xl text-cinza">Realizado, pendente e previsto por projeto. As projeções usam o dia civil de São Paulo.</p></div><Link to="/no/projetos" className="rounded-xl border border-borda bg-white px-4 py-2.5 text-sm font-semibold hover:border-azul">Voltar aos projetos</Link></div>{loading ? <div className="py-16 text-center text-cinza" role="status">Carregando saldos…</div> : error ? <div className="mt-7 rounded-2xl border border-vermelho bg-vermelho-tint p-8 text-center"><h2 className="text-xl font-bold">Não foi possível carregar os saldos.</h2><button type="button" className="mt-5 rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white" onClick={reload}>Tentar de novo</button></div> : snapshot && snapshot.realized.length + snapshot.pending.length + snapshot.projected.length === 0 ? <div className="mt-8 rounded-2xl border border-dashed border-borda bg-white p-12 text-center text-cinza"><span className="mx-auto mb-4 block h-3 w-3 rounded-full bg-ambar" /><p>Nenhum movimento financeiro ainda.</p></div> : snapshot ? <><div className="mt-8 grid gap-5 xl:grid-cols-3"><Block title="Realizado" total={snapshot.realizedCents} movements={snapshot.realized} onReceived={setPendingReceipt} /><Block title="Pendente" total={snapshot.pendingCents} movements={snapshot.pending} onReceived={setPendingReceipt} /><Block title="Previsto" total={snapshot.projectedCents} movements={snapshot.projected} onReceived={setPendingReceipt} /></div><section className="mt-5 rounded-2xl border border-borda bg-white p-5"><h2 className="font-mono text-xs font-semibold uppercase tracking-[0.14em] text-azul">Projeção por janela</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">{(['15', '30', '45'] as const).map((days) => <div className="rounded-xl bg-osso p-4" key={days}><p className="text-xs text-cinza">Até {days} dias</p><strong className="mt-1 block text-xl">{money(snapshot.projections[days])}</strong></div>)}</div></section></> : null}{message ? <p className="mt-4 rounded-xl border border-ambar bg-ambar-tint px-4 py-3 text-sm" role="status">{message}</p> : null}{pendingReceipt ? <div className="fixed inset-x-4 bottom-4 z-10 mx-auto max-w-xl rounded-2xl border-2 border-ambar bg-white p-5 shadow-lg" role="dialog" aria-modal="true" aria-labelledby="confirm-receipt-title"><h2 id="confirm-receipt-title" className="font-bold">Confirmar recebimento?</h2><p className="mt-2 text-sm text-cinza">{pendingReceipt.projectName ?? 'Esta parcela'} · {money(pendingReceipt.amountCents)}. Ela sairá de Previsto e entrará em Realizado.</p><div className="mt-4 flex gap-2"><button type="button" className="rounded-xl bg-tinta px-4 py-2 text-sm font-semibold text-white" onClick={() => void confirmReceipt()}>Confirmar recebimento</button><button type="button" className="rounded-xl border border-borda px-4 py-2 text-sm font-semibold" onClick={() => setPendingReceipt(null)}>Cancelar</button></div></div> : null}</section></Shell>
}

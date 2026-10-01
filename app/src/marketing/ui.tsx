import type { ReactNode } from 'react'
import type { Bloco, ResultadoAcao } from './marketing-service'
import { ErroHub } from './marketing-service'
import type { FluxoRevisao } from './useRevisao'

// Contrato de tela para agente (R7): rótulos em texto, números em tabela,
// revisão explícita antes de escrever e resultado com o id criado.

export const botaoPrimario = 'inline-flex items-center justify-center rounded-xl bg-tinta px-5 py-3 text-sm font-semibold text-white transition hover:bg-tinta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar disabled:cursor-wait disabled:opacity-60'
export const botaoSecundario = 'inline-flex items-center justify-center rounded-xl border border-borda bg-white px-4 py-2.5 text-sm font-semibold transition hover:border-azul focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar disabled:opacity-60'
export const campo = 'w-full rounded-xl border border-borda bg-white px-3 py-2.5 text-sm outline-none transition focus:border-azul focus:ring-2 focus:ring-azul/15'
export const tabela = 'w-full border-collapse text-left text-sm'
export const th = 'border-b border-borda px-3 py-2 font-mono text-[0.625rem] font-medium uppercase tracking-[0.12em] text-cinza'
export const td = 'border-b border-borda px-3 py-2 align-top'
export const tdNum = `${td} text-right tabular-nums`

export function Secao({ titulo, rotulo, acento = 'bg-azul', acoes, children }: {
  titulo: string
  rotulo?: string
  acento?: string
  acoes?: ReactNode
  children: ReactNode
}) {
  return (
    <section aria-label={titulo} className="relative overflow-hidden rounded-2xl border border-borda bg-white p-4 shadow-card sm:p-6">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${acento}`} />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          {rotulo ? <p className="font-mono text-[0.625rem] uppercase tracking-[0.16em] text-cinza">{rotulo}</p> : null}
          <h2 className="mt-1 text-xl font-bold tracking-[-0.02em]">{titulo}</h2>
        </div>
        {acoes}
      </header>
      {children}
    </section>
  )
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return <p role="status" className="rounded-xl bg-osso px-4 py-3 text-sm text-cinza">{texto}</p>
}

export function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-xl border border-dashed border-borda px-4 py-3 text-sm text-cinza">{texto}</p>
}

export function Erro({ erro, onTentar }: { erro: unknown; onTentar?: () => void }) {
  const mensagem = erro instanceof ErroHub ? erro.message : 'Não foi possível carregar. Tente de novo.'
  const campos = erro instanceof ErroHub ? erro.campos : []
  return (
    <div role="alert" className="rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-4 py-3 text-sm">
      <p>{mensagem}</p>
      {campos.length ? <p className="mt-1 font-mono text-xs">Campos com problema: {campos.join(', ')}</p> : null}
      {onTentar ? <button type="button" onClick={onTentar} className="mt-2 text-sm font-semibold underline">Tentar de novo</button> : null}
    </div>
  )
}

export function BlocoIndisponivel({ bloco, nome }: { bloco: Bloco<unknown>; nome: string }) {
  if (bloco.ok) return null
  return (
    <p role="note" className="rounded-xl border border-dashed border-borda bg-osso px-4 py-3 text-sm text-cinza">
      <strong className="font-semibold text-tinta">{nome} indisponível</strong>
      {' — '}
      {bloco.motivo === 'nao_configurado' ? 'integração ainda não configurada.' : null}
      {bloco.motivo === 'sem_permissao' ? `sem permissão: ${bloco.mensagem}` : null}
      {bloco.motivo === 'falha' ? bloco.mensagem : null}
    </p>
  )
}

export function Rotulo({ texto, children }: { texto: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold">{texto}</span>
      {children}
    </label>
  )
}

export type ItemRevisao = [rotulo: string, valor: string]

// A tela de revisão É a confirmação expressa (R5): nada é executado sem este clique.
export function Revisao({ titulo, itens, aviso, executando, erro, onConfirmar, onVoltar }: {
  titulo: string
  itens: ItemRevisao[]
  aviso?: string
  executando: boolean
  erro?: unknown
  onConfirmar: () => void
  onVoltar: () => void
}) {
  return (
    <Secao titulo={titulo} rotulo="Revisão antes de executar" acento="bg-ambar">
      <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,14rem)_1fr]">
        {itens.map(([rotulo, valor]) => (
          <div key={rotulo} className="contents">
            <dt className="font-semibold text-cinza">{rotulo}</dt>
            <dd className="whitespace-pre-wrap break-words">{valor || '—'}</dd>
          </div>
        ))}
      </dl>
      {aviso ? <p className="mt-4 rounded-xl bg-ambar/10 px-4 py-3 text-sm">{aviso}</p> : null}
      {erro ? <div className="mt-4"><Erro erro={erro} /></div> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className={botaoPrimario} disabled={executando} onClick={onConfirmar}>
          {executando ? 'Executando…' : 'Confirmar e executar'}
        </button>
        <button type="button" className={botaoSecundario} disabled={executando} onClick={onVoltar}>
          Voltar e editar
        </button>
      </div>
    </Secao>
  )
}

export function Resultado({ resultado, titulo, link, children }: {
  resultado: ResultadoAcao
  titulo: string
  link?: { href: string; texto: string } | null
  children?: ReactNode
}) {
  const ids = resultado.ids_externos ?? {}
  return (
    <Secao titulo={titulo} rotulo="Resultado" acento={resultado.status === 'ok' ? 'bg-verde' : 'bg-vermelho'}>
      <p role="status" className="text-sm">
        {resultado.status === 'ok' ? 'Ação concluída.' : `A plataforma recusou: ${resultado.erro ?? 'erro sem detalhe'}`}
        {resultado.idempotente ? ' (Esta ação já tinha sido executada; nada foi repetido.)' : ''}
      </p>
      <table className={`${tabela} mt-3 min-w-0`}>
        <caption className="sr-only">Identificadores da ação</caption>
        <tbody>
          <tr><th scope="row" className={th}>Registro</th><td className={`${td} font-mono text-xs`}>{resultado.acao_id}</td></tr>
          {Object.entries(ids).map(([k, v]) => (
            <tr key={k}><th scope="row" className={th}>{k}</th><td className={`${td} font-mono text-xs`}>{v}</td></tr>
          ))}
        </tbody>
      </table>
      {link ? (
        <p className="mt-3 text-sm"><a className="font-semibold text-azul underline" href={link.href} target="_blank" rel="noreferrer">{link.texto}</a></p>
      ) : null}
      {children}
    </Secao>
  )
}

export function Selo({ texto, tom = 'neutro' }: { texto: string; tom?: 'neutro' | 'ok' | 'alerta' | 'erro' }) {
  const cores = {
    neutro: 'bg-osso text-tinta',
    ok: 'bg-verde/10 text-tinta',
    alerta: 'bg-ambar/15 text-tinta',
    erro: 'bg-vermelho-tint text-tinta',
  }[tom]
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[0.625rem] uppercase tracking-[0.08em] ${cores}`}>{texto}</span>
}

// Desenha a etapa atual do fluxo: revisão aberta ou resultado da última ação.
export function PainelRevisao({ fluxo }: { fluxo: FluxoRevisao }) {
  if (fluxo.pedido) {
    return (
      <Revisao
        titulo={fluxo.pedido.titulo}
        itens={fluxo.pedido.itens}
        aviso={fluxo.pedido.aviso}
        executando={fluxo.executando}
        erro={fluxo.erro}
        onConfirmar={() => void fluxo.confirmar()}
        onVoltar={fluxo.voltar}
      />
    )
  }
  if (fluxo.resultado) {
    return (
      <Resultado resultado={fluxo.resultado.acao} titulo={fluxo.resultado.titulo} link={fluxo.resultado.link}>
        <button type="button" className={`${botaoSecundario} mt-4`} onClick={fluxo.fecharResultado}>Fechar resultado</button>
      </Resultado>
    )
  }
  return null
}

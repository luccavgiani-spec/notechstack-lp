import { useCallback, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { SeletorPeriodo } from './MarketingLayout'
import { centavosDeReais, custoPor, dataHora, inteiro, isoParaLocal, localParaIso, numeroDecimal, reais, rotuloStatus, tomDoStatus } from './format'
import { type DetalheGoogle, type DetalheMeta, type Metricas, marketing } from './marketing-service'
import { Carregando, Erro, PainelRevisao, Secao, Selo, botaoSecundario, campo, tabela, td, tdNum, th } from './ui'
import { useDados } from './useDados'
import { type FluxoRevisao, useRevisao } from './useRevisao'

const AVISO_ATIVAR = 'Ativar libera veiculação e gasto real. O dot só confirma depois de o Lucca autorizar expressamente no chat.'

function TabelaMetricas({ m }: { m: Metricas }) {
  return (
    <div className="overflow-x-auto">
      <table className={tabela}>
        <caption className="sr-only">Métricas da campanha no período</caption>
        <thead><tr>
          <th className={`${th} text-right`}>Gasto</th><th className={`${th} text-right`}>Impressões</th><th className={`${th} text-right`}>Alcance</th>
          <th className={`${th} text-right`}>Cliques</th><th className={`${th} text-right`}>Leads / conv.</th><th className={`${th} text-right`}>Custo por lead</th>
        </tr></thead>
        <tbody><tr>
          <td className={tdNum}>{reais(m.gasto_centavos)}</td><td className={tdNum}>{inteiro(m.impressoes)}</td><td className={tdNum}>{inteiro(m.alcance)}</td>
          <td className={tdNum}>{inteiro(m.cliques)}</td><td className={tdNum}>{numeroDecimal(m.conversoes)}</td><td className={tdNum}>{custoPor(m.gasto_centavos, m.conversoes)}</td>
        </tr></tbody>
      </table>
    </div>
  )
}

function statusMeta(fluxo: FluxoRevisao, nivel: 'campaign' | 'adset' | 'ad', nomeNivel: string, id: string, nome: string, atual: string, recarregar: () => void) {
  const ativar = atual !== 'ACTIVE'
  fluxo.revisar({
    titulo: `${ativar ? 'Ativar' : 'Pausar'} ${nomeNivel} Meta`,
    itens: [
      ['Plataforma', 'Meta Ads'],
      [nomeNivel[0].toUpperCase() + nomeNivel.slice(1), `${nome} (id ${id})`],
      ['Status agora', rotuloStatus(atual)],
      ['Ação', ativar ? 'ATIVAR — passa a veicular e gastar' : 'PAUSAR — para de veicular'],
    ],
    aviso: ativar ? AVISO_ATIVAR : undefined,
    executar: (request_id) => marketing.statusMeta(nivel, id, { request_id, status: ativar ? 'ACTIVE' : 'PAUSED' }),
    aoConcluir: recarregar,
  })
}

function EdicaoConjunto({ conjunto, fluxo, recarregar }: {
  conjunto: DetalheMeta['conjuntos'][number]
  fluxo: FluxoRevisao
  recarregar: () => void
}) {
  const diario = conjunto.orcamento_diario_centavos !== null
  const atual = diario ? conjunto.orcamento_diario_centavos : conjunto.orcamento_total_centavos
  const [valor, setValor] = useState(atual !== null ? String(atual / 100).replace('.', ',') : '')
  const [fim, setFim] = useState(conjunto.fim ? isoParaLocal(conjunto.fim) : '')
  const [aberto, setAberto] = useState(false)

  function revisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const centavos = centavosDeReais(valor)
    const corpo: Record<string, unknown> = {}
    const itens: [string, string][] = [['Plataforma', 'Meta Ads'], ['Conjunto', `${conjunto.nome} (id ${conjunto.id})`]]
    if (centavos !== null && centavos !== atual) {
      corpo[diario ? 'orcamento_diario_centavos' : 'orcamento_total_centavos'] = centavos
      itens.push([diario ? 'Orçamento diário' : 'Orçamento total', `${reais(atual)} → ${reais(centavos)}`])
    }
    const fimIso = fim ? localParaIso(fim) : null
    if ((fimIso ?? null) !== (conjunto.fim ? new Date(conjunto.fim).toISOString() : null)) {
      corpo.fim = fimIso
      itens.push(['Término', `${dataHora(conjunto.fim)} → ${fimIso ? dataHora(fimIso) : 'sem término'}`])
    }
    if (!Object.keys(corpo).length) return
    fluxo.revisar({
      titulo: 'Editar conjunto Meta',
      itens,
      executar: (request_id) => marketing.editarMeta('adset', conjunto.id, { request_id, ...corpo }),
      aoConcluir: recarregar,
    })
    setAberto(false)
  }

  if (!aberto) return <button type="button" className="text-sm font-semibold text-azul underline" onClick={() => setAberto(true)}>Editar orçamento/datas</button>
  return (
    <form onSubmit={revisar} className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-xs"><span className="mb-1 block font-semibold">{diario ? 'Orçamento diário (R$)' : 'Orçamento total (R$)'}</span>
        <input className={campo} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
      </label>
      <label className="text-xs"><span className="mb-1 block font-semibold">Término (horário de Brasília)</span>
        <input className={campo} type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} />
      </label>
      <button type="submit" className={`${botaoSecundario} self-end`}>Revisar alteração</button>
    </form>
  )
}

function MetaDetalhe({ d, fluxo, recarregar }: { d: DetalheMeta; fluxo: FluxoRevisao; recarregar: () => void }) {
  const c = d.campanha
  return (
    <div className="space-y-6">
      <Secao
        titulo={c.nome}
        rotulo={`Meta Ads · campanha ${c.id}`}
        acento="bg-azul"
        acoes={<button type="button" className={botaoSecundario} onClick={() => statusMeta(fluxo, 'campaign', 'campanha', c.id, c.nome, c.status, recarregar)}>
          {c.status === 'ACTIVE' ? 'Pausar campanha' : 'Ativar campanha'}
        </button>}
      >
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          Status: <Selo texto={rotuloStatus(c.status)} tom={tomDoStatus(c.status)} />
          {c.status_efetivo && c.status_efetivo !== c.status ? <Selo texto={`efetivo: ${rotuloStatus(c.status_efetivo)}`} tom={tomDoStatus(c.status_efetivo)} /> : null}
          <span className="text-cinza">Objetivo {c.objetivo ?? '—'} · início {dataHora(c.inicio)} · término {dataHora(c.fim)}</span>
        </p>
        <TabelaMetricas m={d.metricas} />
      </Secao>
      <Secao titulo="Conjuntos de anúncios" acento="bg-azul">
        <div className="overflow-x-auto">
          <table className={`${tabela} min-w-[720px]`}>
            <thead><tr><th className={th}>Conjunto</th><th className={th}>Status</th><th className={`${th} text-right`}>Orçamento</th><th className={th}>Início</th><th className={th}>Término</th><th className={th}>Ações</th></tr></thead>
            <tbody>
              {d.conjuntos.map((s) => (
                <tr key={s.id}>
                  <th scope="row" className={`${td} font-normal`}>{s.nome}<span className="block font-mono text-[0.625rem] text-cinza">id {s.id} · {s.otimizacao}</span></th>
                  <td className={td}><Selo texto={rotuloStatus(s.status_efetivo ?? s.status)} tom={tomDoStatus(s.status_efetivo ?? s.status)} /></td>
                  <td className={tdNum}>{s.orcamento_diario_centavos !== null ? `${reais(s.orcamento_diario_centavos)}/dia` : `${reais(s.orcamento_total_centavos)} total`}</td>
                  <td className={td}>{dataHora(s.inicio)}</td>
                  <td className={td}>{dataHora(s.fim)}</td>
                  <td className={`${td} space-y-1`}>
                    <EdicaoConjunto conjunto={s} fluxo={fluxo} recarregar={recarregar} />
                    <button type="button" className="block text-sm font-semibold text-azul underline" onClick={() => statusMeta(fluxo, 'adset', 'conjunto', s.id, s.nome, s.status, recarregar)}>
                      {s.status === 'ACTIVE' ? 'Pausar conjunto' : 'Ativar conjunto'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
      <Secao titulo="Anúncios" acento="bg-azul">
        <div className="overflow-x-auto">
          <table className={`${tabela} min-w-[640px]`}>
            <thead><tr><th className={th}>Anúncio</th><th className={th}>Status</th><th className={th}>Título</th><th className={th}>Texto</th><th className={th}>Ações</th></tr></thead>
            <tbody>
              {d.anuncios.map((a) => (
                <tr key={a.id}>
                  <th scope="row" className={`${td} font-normal`}>{a.nome}<span className="block font-mono text-[0.625rem] text-cinza">id {a.id}</span></th>
                  <td className={td}><Selo texto={rotuloStatus(a.status_efetivo ?? a.status)} tom={tomDoStatus(a.status_efetivo ?? a.status)} /></td>
                  <td className={td}>{a.titulo ?? '—'}</td>
                  <td className={`${td} max-w-xs whitespace-pre-wrap`}>{a.texto ?? '—'}</td>
                  <td className={td}>
                    <button type="button" className="text-sm font-semibold text-azul underline" onClick={() => statusMeta(fluxo, 'ad', 'anúncio', a.id, a.nome, a.status, recarregar)}>
                      {a.status === 'ACTIVE' ? 'Pausar anúncio' : 'Ativar anúncio'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Secao>
    </div>
  )
}

function GoogleDetalhe({ d, fluxo, recarregar }: { d: DetalheGoogle; fluxo: FluxoRevisao; recarregar: () => void }) {
  const c = d.campanha
  const [valor, setValor] = useState(c.orcamento_diario_centavos !== null ? String(c.orcamento_diario_centavos / 100).replace('.', ',') : '')

  function status() {
    const ativar = c.status !== 'ENABLED'
    fluxo.revisar({
      titulo: `${ativar ? 'Ativar' : 'Pausar'} campanha Google`,
      itens: [
        ['Plataforma', 'Google Ads'],
        ['Campanha', `${c.nome} (id ${c.id})`],
        ['Status agora', rotuloStatus(c.status)],
        ['Orçamento diário', reais(c.orcamento_diario_centavos)],
        ['Ação', ativar ? 'ATIVAR — passa a veicular e gastar' : 'PAUSAR — para de veicular'],
      ],
      aviso: ativar ? AVISO_ATIVAR : undefined,
      executar: (request_id) => marketing.statusGoogle(c.id, { request_id, status: ativar ? 'ENABLED' : 'PAUSED' }),
      aoConcluir: recarregar,
    })
  }

  function orcamento(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const centavos = centavosDeReais(valor)
    if (centavos === null || centavos === c.orcamento_diario_centavos) return
    fluxo.revisar({
      titulo: 'Alterar orçamento Google',
      itens: [['Plataforma', 'Google Ads'], ['Campanha', `${c.nome} (id ${c.id})`], ['Orçamento diário', `${reais(c.orcamento_diario_centavos)} → ${reais(centavos)}`]],
      executar: (request_id) => marketing.orcamentoGoogle(c.id, { request_id, orcamento_diario_centavos: centavos }),
      aoConcluir: recarregar,
    })
  }

  return (
    <div className="space-y-6">
      <Secao titulo={c.nome} rotulo={`Google Ads · campanha ${c.id}`} acento="bg-verde"
        acoes={<button type="button" className={botaoSecundario} onClick={status}>{c.status === 'ENABLED' ? 'Pausar campanha' : 'Ativar campanha'}</button>}>
        <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          Status: <Selo texto={rotuloStatus(c.status)} tom={tomDoStatus(c.status)} />
          <span className="text-cinza">{c.tipo} · lances {c.lances ?? '—'} · locais {d.locais.join(', ') || '—'} · idiomas {d.idiomas.join(', ') || '—'}</span>
        </p>
        <TabelaMetricas m={d.metricas} />
        <form onSubmit={orcamento} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="text-xs"><span className="mb-1 block font-semibold">Orçamento diário (R$)</span>
            <input className={campo} inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
          </label>
          <button type="submit" className={botaoSecundario}>Revisar orçamento</button>
        </form>
      </Secao>
      <Secao titulo="Grupos, palavras-chave e anúncios" acento="bg-verde">
        {d.grupos.map((g) => (
          <div key={g.id} className="mb-6">
            <h3 className="font-semibold">{g.nome} <span className="font-mono text-xs text-cinza">id {g.id} · {rotuloStatus(g.status)}{g.cpc_centavos !== null ? ` · CPC ${reais(g.cpc_centavos)}` : ''}</span></h3>
            <div className="mt-2 overflow-x-auto">
              <table className={tabela}>
                <caption className="sr-only">Palavras-chave do grupo {g.nome}</caption>
                <thead><tr><th className={th}>Palavra-chave</th><th className={th}>Correspondência</th><th className={th}>Status</th></tr></thead>
                <tbody>{d.palavras_chave.filter((k) => k.grupo_id === g.id).map((k) => (
                  <tr key={`${k.texto}-${k.correspondencia}`}><td className={td}>{k.texto}</td><td className={`${td} font-mono text-xs`}>{k.correspondencia}</td><td className={td}>{rotuloStatus(k.status)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            {d.anuncios.filter((a) => a.grupo_id === g.id).map((a) => (
              <div key={a.id} className="mt-3 rounded-xl border border-borda p-3 text-sm">
                <p className="font-mono text-xs text-cinza">anúncio {a.id} · {rotuloStatus(a.status)} · {a.url_final}</p>
                <p className="mt-1"><strong>Títulos:</strong> {a.titulos.join(' | ')}</p>
                <p className="mt-1"><strong>Descrições:</strong> {a.descricoes.join(' | ')}</p>
              </div>
            ))}
          </div>
        ))}
      </Secao>
    </div>
  )
}

export function CampaignDetailPage() {
  const { plataforma, campaignId = '' } = useParams()
  const [params] = useSearchParams()
  const periodo = params.get('periodo') ?? '7d'
  const carregar = useCallback(
    () => (plataforma === 'google' ? marketing.campanhaGoogle(campaignId, periodo) : marketing.campanhaMeta(campaignId, periodo)),
    [plataforma, campaignId, periodo],
  )
  const { dados, erro, carregando, recarregar } = useDados<DetalheMeta | DetalheGoogle>(carregar)
  const fluxo = useRevisao()

  return (
    <div>
      <p className="text-sm"><Link className="text-azul underline" to={`/no/marketing/campanhas?periodo=${encodeURIComponent(periodo)}`}>← Campanhas</Link></p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.04em]">Campanha {plataforma === 'google' ? 'Google' : 'Meta'}</h1>
      <div className="mt-4"><SeletorPeriodo /></div>
      <div className="mb-6"><PainelRevisao fluxo={fluxo} /></div>
      {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
      {!dados && carregando ? <Carregando texto="Buscando a campanha…" /> : null}
      {dados ? (
        <div className={carregando ? 'opacity-60' : ''} aria-busy={carregando}>
          {dados.plataforma === 'meta'
            ? <MetaDetalhe d={dados} fluxo={fluxo} recarregar={recarregar} />
            : <GoogleDetalhe key={dados.campanha.id} d={dados} fluxo={fluxo} recarregar={recarregar} />}
        </div>
      ) : null}
    </div>
  )
}

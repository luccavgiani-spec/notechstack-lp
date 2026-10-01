import { type FormEvent, type ReactNode, useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { METRICAS_DETALHE } from './definicoes'
import { Dicionario } from './Dicionario'
import { SeletorPeriodo } from './MarketingLayout'
import { centavosDeReais, dataHora, inteiro, isoParaLocal, localParaIso, numeroDecimal, pct, reais, rotuloStatus, tomDoStatus } from './format'
import { type DetalheGoogle, type DetalheMeta, type Metricas, marketing } from './marketing-service'
import { Carregando, Erro, PainelRevisao, Secao, Selo, botaoSecundario, campo, tabela, td, tdNum, th } from './ui'
import { useDados } from './useDados'
import { type FluxoRevisao, useRevisao } from './useRevisao'
import { ValorMetrica, ValorRazao } from './ValorMetrica'

const AVISO_ATIVAR = 'Ativar libera veiculação e gasto real. O dot só confirma depois de o Lucca autorizar expressamente no chat.'

const reaisDeRazao = (n: number) => reais(Math.round(n))

// Uma métrica por linha: cabe em 375px e cada número tem o rótulo ao lado.
function TabelaMetricas({ m, meta }: { m: Metricas; meta: boolean }) {
  const linhas: [string, ReactNode][] = [
    ['Gasto', <ValorMetrica valor={m.gasto_centavos} formatar={reais} />],
    ['Impressões', <ValorMetrica valor={m.impressoes} formatar={inteiro} />],
    ['Alcance', <ValorMetrica valor={m.alcance} formatar={inteiro} />],
    ['Cliques', <ValorMetrica valor={m.cliques} formatar={inteiro} />],
    ...(meta ? [
      ['Cliques no link', <ValorMetrica valor={m.cliques_link} formatar={inteiro} />],
      ['Visualizações da página de destino', <ValorMetrica valor={m.lpv} formatar={inteiro} />],
      ['Custo por LPV', <ValorRazao numerador={m.gasto_centavos} denominador={m.lpv} formatar={reaisDeRazao} />],
      ['LPV por clique no link (diagnóstico, não funil individual)', <ValorRazao numerador={m.lpv} denominador={m.cliques_link} formatar={pct} />],
    ] as [string, ReactNode][] : []),
    ['Leads / conv.', <ValorMetrica valor={m.conversoes} formatar={numeroDecimal} />],
    ['Custo por lead', <ValorRazao numerador={m.gasto_centavos} denominador={m.conversoes} formatar={reaisDeRazao} />],
  ]
  return (
    <div className="overflow-x-auto">
      <table className={`${tabela} max-w-xl`}>
        <caption className="sr-only">Métricas da campanha no período</caption>
        <thead><tr><th className={th}>Métrica</th><th className={`${th} text-right`}>Valor</th></tr></thead>
        <tbody>
          {linhas.map(([rotulo, valor]) => (
            <tr key={rotulo}><th scope="row" className={`${td} font-normal`}>{rotulo}</th><td className={tdNum}>{valor}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Resultado que o conjunto otimiza, lado a lado com o objetivo (T2 critério 5).
const RESULTADO_DA_OTIMIZACAO: Record<string, { rotulo: string; campo: 'lpv' | 'cliques_link' | 'conversoes' }> = {
  LANDING_PAGE_VIEWS: { rotulo: 'Visualizações da página de destino', campo: 'lpv' },
  LINK_CLICKS: { rotulo: 'Cliques no link', campo: 'cliques_link' },
  LEAD_GENERATION: { rotulo: 'Leads (plataforma)', campo: 'conversoes' },
  QUALITY_LEAD: { rotulo: 'Leads (plataforma)', campo: 'conversoes' },
  OFFSITE_CONVERSIONS: { rotulo: 'Leads (plataforma)', campo: 'conversoes' },
}

function ObjetivoResultado({ d }: { d: DetalheMeta }) {
  const otimizacoes = [...new Set(d.conjuntos.map((s) => s.otimizacao).filter((o): o is string => Boolean(o)))]
  const linhas = otimizacoes.length ? otimizacoes : [null]
  return (
    <div className="mb-4 overflow-x-auto">
      <table className={`${tabela} min-w-[640px]`}>
        <caption className="mb-2 text-left text-sm font-semibold">Objetivo, otimização e resultado</caption>
        <thead><tr>
          <th className={th}>Objetivo da campanha</th><th className={th}>Otimização do conjunto</th><th className={th}>Resultado</th>
          <th className={`${th} text-right`}>Quantidade</th><th className={`${th} text-right`}>Custo por resultado</th>
        </tr></thead>
        <tbody>
          {linhas.map((otimizacao) => {
            const resultado = otimizacao ? RESULTADO_DA_OTIMIZACAO[otimizacao] : undefined
            const quantidade = resultado ? d.metricas[resultado.campo] : null
            return (
              <tr key={otimizacao ?? 'sem-conjunto'}>
                <td className={`${td} font-mono text-xs`}>{d.campanha.objetivo ?? '—'}</td>
                <td className={`${td} font-mono text-xs`}>{otimizacao ?? 'sem conjunto'}</td>
                <td className={td}>{resultado ? resultado.rotulo : 'resultado não mapeado no painel'}</td>
                <td className={tdNum}><ValorMetrica valor={quantidade} formatar={resultado?.campo === 'conversoes' ? numeroDecimal : inteiro} /></td>
                <td className={tdNum}><ValorRazao numerador={d.metricas.gasto_centavos} denominador={quantidade} formatar={reaisDeRazao} /></td>
              </tr>
            )
          })}
        </tbody>
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
        <ObjetivoResultado d={d} />
        <TabelaMetricas m={d.metricas} meta />
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
        <TabelaMetricas m={d.metricas} meta={false} />
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
          <div className="mt-6"><Dicionario metricas={METRICAS_DETALHE} /></div>
        </div>
      ) : null}
    </div>
  )
}

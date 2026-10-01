import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ColunasDiarias } from './ColunasDiarias'
import { SeletorPeriodo } from './MarketingLayout'
import { custoPor, dataCompleta, dataHora, inteiro, numeroDecimal, pct, reais, reaisEixo, tituloPeriodo } from './format'
import { type Metricas, type VisaoGeral, marketing } from './marketing-service'
import { BlocoIndisponivel, Carregando, Erro, Secao, Vazio, botaoSecundario, tabela, td, tdNum, th } from './ui'
import { useDados } from './useDados'

const CANAIS: Record<string, string> = { meta: 'Meta (anúncio ou IG/FB)', google: 'Google Ads', organico: 'Busca orgânica', direto: 'Direto', outros: 'Outros' }

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="rounded-2xl border border-borda bg-white p-4">
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-cinza">{rotulo}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-cinza">{detalhe}</p> : null}
    </div>
  )
}

function linhaPaga(rotulo: string, meta: Metricas | null, google: Metricas | null, f: (m: Metricas) => string) {
  return (
    <tr key={rotulo}>
      <th scope="row" className={`${td} font-semibold`}>{rotulo}</th>
      <td className={tdNum}>{meta ? f(meta) : '—'}</td>
      <td className={tdNum}>{google ? f(google) : '—'}</td>
    </tr>
  )
}

function TrafegoPago({ v }: { v: VisaoGeral }) {
  const { meta_ads, google_ads, ga4 } = v.blocos
  const meta = meta_ads.ok ? meta_ads.dados.total : null
  const google = google_ads.ok ? google_ads.dados.total : null
  const porDia = new Map<string, { metaGasto?: number; metaLeads?: number; googleGasto?: number; googleConv?: number }>()
  if (meta_ads.ok) for (const d of meta_ads.dados.por_dia) porDia.set(d.dia, { ...porDia.get(d.dia), metaGasto: d.gasto_centavos, metaLeads: d.conversoes })
  if (google_ads.ok) for (const d of google_ads.dados.por_dia) porDia.set(d.dia, { ...porDia.get(d.dia), googleGasto: d.gasto_centavos, googleConv: d.conversoes })

  return (
    <Secao titulo="Tráfego pago" rotulo="Meta Ads e Google Ads" acento="bg-azul">
      <div className="space-y-3">
        <BlocoIndisponivel bloco={meta_ads} nome="Meta Ads" />
        <BlocoIndisponivel bloco={google_ads} nome="Google Ads" />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className={tabela}>
          <caption className="sr-only">Tráfego pago no período, por plataforma</caption>
          <thead><tr><th className={th}>Métrica</th><th className={`${th} text-right`}>Meta Ads</th><th className={`${th} text-right`}>Google Ads</th></tr></thead>
          <tbody>
            {linhaPaga('Gasto', meta, google, (m) => reais(m.gasto_centavos))}
            {linhaPaga('Impressões', meta, google, (m) => inteiro(m.impressoes))}
            {linhaPaga('Alcance', meta, google, (m) => inteiro(m.alcance))}
            {linhaPaga('Cliques', meta, google, (m) => inteiro(m.cliques))}
            {linhaPaga('Cliques no link', meta, google, (m) => inteiro(m.cliques_link))}
            {linhaPaga('Leads / conversões (plataforma)', meta, google, (m) => numeroDecimal(m.conversoes))}
            {linhaPaga('Custo por lead / conversão', meta, google, (m) => custoPor(m.gasto_centavos, m.conversoes))}
          </tbody>
        </table>
      </div>
      {ga4.ok ? (
        <p className="mt-2 text-xs text-cinza">
          Conferência pelo GA4 (Google Ads vinculado): gasto {reais(ga4.dados.google_ads_segundo_ga4.gasto_centavos)},
          {' '}{inteiro(ga4.dados.google_ads_segundo_ga4.cliques)} cliques, {inteiro(ga4.dados.google_ads_segundo_ga4.impressoes)} impressões.
        </p>
      ) : null}
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {meta_ads.ok ? <ColunasDiarias titulo="Gasto por dia — Meta Ads" serie={meta_ads.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.gasto_centavos }))} formatar={reais} formatarEixo={reaisEixo} /> : null}
        {google_ads.ok ? <ColunasDiarias titulo="Gasto por dia — Google Ads" serie={google_ads.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.gasto_centavos }))} formatar={reais} formatarEixo={reaisEixo} /> : null}
      </div>
      {porDia.size ? (
        <div className="mt-4 max-h-72 overflow-auto">
          <table className={`${tabela} min-w-[520px]`}>
            <caption className="sr-only">Tráfego pago por dia</caption>
            <thead className="sticky top-0 bg-white"><tr>
              <th className={th}>Dia</th><th className={`${th} text-right`}>Gasto Meta</th><th className={`${th} text-right`}>Leads Meta</th>
              <th className={`${th} text-right`}>Gasto Google</th><th className={`${th} text-right`}>Conversões Google</th>
            </tr></thead>
            <tbody>
              {[...porDia.entries()].sort().map(([dia, l]) => (
                <tr key={dia}>
                  <th scope="row" className={`${td} font-normal`}>{dataCompleta(dia)}</th>
                  <td className={tdNum}>{l.metaGasto === undefined ? '—' : reais(l.metaGasto)}</td>
                  <td className={tdNum}>{l.metaLeads === undefined ? '—' : inteiro(l.metaLeads)}</td>
                  <td className={tdNum}>{l.googleGasto === undefined ? '—' : reais(l.googleGasto)}</td>
                  <td className={tdNum}>{l.googleConv === undefined ? '—' : numeroDecimal(l.googleConv)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Secao>
  )
}

function Conversao({ v }: { v: VisaoGeral }) {
  const { leads, ga4 } = v.blocos
  return (
    <Secao titulo="Conversão" rotulo="Leads do funil próprio e GA4" acento="bg-verde">
      <div className="space-y-3">
        <BlocoIndisponivel bloco={leads} nome="Leads" />
        <BlocoIndisponivel bloco={ga4} nome="GA4" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {leads.ok ? (
          <div>
            <div className="overflow-x-auto">
              <table className={tabela}>
                <caption className="mb-2 text-left text-sm font-semibold">Leads por canal (funil próprio, só contagem)</caption>
                <thead><tr><th className={th}>Canal</th><th className={`${th} text-right`}>Leads</th></tr></thead>
                <tbody>
                  {Object.entries(leads.dados.por_canal).map(([canal, total]) => (
                    <tr key={canal}><th scope="row" className={`${td} font-normal`}>{CANAIS[canal] ?? canal}</th><td className={tdNum}>{inteiro(total)}</td></tr>
                  ))}
                  <tr><th scope="row" className={`${td} font-semibold`}>Total</th><td className={`${tdNum} font-semibold`}>{inteiro(leads.dados.total)}</td></tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4"><ColunasDiarias titulo="Leads por dia" serie={leads.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.total }))} formatar={inteiro} /></div>
          </div>
        ) : null}
        {ga4.ok ? (
          <div>
            <div className="overflow-x-auto">
              <table className={`${tabela} min-w-[420px]`}>
                <caption className="mb-2 text-left text-sm font-semibold">Sessões e eventos-chave por canal (GA4)</caption>
                <thead><tr><th className={th}>Canal</th><th className={`${th} text-right`}>Sessões</th><th className={`${th} text-right`}>Usuários</th><th className={`${th} text-right`}>Eventos-chave</th></tr></thead>
                <tbody>
                  {ga4.dados.por_canal.map((c) => (
                    <tr key={c.canal}><th scope="row" className={`${td} font-normal`}>{c.canal}</th><td className={tdNum}>{inteiro(c.sessoes)}</td><td className={tdNum}>{inteiro(c.usuarios)}</td><td className={tdNum}>{inteiro(c.eventos_chave)}</td></tr>
                  ))}
                  <tr><th scope="row" className={`${td} font-semibold`}>Total</th><td className={`${tdNum} font-semibold`}>{inteiro(ga4.dados.sessoes)}</td><td className={tdNum}>—</td><td className={`${tdNum} font-semibold`}>{inteiro(ga4.dados.eventos_chave)}</td></tr>
                </tbody>
              </table>
            </div>
            {ga4.dados.eventos.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className={tabela}>
                  <caption className="mb-2 text-left text-sm font-semibold">Eventos-chave (GA4)</caption>
                  <thead><tr><th className={th}>Evento</th><th className={`${th} text-right`}>Total</th></tr></thead>
                  <tbody>{ga4.dados.eventos.map((e) => <tr key={e.evento}><th scope="row" className={`${td} font-mono text-xs font-normal`}>{e.evento}</th><td className={tdNum}>{inteiro(e.total)}</td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
            <div className="mt-4"><ColunasDiarias titulo="Sessões por dia (GA4)" serie={ga4.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.sessoes }))} formatar={inteiro} /></div>
          </div>
        ) : null}
      </div>
    </Secao>
  )
}

function Social({ v }: { v: VisaoGeral }) {
  const { instagram, facebook } = v.blocos
  const posts = [...(instagram.ok ? instagram.dados.posts : []), ...(facebook.ok ? facebook.dados.posts : [])]
    .sort((a, b) => b.data.localeCompare(a.data))
  return (
    <Secao titulo="Social orgânico" rotulo="Instagram e Facebook" acento="bg-vermelho">
      <div className="space-y-3">
        <BlocoIndisponivel bloco={instagram} nome="Instagram" />
        <BlocoIndisponivel bloco={facebook} nome="Facebook" />
      </div>
      <div className="overflow-x-auto">
        <table className={tabela}>
          <caption className="sr-only">Desempenho orgânico por rede</caption>
          <thead><tr><th className={th}>Métrica</th><th className={`${th} text-right`}>Instagram</th><th className={`${th} text-right`}>Facebook</th></tr></thead>
          <tbody>
            <tr><th scope="row" className={`${td} font-semibold`}>Seguidores (hoje)</th><td className={tdNum}>{instagram.ok ? inteiro(instagram.dados.seguidores) : '—'}</td><td className={tdNum}>{facebook.ok ? inteiro(facebook.dados.seguidores) : '—'}</td></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Alcance</th><td className={tdNum}>{instagram.ok ? inteiro(instagram.dados.alcance) : '—'}</td><td className={tdNum}>—</td></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Visualizações</th><td className={tdNum}>{instagram.ok ? inteiro(instagram.dados.visualizacoes) : '—'}</td><td className={tdNum}>{facebook.ok ? inteiro(facebook.dados.visualizacoes) : '—'}</td></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Interações</th><td className={tdNum}>{instagram.ok ? inteiro(instagram.dados.interacoes) : '—'}</td><td className={tdNum}>{facebook.ok ? inteiro(facebook.dados.interacoes) : '—'}</td></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Contas engajadas</th><td className={tdNum}>{instagram.ok ? inteiro(instagram.dados.contas_engajadas) : '—'}</td><td className={tdNum}>—</td></tr>
          </tbody>
        </table>
      </div>
      {instagram.ok && instagram.dados.aproximado ? <p className="mt-2 text-xs text-cinza">Instagram: período maior que 30 dias somado em janelas; alcance aproximado.</p> : null}
      {posts.length ? (
        <div className="mt-4 max-h-96 overflow-auto">
          <table className={`${tabela} min-w-[640px]`}>
            <caption className="mb-2 text-left text-sm font-semibold">Posts do período</caption>
            <thead className="sticky top-0 bg-white"><tr>
              <th className={th}>Data</th><th className={th}>Rede</th><th className={th}>Texto</th>
              <th className={`${th} text-right`}>Alcance</th><th className={`${th} text-right`}>Interações</th><th className={`${th} text-right`}>Comentários</th><th className={th}>Link</th>
            </tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={`${p.rede}-${p.id}`}>
                  <td className={`${td} whitespace-nowrap`}>{dataHora(p.data)}</td>
                  <td className={td}>{p.rede === 'instagram' ? `Instagram · ${p.tipo}` : 'Facebook'}</td>
                  <td className={`${td} max-w-xs truncate`} title={p.texto}>{p.texto || '(sem texto)'}</td>
                  <td className={tdNum}>{inteiro(p.alcance)}</td>
                  <td className={tdNum}>{inteiro(p.interacoes)}</td>
                  <td className={tdNum}>{inteiro(p.comentarios)}</td>
                  <td className={td}>{p.link ? <a className="text-azul underline" href={p.link} target="_blank" rel="noreferrer">abrir</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Secao>
  )
}

function TabelaGsc({ titulo, chave, colunaExtra, linhas }: {
  titulo: string
  chave: string
  colunaExtra: string
  linhas: { chave: string; cliques: number; extra: string }[]
}) {
  return (
    <div className="overflow-x-auto">
      <table className={`${tabela} min-w-[320px]`}>
        <caption className="mb-2 text-left text-sm font-semibold">{titulo}</caption>
        <thead><tr><th className={th}>{chave}</th><th className={`${th} text-right`}>Cliques</th><th className={`${th} text-right`}>{colunaExtra}</th></tr></thead>
        <tbody>
          {linhas.length ? linhas.map((l) => (
            <tr key={l.chave}>
              <th scope="row" className={`${td} max-w-[16rem] break-all font-normal`}>{l.chave.replace(/^https?:\/\/(www\.)?/, '')}</th>
              <td className={tdNum}>{inteiro(l.cliques)}</td>
              <td className={tdNum}>{l.extra}</td>
            </tr>
          )) : <tr><td className={td} colSpan={3}>Nada no período.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

function Busca({ v }: { v: VisaoGeral }) {
  const { search_console: gsc } = v.blocos
  return (
    <Secao titulo="Busca orgânica" rotulo="Google Search Console" acento="bg-ambar">
      <BlocoIndisponivel bloco={gsc} nome="Search Console" />
      {gsc.ok ? (
        <>
          <p className="text-sm">
            {inteiro(gsc.dados.cliques)} cliques · {inteiro(gsc.dados.impressoes)} impressões · CTR {pct(gsc.dados.ctr)}
            <span className="text-cinza"> — datas do Search Console no fuso do Pacífico; os últimos 2–3 dias ainda consolidam.</span>
          </p>
          <div className="mt-4"><ColunasDiarias titulo="Cliques orgânicos por dia" serie={gsc.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.cliques }))} formatar={inteiro} /></div>
          <div className="mt-4 grid gap-6 xl:grid-cols-3">
            <TabelaGsc
              titulo={`Páginas que mais cresceram (vs ${dataCompleta(gsc.dados.comparado_com.de)} a ${dataCompleta(gsc.dados.comparado_com.ate)})`}
              chave="Página"
              linhas={gsc.dados.paginas_que_cresceram.map((l) => ({ chave: l.chave, cliques: l.cliques, extra: `+${inteiro(l.variacao)}` }))}
              colunaExtra="Variação"
            />
            <TabelaGsc titulo="Consultas com mais cliques" chave="Consulta" linhas={gsc.dados.consultas.map((l) => ({ chave: l.chave, cliques: l.cliques, extra: inteiro(l.impressoes) }))} colunaExtra="Impressões" />
            <TabelaGsc titulo="Páginas com mais cliques" chave="Página" linhas={gsc.dados.paginas.map((l) => ({ chave: l.chave, cliques: l.cliques, extra: inteiro(l.impressoes) }))} colunaExtra="Impressões" />
          </div>
        </>
      ) : null}
    </Secao>
  )
}

export function OverviewPage() {
  const [params] = useSearchParams()
  const periodo = params.get('periodo') ?? '7d'
  const [forcar, setForcar] = useState(0)
  const carregar = useCallback(() => marketing.visaoGeral(periodo, forcar > 0), [periodo, forcar])
  const { dados, erro, carregando, recarregar } = useDados(carregar)

  const b = dados?.blocos
  const gasto = (b?.meta_ads.ok ? b.meta_ads.dados.total.gasto_centavos : 0) + (b?.google_ads.ok ? b.google_ads.dados.total.gasto_centavos : 0)
  const temGasto = Boolean(b && (b.meta_ads.ok || b.google_ads.ok))
  const leads = b?.leads.ok ? b.leads.dados.total : null

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Visão geral</h1>
      <SeletorPeriodo />
      {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
      {!dados && carregando ? <Carregando texto="Buscando os números nas plataformas…" /> : null}
      {dados ? (
        <div className={`space-y-6 transition-opacity ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <h2 className="text-lg font-semibold tracking-[-0.01em]">{tituloPeriodo(dados.periodo)}</h2>
              <p className="text-xs text-cinza">gerado em {dataHora(dados.gerado_em)}</p>
            </div>
            <button type="button" className={botaoSecundario} onClick={() => setForcar((n) => n + 1)} disabled={carregando}>
              Buscar números frescos (sem cache)
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Indicador rotulo="Gasto em anúncios" valor={temGasto ? reais(gasto) : '—'} detalhe="Meta + Google" />
            <Indicador rotulo="Leads (funil próprio)" valor={inteiro(leads)} />
            <Indicador rotulo="Custo por lead" valor={temGasto && leads !== null ? custoPor(gasto, leads) : '—'} detalhe="gasto ÷ leads do funil" />
            <Indicador rotulo="Sessões (GA4)" valor={b?.ga4.ok ? inteiro(b.ga4.dados.sessoes) : '—'} />
            <Indicador rotulo="Cliques orgânicos" valor={b?.search_console.ok ? inteiro(b.search_console.dados.cliques) : '—'} detalhe="Search Console" />
          </div>
          <TrafegoPago v={dados} />
          <Conversao v={dados} />
          <Social v={dados} />
          <Busca v={dados} />
        </div>
      ) : null}
      {dados && !carregando && !Object.values(dados.blocos).some((x) => x.ok) ? <Vazio texto="Nenhuma integração respondeu ainda." /> : null}
    </div>
  )
}

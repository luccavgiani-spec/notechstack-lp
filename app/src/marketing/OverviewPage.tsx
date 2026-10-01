import { type ReactNode, useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ColunasDiarias } from './ColunasDiarias'
import { METRICAS_VISAO_GERAL } from './definicoes'
import { Dicionario } from './Dicionario'
import { SEM_VALOR, estadoDaMetrica, estadoDe, estadoDoBloco } from './estados'
import { dataCompleta, dataHora, inteiro, numeroDecimal, pct, reais, reaisEixo, tituloPeriodo } from './format'
import { SeletorPeriodo } from './MarketingLayout'
import { type Bloco, type CanalLead, type ClasseLead, type EstadoMetrica, type Metricas, type SerieDiaria, type VisaoGeral, marketing } from './marketing-service'
import { BlocoIndisponivel, Carregando, Erro, Secao, Vazio, botaoSecundario, tabela, td, tdNum, th } from './ui'
import { useDados } from './useDados'
import { NaoSeAplica, ValorMetrica, ValorRazao } from './ValorMetrica'

const CANAIS: Record<CanalLead, string> = { meta: 'Meta (anúncio ou IG/FB)', google: 'Google Ads', organico: 'Busca orgânica', direto: 'Direto', outros: 'Outros' }
const ORDEM_CANAIS: CanalLead[] = ['meta', 'google', 'organico', 'direto', 'outros']

type Blocos = VisaoGeral['blocos']
type BlocoPago = Bloco<{ total: Metricas; por_dia: SerieDiaria[] }>
type Formatar = (n: number) => string

// Razões em reais: a divisão sai em centavos fracionados.
const reaisDeRazao: Formatar = (n) => reais(Math.round(n))

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: ReactNode; detalhe?: string }) {
  return (
    <div role="group" aria-label={rotulo} className="rounded-2xl border border-borda bg-white p-4">
      <p className="font-mono text-[0.625rem] uppercase tracking-[0.14em] text-cinza">{rotulo}</p>
      <p className="mt-2 text-2xl font-semibold tracking-[-0.02em]">{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-cinza">{detalhe}</p> : null}
    </div>
  )
}

// Total pago diz quais fontes entraram (T2 critério 7): fonte que falhou não soma como zero.
type GastoPago = { centavos: number | null; estado?: EstadoMetrica; fontes: string; curto: string }

function gastoDisponivel(b: BlocoPago): number | null {
  if (!b.ok) return null
  const e = b.estados?.gasto_centavos
  return e && SEM_VALOR.includes(e) ? null : b.dados.total.gasto_centavos
}

function gastoPago(b: Blocos): GastoPago {
  const meta = gastoDisponivel(b.meta_ads)
  const google = gastoDisponivel(b.google_ads)
  const estados = [meta !== null ? estadoDe(b.meta_ads, 'gasto_centavos') : undefined, google !== null ? estadoDe(b.google_ads, 'gasto_centavos') : undefined]
  const estado = estados.find((e) => e === 'parcial') ?? estados.find((e) => e === 'atrasado')
  if (meta !== null && google !== null) return { centavos: meta + google, estado, fontes: 'Meta + Google', curto: 'Meta + Google' }
  if (meta !== null) return { centavos: meta, estado, fontes: 'só Meta — Google Ads indisponível', curto: 'só Meta' }
  if (google !== null) return { centavos: google, estado, fontes: 'só Google — Meta Ads indisponível', curto: 'só Google' }
  return { centavos: null, estado: 'indisponivel', fontes: 'Meta Ads e Google Ads indisponíveis', curto: 'nenhuma fonte' }
}

// Leads válidos = classificação mais recente `real` (T2 critério 1). Sem o campo
// (resposta antiga em cache), o painel não cai de volta no total com testes.
type LeadsValidos = { validos: number | null; estado?: EstadoMetrica; aClassificar: number }

function leadsValidos(b: Blocos['leads']): LeadsValidos {
  if (!b.ok) return { validos: null, estado: estadoDoBloco(b), aClassificar: 0 }
  if (b.dados.validos === undefined) return { validos: null, estado: 'indisponivel', aClassificar: 0 }
  return { validos: b.dados.validos, estado: b.estados?.validos, aClassificar: b.dados.por_classe?.a_classificar ?? 0 }
}

function detalheCpl(gasto: GastoPago, leads: LeadsValidos): string {
  const partes = [leads.validos === 0 ? 'zero leads válidos no período' : `gasto pago (${gasto.curto}) ÷ leads válidos`]
  if (leads.aClassificar > 0) partes.push('CPL considera só leads confirmados')
  return partes.join(' · ')
}

function CelulaPaga({ bloco, campo, formatar }: { bloco: BlocoPago; campo: keyof Metricas; formatar: Formatar }) {
  return (
    <td className={tdNum}>
      <ValorMetrica valor={bloco.ok ? bloco.dados.total[campo] : null} estado={estadoDe(bloco, campo)} formatar={formatar} />
    </td>
  )
}

function CelulaCusto({ bloco, campo }: { bloco: BlocoPago; campo: 'conversoes' | 'lpv' }) {
  if (!bloco.ok) return <td className={tdNum}><ValorMetrica valor={null} estado={estadoDoBloco(bloco)} formatar={reais} /></td>
  return (
    <td className={tdNum}>
      <ValorRazao
        numerador={bloco.dados.total.gasto_centavos}
        denominador={bloco.dados.total[campo]}
        estadoNumerador={bloco.estados?.gasto_centavos}
        estadoDenominador={bloco.estados?.[campo]}
        formatar={reaisDeRazao}
      />
    </td>
  )
}

// Conta, moeda, fuso e versão da API lidos da Graph a cada leitura (T2 critério 14).
function ContaMeta({ bloco }: { bloco: Blocos['meta_ads'] }) {
  if (!bloco.ok) return null
  const c = bloco.dados.conta
  if (!c) return <p className="text-xs text-cinza">Conta, moeda, fuso e versão da API da Meta: não informados nesta leitura.</p>
  const linhas: [string, string | null][] = [['Conta', c.id], ['Moeda', c.moeda], ['Fuso', c.fuso], ['Versão da API', c.versao_api]]
  return (
    <div>
      <table className={`${tabela} max-w-md`}>
        <caption className="mb-1 text-left text-sm font-semibold">Conta Meta Ads (lida da plataforma nesta leitura)</caption>
        <tbody>
          {linhas.map(([rotulo, valor]) => (
            <tr key={rotulo}><th scope="row" className={th}>{rotulo}</th><td className={`${td} break-all font-mono text-xs`}>{valor ?? 'não informado pela plataforma'}</td></tr>
          ))}
        </tbody>
      </table>
      {c.moeda && c.moeda !== 'BRL' ? <p className="mt-1 text-xs">Atenção: a conta está em {c.moeda}; o painel formata os valores como R$.</p> : null}
    </div>
  )
}

function TrafegoPago({ v }: { v: VisaoGeral }) {
  const { meta_ads, google_ads, ga4 } = v.blocos
  const porDia = new Map<string, { metaGasto?: number; metaLeads?: number; metaLpv?: number | null; googleGasto?: number; googleConv?: number }>()
  if (meta_ads.ok) for (const d of meta_ads.dados.por_dia) porDia.set(d.dia, { ...porDia.get(d.dia), metaGasto: d.gasto_centavos, metaLeads: d.conversoes, metaLpv: d.lpv ?? null })
  if (google_ads.ok) for (const d of google_ads.dados.por_dia) porDia.set(d.dia, { ...porDia.get(d.dia), googleGasto: d.gasto_centavos, googleConv: d.conversoes })


  return (
    <Secao titulo="Tráfego pago" rotulo="Meta Ads e Google Ads" acento="bg-azul">
      <div className="space-y-3">
        <ContaMeta bloco={meta_ads} />
        <BlocoIndisponivel bloco={meta_ads} nome="Meta Ads" />
        <BlocoIndisponivel bloco={google_ads} nome="Google Ads" />
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className={`${tabela} min-w-[420px]`}>
          <caption className="sr-only">Tráfego pago no período, por plataforma</caption>
          <thead><tr><th className={th}>Métrica</th><th className={`${th} text-right`}>Meta Ads</th><th className={`${th} text-right`}>Google Ads</th></tr></thead>
          <tbody>
            <tr><th scope="row" className={`${td} font-semibold`}>Gasto</th><CelulaPaga bloco={meta_ads} campo="gasto_centavos" formatar={reais} /><CelulaPaga bloco={google_ads} campo="gasto_centavos" formatar={reais} /></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Impressões</th><CelulaPaga bloco={meta_ads} campo="impressoes" formatar={inteiro} /><CelulaPaga bloco={google_ads} campo="impressoes" formatar={inteiro} /></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Alcance</th><CelulaPaga bloco={meta_ads} campo="alcance" formatar={inteiro} /><CelulaPaga bloco={google_ads} campo="alcance" formatar={inteiro} /></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Cliques</th><CelulaPaga bloco={meta_ads} campo="cliques" formatar={inteiro} /><CelulaPaga bloco={google_ads} campo="cliques" formatar={inteiro} /></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Cliques no link</th><CelulaPaga bloco={meta_ads} campo="cliques_link" formatar={inteiro} /><CelulaPaga bloco={google_ads} campo="cliques_link" formatar={inteiro} /></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Visualizações da página de destino</th><CelulaPaga bloco={meta_ads} campo="lpv" formatar={inteiro} /><td className={tdNum}><NaoSeAplica /></td></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Custo por LPV</th><CelulaCusto bloco={meta_ads} campo="lpv" /><td className={tdNum}><NaoSeAplica /></td></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Leads / conversões (plataforma)</th><CelulaPaga bloco={meta_ads} campo="conversoes" formatar={numeroDecimal} /><CelulaPaga bloco={google_ads} campo="conversoes" formatar={numeroDecimal} /></tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Custo por lead / conversão (plataforma)</th><CelulaCusto bloco={meta_ads} campo="conversoes" /><CelulaCusto bloco={google_ads} campo="conversoes" /></tr>
          </tbody>
        </table>
      </div>
      {ga4.ok ? (
        <p className="mt-2 text-xs text-cinza">
          Conferência pelo GA4 (Google Ads vinculado): gasto <ValorMetrica valor={ga4.dados.google_ads_segundo_ga4.gasto_centavos} estado={estadoDaMetrica(ga4.estados, "google_ads_segundo_ga4.gasto_centavos", ga4.dados.google_ads_segundo_ga4.gasto_centavos)} formatar={reais} />,
          {' '}<ValorMetrica valor={ga4.dados.google_ads_segundo_ga4.cliques} estado={estadoDaMetrica(ga4.estados, "google_ads_segundo_ga4.cliques", ga4.dados.google_ads_segundo_ga4.cliques)} formatar={inteiro} /> cliques, <ValorMetrica valor={ga4.dados.google_ads_segundo_ga4.impressoes} estado={estadoDaMetrica(ga4.estados, "google_ads_segundo_ga4.impressoes", ga4.dados.google_ads_segundo_ga4.impressoes)} formatar={inteiro} /> impressões.
        </p>
      ) : null}
      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        {meta_ads.ok ? <ColunasDiarias titulo="Gasto por dia — Meta Ads" estado={meta_ads.estados?.bloco} serie={meta_ads.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.gasto_centavos }))} formatar={reais} formatarEixo={reaisEixo} /> : null}
        {google_ads.ok ? <ColunasDiarias titulo="Gasto por dia — Google Ads" estado={google_ads.estados?.bloco} serie={google_ads.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.gasto_centavos }))} formatar={reais} formatarEixo={reaisEixo} /> : null}
      </div>
      {porDia.size ? (
        <div className="mt-4 max-h-72 overflow-auto">
          <table className={`${tabela} min-w-[640px]`}>
            <caption className="sr-only">Tráfego pago por dia</caption>
            <thead className="sticky top-0 bg-white"><tr>
              <th className={th}>Dia</th><th className={`${th} text-right`}>Gasto Meta</th><th className={`${th} text-right`}>LPV Meta</th><th className={`${th} text-right`}>Leads Meta</th>
              <th className={`${th} text-right`}>Gasto Google</th><th className={`${th} text-right`}>Conversões Google</th>
            </tr></thead>
            <tbody>
              {[...porDia.entries()].sort().map(([dia, l]) => (
                <tr key={dia}>
                  <th scope="row" className={`${td} font-normal`}>{dataCompleta(dia)}</th>
                  <td className={tdNum}><ValorMetrica valor={l.metaGasto} estado={meta_ads.ok ? estadoDaMetrica(meta_ads.estados, "por_dia.gasto_centavos", l.metaGasto) : estadoDoBloco(meta_ads)} formatar={reais} /></td>
                  <td className={tdNum}><ValorMetrica valor={l.metaLpv} estado={meta_ads.ok ? estadoDaMetrica(meta_ads.estados, "por_dia.lpv", l.metaLpv) : estadoDoBloco(meta_ads)} formatar={inteiro} /></td>
                  <td className={tdNum}><ValorMetrica valor={l.metaLeads} estado={meta_ads.ok ? estadoDaMetrica(meta_ads.estados, "por_dia.conversoes", l.metaLeads) : estadoDoBloco(meta_ads)} formatar={inteiro} /></td>
                  <td className={tdNum}><ValorMetrica valor={l.googleGasto} estado={google_ads.ok ? estadoDaMetrica(google_ads.estados, "por_dia.gasto_centavos", l.googleGasto) : estadoDoBloco(google_ads)} formatar={reais} /></td>
                  <td className={tdNum}><ValorMetrica valor={l.googleConv} estado={google_ads.ok ? estadoDaMetrica(google_ads.estados, "por_dia.conversoes", l.googleConv) : estadoDoBloco(google_ads)} formatar={numeroDecimal} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </Secao>
  )
}

function TabelasLeads({ bloco, gasto }: { bloco: Extract<Blocos['leads'], { ok: true }>; gasto: GastoPago }) {
  const d = bloco.dados
  const lv = leadsValidos(bloco)
  const classe = (c: ClasseLead) => <ValorMetrica valor={d.por_classe?.[c]} estado={d.por_classe ? bloco.estados?.por_classe : 'indisponivel'} formatar={inteiro} />
  const linhas: [string, ReactNode][] = [
    ['Registros no funil (todos)', <ValorMetrica valor={d.total} estado={bloco.estados?.total} formatar={inteiro} />],
    ['Testes excluídos', classe('teste')],
    ['Inválidos excluídos', classe('invalido')],
    ['Duplicados excluídos', classe('duplicado')],
    ['A classificar (fora do CPL)', classe('a_classificar')],
    ['Leads válidos', <ValorMetrica valor={lv.validos} estado={lv.estado} formatar={inteiro} />],
    [`Gasto pago considerado (${gasto.fontes})`, <ValorMetrica valor={gasto.centavos} estado={gasto.estado} formatar={reais} />],
    ['Custo por lead válido', <ValorRazao numerador={gasto.centavos} denominador={lv.validos} estadoNumerador={gasto.estado} estadoDenominador={lv.estado} formatar={reaisDeRazao} />],
  ]
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className={tabela}>
          <caption className="mb-2 text-left text-sm font-semibold">Leads válidos e custo por lead (funil próprio)</caption>
          <thead><tr><th className={th}>Linha</th><th className={`${th} text-right`}>Valor</th></tr></thead>
          <tbody>
            {linhas.map(([rotulo, valor]) => (
              <tr key={rotulo}><th scope="row" className={`${td} font-normal`}>{rotulo}</th><td className={tdNum}>{valor ?? 'não informado pela plataforma'}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      {lv.aClassificar > 0 ? (
        <p className="rounded-xl bg-ambar/10 px-3 py-2 text-xs">CPL considera só leads confirmados: {inteiro(lv.aClassificar)} a classificar ficam fora.</p>
      ) : null}
      <div className="overflow-x-auto">
        <table className={tabela}>
          <caption className="mb-2 text-left text-sm font-semibold">Leads por canal (válidos) (funil próprio, só contagem)</caption>
          <thead><tr><th className={th}>Canal</th><th className={`${th} text-right`}>Leads válidos</th></tr></thead>
          <tbody>
            {ORDEM_CANAIS.map((canal) => (
              <tr key={canal}>
                <th scope="row" className={`${td} font-normal`}>{CANAIS[canal]}</th>
                <td className={tdNum}><ValorMetrica valor={d.por_canal_validos?.[canal]} estado={d.por_canal_validos ? bloco.estados?.por_canal_validos : 'indisponivel'} formatar={inteiro} /></td>
              </tr>
            ))}
            <tr><th scope="row" className={`${td} font-semibold`}>Total válidos</th><td className={`${tdNum} font-semibold`}><ValorMetrica valor={lv.validos} estado={lv.estado} formatar={inteiro} /></td></tr>
          </tbody>
        </table>
      </div>
      <ColunasDiarias titulo="Registros no funil por dia (todos, inclui testes)" serie={d.por_dia.map((x) => ({ dia: x.dia, valor: x.total }))} formatar={inteiro} />
    </div>
  )
}

function Conversao({ v, gasto }: { v: VisaoGeral; gasto: GastoPago }) {
  const { leads, ga4 } = v.blocos
  return (
    <Secao titulo="Conversão" rotulo="Leads do funil próprio e GA4" acento="bg-verde">
      <div className="space-y-3">
        <BlocoIndisponivel bloco={leads} nome="Leads" />
        <BlocoIndisponivel bloco={ga4} nome="GA4" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {leads.ok ? <TabelasLeads bloco={leads} gasto={gasto} /> : null}
        {ga4.ok ? (
          <div>
            <div className="overflow-x-auto">
              <table className={`${tabela} min-w-[420px]`}>
                <caption className="mb-2 text-left text-sm font-semibold">Sessões e eventos-chave por canal (GA4)</caption>
                <thead><tr><th className={th}>Canal</th><th className={`${th} text-right`}>Sessões</th><th className={`${th} text-right`}>Usuários</th><th className={`${th} text-right`}>Eventos-chave</th></tr></thead>
                <tbody>
                  {ga4.dados.por_canal.map((c) => (
                    <tr key={c.canal}><th scope="row" className={`${td} font-normal`}>{c.canal}</th><td className={tdNum}><ValorMetrica valor={c.sessoes} estado={estadoDaMetrica(ga4.estados, "por_canal.sessoes", c.sessoes)} formatar={inteiro} /></td><td className={tdNum}><ValorMetrica valor={c.usuarios} estado={estadoDaMetrica(ga4.estados, "por_canal.usuarios", c.usuarios)} formatar={inteiro} /></td><td className={tdNum}><ValorMetrica valor={c.eventos_chave} estado={estadoDaMetrica(ga4.estados, "por_canal.eventos_chave", c.eventos_chave)} formatar={inteiro} /></td></tr>
                  ))}
                  <tr>
                    <th scope="row" className={`${td} font-semibold`}>Total</th>
                    <td className={`${tdNum} font-semibold`}><ValorMetrica valor={ga4.dados.sessoes} estado={ga4.estados?.sessoes} formatar={inteiro} /></td>
                    <td className={`${tdNum} text-cinza`}>não somável</td>
                    <td className={`${tdNum} font-semibold`}><ValorMetrica valor={ga4.dados.eventos_chave} estado={ga4.estados?.eventos_chave} formatar={inteiro} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
            {ga4.dados.eventos.length ? (
              <div className="mt-4 overflow-x-auto">
                <table className={tabela}>
                  <caption className="mb-2 text-left text-sm font-semibold">Eventos-chave (GA4)</caption>
                  <thead><tr><th className={th}>Evento</th><th className={`${th} text-right`}>Total</th></tr></thead>
                  <tbody>{ga4.dados.eventos.map((e) => <tr key={e.evento}><th scope="row" className={`${td} font-mono text-xs font-normal`}>{e.evento}</th><td className={tdNum}><ValorMetrica valor={e.total} estado={estadoDaMetrica(ga4.estados, "eventos.total", e.total)} formatar={inteiro} /></td></tr>)}</tbody>
                </table>
              </div>
            ) : null}
            <div className="mt-4"><ColunasDiarias titulo="Sessões por dia (GA4)" estado={ga4.estados?.bloco} serie={ga4.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.sessoes }))} formatar={inteiro} /></div>
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
  const ig = (campo: 'seguidores' | 'alcance' | 'visualizacoes' | 'interacoes' | 'contas_engajadas') => (
    <td className={tdNum}><ValorMetrica valor={instagram.ok ? instagram.dados[campo] : null} estado={estadoDe(instagram, campo)} formatar={inteiro} /></td>
  )
  const fb = (campo: 'seguidores' | 'visualizacoes' | 'interacoes') => (
    <td className={tdNum}><ValorMetrica valor={facebook.ok ? facebook.dados[campo] : null} estado={estadoDe(facebook, campo)} formatar={inteiro} /></td>
  )
  const naoSeAplica = <td className={tdNum}><NaoSeAplica /></td>
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
            <tr><th scope="row" className={`${td} font-semibold`}>Seguidores (hoje)</th>{ig('seguidores')}{fb('seguidores')}</tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Alcance</th>{ig('alcance')}{naoSeAplica}</tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Visualizações</th>{ig('visualizacoes')}{fb('visualizacoes')}</tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Interações</th>{ig('interacoes')}{fb('interacoes')}</tr>
            <tr><th scope="row" className={`${td} font-semibold`}>Contas engajadas</th>{ig('contas_engajadas')}{naoSeAplica}</tr>
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
                  <td className={tdNum}><ValorMetrica valor={p.alcance} estado={estadoDe(p.rede === "instagram" ? instagram : facebook, "posts.alcance")} formatar={inteiro} /></td>
                  <td className={tdNum}><ValorMetrica valor={p.interacoes} estado={estadoDe(p.rede === "instagram" ? instagram : facebook, "posts.interacoes")} formatar={inteiro} /></td>
                  <td className={tdNum}><ValorMetrica valor={p.comentarios} estado={estadoDe(p.rede === "instagram" ? instagram : facebook, "posts.comentarios")} formatar={inteiro} /></td>
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

function TabelaGsc({ titulo, chave, colunaExtra, linhas, estados }: {
  estados?: Record<string, EstadoMetrica>
  titulo: string
  chave: string
  colunaExtra: string
  linhas: { chave: string; cliques: number; extra: number }[]
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
              <td className={tdNum}><ValorMetrica valor={l.cliques} estado={estadoDaMetrica(estados, "cliques", l.cliques)} formatar={inteiro} /></td>
              <td className={tdNum}><ValorMetrica valor={l.extra} estado={estadoDaMetrica(estados, "extra", l.extra)} formatar={inteiro} /></td>
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
            <ValorMetrica valor={gsc.dados.cliques} estado={gsc.estados?.cliques} formatar={inteiro} /> cliques ·{' '}
            <ValorMetrica valor={gsc.dados.impressoes} estado={gsc.estados?.impressoes} formatar={inteiro} /> impressões · CTR <ValorMetrica valor={gsc.dados.ctr} estado={estadoDaMetrica(gsc.estados, "ctr", gsc.dados.ctr)} formatar={pct} />
            <span className="text-cinza"> — datas do Search Console no fuso do Pacífico; os últimos 2–3 dias ainda consolidam.</span>
          </p>
          <div className="mt-4"><ColunasDiarias titulo="Cliques orgânicos por dia" estado={gsc.estados?.bloco} serie={gsc.dados.por_dia.map((d) => ({ dia: d.dia, valor: d.cliques }))} formatar={inteiro} /></div>
          <div className="mt-4 grid gap-6 xl:grid-cols-3">
            <TabelaGsc estados={gsc.estados}
              titulo={`Páginas que mais cresceram (vs ${dataCompleta(gsc.dados.comparado_com.de)} a ${dataCompleta(gsc.dados.comparado_com.ate)})`}
              chave="Página"
              linhas={gsc.dados.paginas_que_cresceram.map((l) => ({ chave: l.chave, cliques: l.cliques, extra: l.variacao }))}
              colunaExtra="Variação"
            />
            <TabelaGsc estados={gsc.estados} titulo="Consultas com mais cliques" chave="Consulta" linhas={gsc.dados.consultas.map((l) => ({ chave: l.chave, cliques: l.cliques, extra: l.impressoes }))} colunaExtra="Impressões" />
            <TabelaGsc estados={gsc.estados} titulo="Páginas com mais cliques" chave="Página" linhas={gsc.dados.paginas.map((l) => ({ chave: l.chave, cliques: l.cliques, extra: l.impressoes }))} colunaExtra="Impressões" />
          </div>
        </>
      ) : null}
    </Secao>
  )
}

function Indicadores({ b, gasto }: { b: Blocos; gasto: GastoPago }) {
  const leads = leadsValidos(b.leads)
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Indicador rotulo="Gasto em anúncios" valor={<ValorMetrica valor={gasto.centavos} estado={gasto.estado} formatar={reais} />} detalhe={gasto.fontes} />
      <Indicador rotulo="Leads válidos" valor={<ValorMetrica valor={leads.validos} estado={leads.estado} formatar={inteiro} />} detalhe="funil próprio, sem testes" />
      <Indicador
        rotulo="Custo por lead"
        valor={<ValorRazao numerador={gasto.centavos} denominador={leads.validos} estadoNumerador={gasto.estado} estadoDenominador={leads.estado} formatar={reaisDeRazao} />}
        detalhe={detalheCpl(gasto, leads)}
      />
      <Indicador rotulo="Sessões (GA4)" valor={<ValorMetrica valor={b.ga4.ok ? b.ga4.dados.sessoes : null} estado={estadoDe(b.ga4, 'sessoes')} formatar={inteiro} />} />
      <Indicador
        rotulo="Cliques orgânicos"
        valor={<ValorMetrica valor={b.search_console.ok ? b.search_console.dados.cliques : null} estado={estadoDe(b.search_console, 'cliques')} formatar={inteiro} />}
        detalhe="Search Console"
      />
    </div>
  )
}

export function OverviewPage() {
  const [params] = useSearchParams()
  const periodo = params.get('periodo') ?? '7d'
  const [forcar, setForcar] = useState(0)
  const carregar = useCallback(() => marketing.visaoGeral(periodo, forcar > 0), [periodo, forcar])
  const { dados, erro, carregando, recarregar } = useDados(carregar)
  const gasto = dados ? gastoPago(dados.blocos) : null

  return (
    <div>
      <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Visão geral</h1>
      <SeletorPeriodo />
      {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
      {!dados && carregando ? <Carregando texto="Buscando os números nas plataformas…" /> : null}
      {dados && gasto ? (
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
          <Indicadores b={dados.blocos} gasto={gasto} />
          <TrafegoPago v={dados} />
          <Conversao v={dados} gasto={gasto} />
          <Social v={dados} />
          <Busca v={dados} />
          <Dicionario metricas={METRICAS_VISAO_GERAL} />
        </div>
      ) : null}
      {dados && !carregando && !Object.values(dados.blocos).some((x) => x.ok) ? <Vazio texto="Nenhuma integração respondeu ainda." /> : null}
    </div>
  )
}

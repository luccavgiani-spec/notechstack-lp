import { useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { SeletorPeriodo } from './MarketingLayout'
import { custoPor, inteiro, numeroDecimal, reais, rotuloStatus, tomDoStatus } from './format'
import { type Bloco, type CampanhaResumo, marketing } from './marketing-service'
import { BlocoIndisponivel, Carregando, Erro, Secao, Selo, Vazio, botaoPrimario, tabela, td, tdNum, th } from './ui'
import { useDados } from './useDados'

function TabelaCampanhas({ bloco, nome, periodo }: { bloco: Bloco<CampanhaResumo[]> | null; nome: string; periodo: string }) {
  if (!bloco) return null
  if (!bloco.ok) return <BlocoIndisponivel bloco={bloco} nome={nome} />
  if (!bloco.dados.length) return <Vazio texto={`Nenhuma campanha ${nome} ainda.`} />
  return (
    <div className="overflow-x-auto">
      <table className={`${tabela} min-w-[760px]`}>
        <caption className="sr-only">Campanhas {nome} no período</caption>
        <thead><tr>
          <th className={th}>Campanha</th><th className={th}>Status</th><th className={th}>Tipo</th>
          <th className={`${th} text-right`}>Orçamento</th><th className={`${th} text-right`}>Gasto</th>
          <th className={`${th} text-right`}>Cliques</th><th className={`${th} text-right`}>Leads / conv.</th><th className={`${th} text-right`}>Custo por lead</th>
        </tr></thead>
        <tbody>
          {bloco.dados.map((c) => (
            <tr key={c.id}>
              <th scope="row" className={`${td} font-normal`}>
                <Link className="font-semibold text-azul underline" to={`/no/marketing/campanhas/${c.plataforma}/${c.id}?periodo=${encodeURIComponent(periodo)}`}>{c.nome}</Link>
                <span className="block font-mono text-[0.625rem] text-cinza">id {c.id}</span>
              </th>
              <td className={td}><Selo texto={rotuloStatus(c.status_efetivo ?? c.status)} tom={tomDoStatus(c.status_efetivo ?? c.status)} /></td>
              <td className={`${td} font-mono text-xs`}>{c.objetivo ?? '—'}</td>
              <td className={tdNum}>
                {c.orcamento_diario_centavos !== null ? `${reais(c.orcamento_diario_centavos)}/dia` : c.orcamento_total_centavos !== null ? `${reais(c.orcamento_total_centavos)} total` : 'no conjunto'}
              </td>
              <td className={tdNum}>{reais(c.metricas.gasto_centavos)}</td>
              <td className={tdNum}>{inteiro(c.metricas.cliques)}</td>
              <td className={tdNum}>{numeroDecimal(c.metricas.conversoes)}</td>
              <td className={tdNum}>{custoPor(c.metricas.gasto_centavos, c.metricas.conversoes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CampaignsPage() {
  const [params] = useSearchParams()
  const periodo = params.get('periodo') ?? '7d'
  const carregar = useCallback(() => marketing.campanhas(periodo), [periodo])
  const { dados, erro, carregando, recarregar } = useDados(carregar)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Campanhas</h1>
        <div className="flex flex-wrap gap-2">
          <Link to="/no/marketing/campanhas/nova/meta" className={botaoPrimario}>Nova campanha Meta</Link>
          <Link to="/no/marketing/campanhas/nova/google" className={botaoPrimario}>Nova campanha Google (Pesquisa)</Link>
        </div>
      </div>
      <p className="mt-2 text-sm text-cinza">Toda campanha nasce pausada. Ativar é um passo separado, com revisão.</p>
      <div className="mt-4"><SeletorPeriodo /></div>
      {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
      {!dados && carregando ? <Carregando texto="Buscando campanhas…" /> : null}
      {dados ? (
        <div className={`space-y-6 ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
          <Secao titulo="Meta Ads" rotulo={dados.periodo.rotulo} acento="bg-azul">
            <TabelaCampanhas bloco={dados.blocos.meta} nome="Meta" periodo={periodo} />
          </Secao>
          <Secao titulo="Google Ads" rotulo={dados.periodo.rotulo} acento="bg-verde">
            <TabelaCampanhas bloco={dados.blocos.google} nome="Google" periodo={periodo} />
          </Secao>
        </div>
      ) : null}
    </div>
  )
}

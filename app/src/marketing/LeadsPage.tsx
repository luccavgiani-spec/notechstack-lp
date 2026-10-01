import { useCallback, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { type Lead, marketing, novoRequestId } from './marketing-service'
import { SeletorPeriodo } from './MarketingLayout'
import { dataHora } from './format'
import { useDados } from './useDados'
import { Carregando, Erro, Vazio, botaoSecundario, tabela, td, th } from './ui'
const CLASSES = [['real', 'Real'], ['teste', 'Teste'], ['invalido', 'Inválido'], ['duplicado', 'Duplicado']] as const
function LinhaLead({ lead }: { lead: Lead }) {
  const [classe, setClasse] = useState(lead.classe)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<unknown>(null)
  const pedido = useRef<{ classe: NonNullable<Lead['classe']>; request_id: string } | null>(null)
  async function classificar(nova: NonNullable<Lead['classe']>) {
    if (ocupado) return
    setOcupado(true); setErro(null)
    if (pedido.current?.classe !== nova) pedido.current = { classe: nova, request_id: novoRequestId() }
    try {
      const resultado = await marketing.classificarLead(lead.id, pedido.current)
      if (resultado.status !== 'ok') throw new Error(resultado.erro ?? 'Não foi possível classificar o lead.')
      setClasse(nova); pedido.current = null
    } catch (e) { setErro(e) }
    finally { setOcupado(false) }
  }
  return <tr>
    <td className={td}>{dataHora(lead.criado_em)}</td><td className={td}>{lead.canal}</td>
    <td className={td}>{lead.nome ?? '—'}</td><td className={td}>{lead.email ?? '—'}</td>
    <td className={td}><span role="status">{CLASSES.find(([id]) => id === classe)?.[1] ?? 'a classificar'}</span></td>
    <td className={td}><div className="flex flex-wrap gap-2">{CLASSES.map(([id, rotulo]) => <button key={id} type="button" className={botaoSecundario} disabled={ocupado} onClick={() => void classificar(id)}>{rotulo}</button>)}</div>{erro ? <Erro erro={erro} /> : null}</td>
  </tr>
}
export function LeadsPage() {
  const [params] = useSearchParams()
  const periodo = params.get('periodo') ?? '7d'
  const carregar = useCallback(() => marketing.leads(periodo), [periodo])
  const { dados, erro, carregando, recarregar } = useDados(carregar)
  return <div className="space-y-5">
    <h1 className="text-3xl font-extrabold">Leads</h1><SeletorPeriodo />
    {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}{carregando ? <Carregando /> : null}
    {dados && !dados.leads.length ? <Vazio texto="Nenhum lead no período." /> : null}
    {dados?.leads.length ? <div className="overflow-x-auto"><table className={tabela}>
      <caption className="sr-only">Leads do período</caption><thead><tr>{['Data', 'Canal', 'Nome', 'E-mail', 'Classe atual', 'Classificar'].map(t => <th className={th} key={t}>{t}</th>)}</tr></thead>
      <tbody>{dados.leads.map(l => <LinhaLead key={`${periodo}:${l.id}:${l.classe}`} lead={l} />)}</tbody>
    </table></div> : null}
  </div>
}

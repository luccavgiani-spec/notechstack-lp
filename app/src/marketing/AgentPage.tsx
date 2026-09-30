import { useCallback, useState, type FormEvent } from 'react'
import { dataHora } from './format'
import { type Agente, marketing } from './marketing-service'
import { Carregando, Erro, PainelRevisao, Rotulo, Secao, Selo, Vazio, botaoPrimario, campo, tabela, td, th } from './ui'
import { useDados } from './useDados'
import { useRevisao } from './useRevisao'

// Só NO_ADMIN com aal2 (a marketing-hub recusa o resto). Desligar é o corte imediato
// do risco aceito em C1 = (a): a conta é banida e qualquer chamada dela passa a ser 401.
export function AgentPage() {
  const carregar = useCallback(() => marketing.agentes(), [])
  const { dados, erro, carregando, recarregar } = useDados(carregar)
  const fluxo = useRevisao()
  const [email, setEmail] = useState('')

  function convidar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    fluxo.revisar({
      titulo: 'Criar a conta do dot',
      itens: [
        ['E-mail da conta do dot', email.trim().toLowerCase()],
        ['Papel', 'MARKETING_AGENT — só o planner de marketing'],
        ['Senha', 'definida por quem abrir o link de convite'],
      ],
      aviso: 'Abra o link no navegador do dot (ou numa janela anônima). Se abrir no seu navegador, a sua sessão vira a do dot.',
      executar: (request_id) => marketing.convidarDot({ request_id, email: email.trim() }),
      aoConcluir: () => {
        setEmail('')
        recarregar()
      },
    })
  }

  function alternar(a: Agente) {
    fluxo.revisar({
      titulo: a.banido ? 'Religar o dot' : 'Desligar o dot',
      itens: [['Conta', a.email ?? a.id], ['Ação', a.banido ? 'RELIGAR — volta a entrar e operar' : 'DESLIGAR — corta o acesso agora']],
      executar: (request_id) => (a.banido ? marketing.religarDot({ request_id, user_id: a.id }) : marketing.desligarDot({ request_id, user_id: a.id })),
      aoConcluir: recarregar,
    })
  }

  const convite = fluxo.resultado?.acao.convite_link

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Dot</h1>
      <PainelRevisao fluxo={fluxo} />
      {convite ? (
        <Secao titulo="Link de convite do dot" acento="bg-ambar">
          <p className="text-sm">Vale uma vez. Não cole em chat nem em arquivo: abra direto no navegador do dot para ele criar a senha.</p>
          <input readOnly className={`${campo} mt-2 font-mono text-xs`} value={convite} aria-label="Link de convite (abrir no navegador do dot)" onFocus={(e) => e.target.select()} />
        </Secao>
      ) : null}
      <Secao titulo="Contas do dot" acento="bg-ambar">
        {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
        {!dados && carregando ? <Carregando /> : null}
        {dados && !dados.agentes.length ? <Vazio texto="Nenhuma conta de dot ainda." /> : null}
        {dados?.agentes.length ? (
          <div className="overflow-x-auto">
            <table className={tabela}>
              <thead><tr><th className={th}>Conta</th><th className={th}>Situação</th><th className={th}>Último login</th><th className={th}>Ação</th></tr></thead>
              <tbody>
                {dados.agentes.map((a) => (
                  <tr key={a.id}>
                    <th scope="row" className={`${td} font-normal`}>{a.email}<span className="block font-mono text-[0.625rem] text-cinza">{a.id}</span></th>
                    <td className={td}><Selo texto={a.banido ? 'Desligado' : 'Ligado'} tom={a.banido ? 'erro' : 'ok'} /></td>
                    <td className={td}>{dataHora(a.ultimo_login)}</td>
                    <td className={td}>
                      <button type="button" className={`text-sm font-semibold underline ${a.banido ? 'text-verde' : 'text-vermelho'}`} onClick={() => alternar(a)}>
                        {a.banido ? 'Religar dot' : 'Desligar dot'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Secao>
      {!fluxo.pedido ? (
        <form onSubmit={convidar}>
          <Secao titulo="Criar conta do dot" acento="bg-ambar">
            <div className="flex flex-wrap items-end gap-3">
              <Rotulo texto="E-mail da conta do dot"><input className={campo} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Rotulo>
              <button type="submit" className={botaoPrimario}>Revisar convite</button>
            </div>
          </Secao>
        </form>
      ) : null}
    </div>
  )
}

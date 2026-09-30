import { useCallback, useState } from 'react'
import { dataHora, rotuloStatus, tomDoStatus } from './format'
import { type Acao, marketing } from './marketing-service'
import { Carregando, Erro, Secao, Selo, Vazio, botaoSecundario, tabela, td, th } from './ui'
import { useDados } from './useDados'

const AUTORES: Record<string, string> = { NO_ADMIN: 'Lucca', MARKETING_AGENT: 'dot', SISTEMA: 'Sistema (publicador)' }

function resumo(valor: unknown): string {
  if (valor === null || valor === undefined) return '—'
  const texto = JSON.stringify(valor)
  return texto.length > 400 ? `${texto.slice(0, 400)}…` : texto
}

export function LogPage() {
  const [autor, setAutor] = useState('todos')
  const carregar = useCallback(() => marketing.acoes(300), [])
  const { dados, erro, carregando, recarregar } = useDados(carregar)
  const acoes = (dados?.acoes ?? []).filter((a: Acao) => autor === 'todos' || a.actor_role === autor)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Registro de ações</h1>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm"><span className="mb-1 block font-semibold">Quem fez</span>
            <select className="rounded-xl border border-borda bg-white px-3 py-2 text-sm" value={autor} onChange={(e) => setAutor(e.target.value)}>
              <option value="todos">Todos</option><option value="NO_ADMIN">Lucca</option><option value="MARKETING_AGENT">dot</option><option value="SISTEMA">Sistema</option>
            </select>
          </label>
          <button type="button" className={botaoSecundario} onClick={recarregar}>Atualizar registro</button>
        </div>
      </div>
      <Secao titulo="Toda escrita do planner" rotulo="Quem, quando, o quê e o resultado" acento="bg-ambar">
        {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
        {!dados && carregando ? <Carregando /> : null}
        {dados && !acoes.length ? <Vazio texto="Nenhuma ação registrada ainda." /> : null}
        {acoes.length ? (
          <div className="overflow-x-auto">
            <table className={`${tabela} min-w-[900px]`}>
              <caption className="sr-only">Registro de ações do planner, mais recentes primeiro</caption>
              <thead><tr><th className={th}>Quando</th><th className={th}>Quem</th><th className={th}>Ação</th><th className={th}>Alvo</th><th className={th}>Status</th><th className={th}>Ids externos</th><th className={th}>Detalhe</th></tr></thead>
              <tbody>
                {acoes.map((a) => (
                  <tr key={a.id}>
                    <td className={`${td} whitespace-nowrap`}>{dataHora(a.created_at)}</td>
                    <td className={td}>{AUTORES[a.actor_role] ?? a.actor_role}</td>
                    <td className={`${td} font-mono text-xs`}>{a.kind}</td>
                    <td className={`${td} font-mono text-xs`}>{a.target ?? '—'}</td>
                    <td className={td}><Selo texto={rotuloStatus(a.status)} tom={tomDoStatus(a.status)} /></td>
                    <td className={`${td} font-mono text-xs`}>{a.external_ids ? Object.entries(a.external_ids).map(([k, v]) => `${k}: ${v}`).join('\n') : '—'}</td>
                    <td className={`${td} max-w-sm`}>
                      {a.error ? <p className="text-vermelho">{a.error}</p> : null}
                      <details><summary className="cursor-pointer text-xs text-cinza">payload e resultado</summary>
                        <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-[0.6875rem]">pedido: {resumo(a.payload)}{'\n'}resultado: {resumo(a.result)}{'\n'}registro: {a.id} · request_id {a.request_id}</pre>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Secao>
    </div>
  )
}

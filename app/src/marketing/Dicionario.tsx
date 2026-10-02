import { DEFINICOES, type IdMetrica } from './definicoes'
import { DESCRICAO_ESTADO, ROTULO_ESTADO } from './estados'
import type { EstadoMetrica } from './marketing-service'
import { Secao } from './ui'

const CAMPOS = [
  ['origem', 'Campo de origem'],
  ['unidade', 'Unidade'],
  ['escopo', 'Escopo'],
  ['formula', 'Fórmula'],
  ['janela', 'Janela'],
  ['limitacoes', 'Limitações'],
] as const

const ESTADOS: EstadoMetrica[] = ['zero', 'indisponivel', 'sem_permissao', 'parcial', 'atrasado', 'erro']

// Texto sempre visível (sem hover nem clique), para o Lucca e para o dot.
export function Dicionario({ metricas }: { metricas: IdMetrica[] }) {
  return (
    <Secao titulo="Dicionário de métricas" rotulo="O que cada número significa" acento="bg-tinta">
      <div className="grid gap-4 lg:grid-cols-2">
        {metricas.map((id) => {
          const d = DEFINICOES[id]
          return (
            <article key={id} aria-label={d.nome} className="rounded-xl border border-borda p-3">
              <h3 className="text-sm font-semibold">{d.nome}</h3>
              <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[minmax(0,7.5rem)_1fr]">
                {CAMPOS.map(([campo, rotulo]) => (
                  <div key={campo} className="contents">
                    <dt className="font-semibold text-cinza">{rotulo}</dt>
                    <dd className="break-words">{d[campo]}</dd>
                  </div>
                ))}
              </dl>
            </article>
          )
        })}
      </div>
      <article aria-label="Estados de uma métrica" className="mt-4 rounded-xl border border-borda p-3">
        <h3 className="text-sm font-semibold">Estados de uma métrica</h3>
        <p className="mt-1 text-xs text-cinza">Quando um número não vem, a célula mostra "—" e o estado ao lado. "não calculável": divisão por zero. "não se aplica": a métrica não existe naquela plataforma.</p>
        <dl className="mt-2 grid gap-x-3 gap-y-1 text-xs sm:grid-cols-[minmax(0,7.5rem)_1fr]">
          {ESTADOS.map((e) => (
            <div key={e} className="contents">
              <dt className="font-semibold"><span className="font-mono">{ROTULO_ESTADO[e]}</span></dt>
              <dd>{DESCRICAO_ESTADO[e]}</dd>
            </div>
          ))}
        </dl>
      </article>
    </Secao>
  )
}

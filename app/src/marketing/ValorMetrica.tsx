import { ROTULO_ESTADO, SEM_VALOR } from './estados'
import type { EstadoMetrica } from './marketing-service'

type Numero = number | null | undefined

const vazio = (n: Numero): n is null | undefined => n === null || n === undefined

function Rotulo({ estado }: { estado: EstadoMetrica }) {
  return <span className="ml-1.5 whitespace-nowrap font-mono text-[0.6875rem] font-normal text-cinza">{ROTULO_ESTADO[estado]}</span>
}

// Componente único de métrica + estado (T2 critério 9): número sem valor sempre
// diz por quê, e um 0 só aparece quando a plataforma devolveu zero.
export function ValorMetrica({ valor, estado, formatar }: { valor: Numero; estado?: EstadoMetrica; formatar: (n: number) => string }) {
  const semValor = vazio(valor) || (estado !== undefined && SEM_VALOR.includes(estado))
  const efetivo: EstadoMetrica = semValor
    ? (estado && estado !== 'disponivel' && estado !== 'zero' ? estado : 'indisponivel')
    : (estado ?? (valor === 0 ? 'zero' : 'disponivel'))
  return (
    <span data-estado={efetivo}>
      {semValor ? '—' : formatar(valor as number)}
      {efetivo === 'disponivel' ? null : <>{' '}<Rotulo estado={efetivo} /></>}
    </span>
  )
}

// Razão entre duas métricas (custo por resultado, LPV por clique). Denominador
// zero não vira "R$ 0,00" nem "—": a razão é "não calculável".
export function ValorRazao({ numerador, denominador, estadoNumerador, estadoDenominador, formatar }: {
  numerador: Numero
  denominador: Numero
  estadoNumerador?: EstadoMetrica
  estadoDenominador?: EstadoMetrica
  formatar: (n: number) => string
}) {
  const faltaDenominador = vazio(denominador) || (estadoDenominador !== undefined && SEM_VALOR.includes(estadoDenominador))
  if (faltaDenominador) return <ValorMetrica valor={null} estado={estadoDenominador} formatar={formatar} />
  if (denominador === 0) return <span data-estado="nao_calculavel">não calculável</span>
  const faltaNumerador = vazio(numerador) || (estadoNumerador !== undefined && SEM_VALOR.includes(estadoNumerador))
  if (faltaNumerador) return <ValorMetrica valor={null} estado={estadoNumerador} formatar={formatar} />
  const estados = [estadoNumerador, estadoDenominador]
  const estado = estados.find((e) => e === 'parcial') ?? estados.find((e) => e === 'atrasado')
  return <ValorMetrica valor={(numerador as number) / (denominador as number)} estado={estado} formatar={formatar} />
}

// Métrica que não existe naquela plataforma (ex.: LPV no Google Ads).
export function NaoSeAplica() {
  return <span data-estado="nao_se_aplica" className="text-cinza">não se aplica</span>
}

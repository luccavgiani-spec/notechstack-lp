import { useEffect, useId, useRef, useState } from 'react'
import { ROTULO_ESTADO, SEM_VALOR } from './estados'
import type { EstadoMetrica } from './marketing-service'
import { dataCompleta, dataCurta } from './format'

// Série única por gráfico (o título diz o que é; sem legenda). Colunas ≤ 24px,
// topo arredondado 4px, grade hairline, rótulo só no máximo e tooltip por coluna
// no hover e no foco. Os mesmos números estão sempre na tabela ao lado.

type Ponto = { dia: string; valor: number }

const H = 180
const M = { topo: 18, base: 22, esq: 58, dir: 8 }
const COR = '#3D63DB'

// Desenha na largura real do contêiner: no celular as fontes continuam legíveis
// e a coluna continua com no máximo 24px de verdade.
function useLargura(padrao = 640) {
  const ref = useRef<HTMLDivElement>(null)
  const [largura, setLargura] = useState(padrao)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(([e]) => setLargura(Math.max(260, Math.round(e.contentRect.width))))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, largura] as const
}

function tetoRedondo(max: number): number {
  if (max <= 0) return 1
  const ordem = 10 ** Math.floor(Math.log10(max))
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * ordem).find((p) => p * 3 >= max) ?? ordem * 10
  return passo * 3
}

function colunaArredondada(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h)
  return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${y + h} Z`
}

export function ColunasDiarias({ titulo, serie, formatar, formatarEixo = formatar, estado }: {
  estado?: EstadoMetrica
  titulo: string
  serie: Ponto[]
  formatar: (valor: number) => string
  formatarEixo?: (valor: number) => string
}) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const idTitulo = useId()
  const [ref, W] = useLargura()
  if (!serie.length) return null
  if (estado && SEM_VALOR.includes(estado)) return <p>{titulo}: — {ROTULO_ESTADO[estado]}</p>

  const teto = tetoRedondo(Math.max(...serie.map((p) => p.valor)))
  const larguraUtil = W - M.esq - M.dir
  const alturaUtil = H - M.topo - M.base
  const faixa = larguraUtil / serie.length
  const coluna = Math.max(2, Math.min(24, faixa - 2))
  const y = (v: number) => M.topo + alturaUtil - (v / teto) * alturaUtil
  const iMax = serie.reduce((m, p, i) => (p.valor > serie[m].valor ? i : m), 0)
  const marcasX = [...new Set(W < 420 ? [0, serie.length - 1] : [0, Math.floor((serie.length - 1) / 2), serie.length - 1])]
  const pontoAtivo = ativo === null ? null : serie[ativo]

  return (
    <figure ref={ref} className="relative" aria-labelledby={idTitulo}>
      <figcaption id={idTitulo} className="mb-2 text-sm font-semibold">{titulo}{estado && estado !== "disponivel" ? ` · ${ROTULO_ESTADO[estado]}` : ""}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="block max-w-full" role="img" aria-label={`${titulo}: gráfico de colunas por dia; valores na tabela`}>
        {[0, 1, 2, 3].map((k) => {
          const v = (teto / 3) * k
          return (
            <g key={k}>
              <line x1={M.esq} x2={W - M.dir} y1={y(v)} y2={y(v)} stroke="#ECEBE6" strokeWidth={1} />
              <text x={M.esq - 6} y={y(v) + 4} textAnchor="end" className="fill-cinza font-mono text-[10px]">{formatarEixo(v)}</text>
            </g>
          )
        })}
        {serie.map((p, i) => {
          const x = M.esq + faixa * i + (faixa - coluna) / 2
          const altura = Math.max(0, y(0) - y(p.valor))
          return (
            <g
              key={p.dia}
              tabIndex={0}
              role="button"
              aria-label={`${dataCompleta(p.dia)}: ${formatar(p.valor)}`}
              onPointerEnter={() => setAtivo(i)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
              className="cursor-default outline-none"
            >
              <rect x={M.esq + faixa * i} y={M.topo} width={faixa} height={alturaUtil} fill="transparent" />
              {altura > 0 ? (
                <path d={colunaArredondada(x, y(p.valor), coluna, altura)} fill={COR} opacity={ativo === null || ativo === i ? 1 : 0.55} />
              ) : null}
              {i === iMax && p.valor > 0 ? (
                <text x={x + coluna / 2} y={y(p.valor) - 5} textAnchor="middle" className="fill-tinta font-mono text-[10px]">{formatar(p.valor)}</text>
              ) : null}
            </g>
          )
        })}
        {marcasX.map((i) => (
          <text key={i} x={M.esq + faixa * i + faixa / 2} y={H - 6} textAnchor="middle" className="fill-cinza font-mono text-[10px]">
            {dataCurta(serie[i].dia)}
          </text>
        ))}
      </svg>
      {pontoAtivo && ativo !== null ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-6 -translate-x-1/2 rounded-lg border border-borda bg-white px-3 py-2 text-xs shadow-card"
          style={{ left: `${((M.esq + faixa * ativo + faixa / 2) / W) * 100}%` }}
        >
          <strong className="block text-sm tabular-nums">{formatar(pontoAtivo.valor)}</strong>
          <span className="text-cinza">{dataCompleta(pontoAtivo.dia)}</span>
        </div>
      ) : null}
    </figure>
  )
}

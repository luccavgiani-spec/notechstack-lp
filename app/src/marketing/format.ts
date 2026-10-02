const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const numero = new Intl.NumberFormat('pt-BR')
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })
const porcento = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 })

const moedaCompacta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export const reais = (centavos: number | null | undefined) => (centavos === null || centavos === undefined ? '—' : moeda.format(centavos / 100))
// Eixo de gráfico: sem centavos, para caber na margem.
export const reaisEixo = (centavos: number) => moedaCompacta.format(centavos / 100)
export const inteiro = (n: number | null | undefined) => (n === null || n === undefined ? '—' : numero.format(n))
export const numeroDecimal = (n: number | null | undefined) => (n === null || n === undefined ? '—' : decimal.format(n))
export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '—' : porcento.format(n))

export function custoPor(centavos: number, quantidade: number): string {
  return quantidade > 0 ? reais(Math.round(centavos / quantidade)) : '—'
}

// Datas do planner sempre em São Paulo.
export function dataCurta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}`
}

export function dataCompleta(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

// Título do período: o intervalo personalizado já é o próprio rótulo.
export function tituloPeriodo(p: { rotulo: string; de: string; ate: string }): string {
  const faixa = `${dataCompleta(p.de)} a ${dataCompleta(p.ate)}`
  return p.rotulo === faixa ? faixa : `${p.rotulo}: ${faixa}`
}

export function dataHora(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
}

export function hojeSaoPaulo(agora = new Date()): string {
  return new Date(agora.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

// <input type="datetime-local"> em São Paulo ↔ ISO UTC.
export function localParaIso(valor: string): string {
  return valor ? new Date(`${valor}:00-03:00`).toISOString() : ''
}

export function isoParaLocal(iso: string): string {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 16)
}

export function centavosDeReais(valor: string): number | null {
  const limpo = valor.trim().replace(/\s|R\$/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')
  if (!limpo) return null
  const n = Number(limpo)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

export const ROTULO_STATUS: Record<string, string> = {
  ACTIVE: 'Ativa',
  ENABLED: 'Ativa',
  PAUSED: 'Pausada',
  CAMPAIGN_PAUSED: 'Pausada (campanha)',
  ADSET_PAUSED: 'Pausada (conjunto)',
  IN_PROCESS: 'Em análise',
  WITH_ISSUES: 'Com problema',
  DISAPPROVED: 'Reprovada',
  PENDING_REVIEW: 'Em revisão',
  REMOVED: 'Removida',
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
  draft: 'Rascunho',
  executando: 'Executando',
  ok: 'Concluída',
  erro: 'Erro',
}

export const rotuloStatus = (s: string | null | undefined) => (s ? ROTULO_STATUS[s] ?? s : '—')

export function tomDoStatus(status: string | null | undefined): 'neutro' | 'ok' | 'alerta' | 'erro' {
  if (!status) return 'neutro'
  if (['ACTIVE', 'ENABLED', 'published', 'ok'].includes(status)) return 'ok'
  if (['PAUSED', 'scheduled', 'publishing', 'executando', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED', 'IN_PROCESS', 'PENDING_REVIEW'].includes(status)) return 'alerta'
  if (['failed', 'erro', 'DISAPPROVED', 'WITH_ISSUES'].includes(status)) return 'erro'
  return 'neutro'
}

// Sintaxe do próprio Google Ads: [exata], "frase", ampla sem marcação.
export function lerPalavras(texto: string) {
  return texto.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
    if (/^\[.+\]$/.test(l)) return { texto: l.slice(1, -1).trim(), correspondencia: 'EXACT' as const }
    if (/^".+"$/.test(l)) return { texto: l.slice(1, -1).trim(), correspondencia: 'PHRASE' as const }
    return { texto: l, correspondencia: 'BROAD' as const }
  })
}

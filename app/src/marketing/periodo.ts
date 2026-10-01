import { dataCompleta } from './format'

// O período vive só na URL (`?periodo=`), e todo link do menu o leva junto:
// sem isso, trocar de tela voltava para 7 dias (falha de 30/09).
export function comPeriodo(caminho: string, periodo: string | null): string {
  return periodo ? `${caminho}?periodo=${encodeURIComponent(periodo)}` : caminho
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const MAX_DIAS = 366

const dataValida = (d: string) => {
  if (!DATA_ISO.test(d)) return false
  const data = new Date(`${d}T12:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === d
}
const diasEntre = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000) + 1

// Mesmas regras de parsePeriodo na marketing-hub, ditas antes de qualquer requisição.
export function erroDoPeriodo(de: string, ate: string, hoje: string): string | null {
  if (!dataValida(de) || !dataValida(ate)) return 'Preencha De e Até com datas completas (dia, mês e ano).'
  if (de > ate) return 'De precisa ser igual ou anterior a Até.'
  if (ate > hoje) return `Até não pode ser depois de hoje (${dataCompleta(hoje)}).`
  if (diasEntre(de, ate) > MAX_DIAS) return `O intervalo pode ter no máximo ${MAX_DIAS} dias.`
  return null
}

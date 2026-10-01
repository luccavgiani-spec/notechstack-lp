import type { Bloco, EstadoMetrica } from './marketing-service'

// Rótulos em texto do estado de uma métrica (T2 critério 9). O valor literal
// do enum também vai no atributo data-estado, para leitura estável pelo dot.
export const ROTULO_ESTADO: Record<EstadoMetrica, string> = {
  disponivel: 'disponível',
  zero: 'zero',
  indisponivel: 'indisponível',
  sem_permissao: 'sem permissão',
  parcial: 'parcial',
  atrasado: 'atrasado',
  erro: 'erro',
}

export const DESCRICAO_ESTADO: Record<EstadoMetrica, string> = {
  disponivel: 'a plataforma devolveu o número.',
  zero: 'a plataforma devolveu zero; é zero de verdade, não falta de dado.',
  indisponivel: 'a plataforma não devolveu este número, ou a integração não está configurada.',
  sem_permissao: 'a plataforma recusou a leitura por falta de permissão do token.',
  parcial: 'parte das consultas do bloco falhou; o número pode estar incompleto.',
  atrasado: 'o período inclui hoje (no Search Console, os últimos 3 dias); o número ainda vai mudar.',
  erro: 'a leitura falhou; o motivo está no aviso do bloco.',
}

// Estados em que nenhum número é mostrado, mesmo que a resposta traga um.
export const SEM_VALOR: readonly EstadoMetrica[] = ['indisponivel', 'sem_permissao', 'erro']

// Bloco que não respondeu: todas as métricas dele herdam o estado do bloco.
export function estadoDoBloco(bloco: Bloco<unknown>): EstadoMetrica | undefined {
  if (bloco.ok) return undefined
  if (bloco.motivo === 'sem_permissao') return 'sem_permissao'
  if (bloco.motivo === 'nao_configurado') return 'indisponivel'
  return 'erro'
}

export function estadoDe(bloco: Bloco<unknown>, campo: string): EstadoMetrica | undefined {
  return bloco.ok ? bloco.estados?.[campo] : estadoDoBloco(bloco)
}

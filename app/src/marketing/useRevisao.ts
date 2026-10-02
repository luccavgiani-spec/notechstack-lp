import { useState } from 'react'
import { ErroHub, type ResultadoAcao, novoRequestId } from './marketing-service'
import type { ItemRevisao } from './ui'

export type Pedido = {
  titulo: string
  itens: ItemRevisao[]
  aviso?: string
  executar: (requestId: string) => Promise<ResultadoAcao>
  aoConcluir?: (resultado: ResultadoAcao) => void
  link?: (resultado: ResultadoAcao) => { href: string; texto: string } | null
}

// O request_id nasce quando a revisão abre: confirmar de novo (duplo clique,
// rede caiu) repete o mesmo id e o servidor não executa duas vezes.
// Voltar e editar gera um id novo na próxima revisão.
export function useRevisao() {
  const [pedido, setPedido] = useState<(Pedido & { requestId: string }) | null>(null)
  const [executando, setExecutando] = useState(false)
  const [erro, setErro] = useState<unknown>(null)
  const [resultado, setResultado] = useState<{ acao: ResultadoAcao; titulo: string; link: { href: string; texto: string } | null } | null>(null)

  async function confirmar() {
    if (!pedido || executando) return
    setExecutando(true)
    setErro(null)
    try {
      const acao = await pedido.executar(pedido.requestId)
      setResultado({ acao, titulo: pedido.titulo, link: pedido.link?.(acao) ?? null })
      setPedido(null)
      pedido.aoConcluir?.(acao)
    } catch (e) {
      if (e instanceof ErroHub && e.acao) {
        setResultado({ acao: e.acao, titulo: pedido.titulo, link: null })
        setPedido(null)
      } else {
        setErro(e)
      }
    } finally {
      setExecutando(false)
    }
  }

  return {
    pedido,
    executando,
    erro,
    resultado,
    revisar: (p: Pedido) => {
      setPedido({ ...p, requestId: novoRequestId() })
      setErro(null)
      setResultado(null)
    },
    voltar: () => {
      setPedido(null)
      setErro(null)
    },
    confirmar,
    fecharResultado: () => setResultado(null),
  }
}

export type FluxoRevisao = ReturnType<typeof useRevisao>

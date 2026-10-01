import { useEffect, useState } from 'react'

type Estado<T> = { fonte: unknown; versao: number; dados?: T; erro?: unknown }

// `carregar` precisa ser estável (useCallback). Enquanto recarrega, os dados
// anteriores continuam na tela: sem pulo de layout entre um período e outro.
export function useDados<T>(carregar: () => Promise<T>) {
  const [versao, setVersao] = useState(0)
  const [estado, setEstado] = useState<Estado<T> | null>(null)

  useEffect(() => {
    let vivo = true
    carregar().then(
      (dados) => { if (vivo) setEstado({ fonte: carregar, versao, dados }) },
      (erro: unknown) => { if (vivo) setEstado({ fonte: carregar, versao, erro }) },
    )
    return () => { vivo = false }
  }, [carregar, versao])

  const atual = estado?.fonte === carregar && estado.versao === versao
  return {
    carregando: !atual,
    dados: estado?.dados,
    erro: atual ? estado?.erro : undefined,
    recarregar: () => setVersao((v) => v + 1),
  }
}

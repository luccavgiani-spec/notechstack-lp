import { useId, useState, type ChangeEvent } from 'react'
import { enviarMidia } from './marketing-service'

// Sobe cada arquivo para o bucket privado assim que é escolhido e devolve o
// caminho no Storage. O dot usa o mesmo campo (input de arquivo com rótulo).
export function CampoMidia({ rotulo, aceita, multiplos = false, caminhos, onMudar }: {
  rotulo: string
  aceita: string
  multiplos?: boolean
  caminhos: string[]
  onMudar: (caminhos: string[]) => void
}) {
  const id = useId()
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  async function escolher(event: ChangeEvent<HTMLInputElement>) {
    const arquivos = [...(event.target.files ?? [])]
    event.target.value = ''
    if (!arquivos.length) return
    setEnviando(true)
    setErro('')
    try {
      const enviados: string[] = []
      for (const arquivo of arquivos) enviados.push(await enviarMidia(arquivo))
      onMudar(multiplos ? [...caminhos, ...enviados] : enviados.slice(0, 1))
    } catch {
      setErro('Não foi possível enviar o arquivo. Confira o formato (JPG, PNG, MP4 ou MOV, até 50 MB).')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="text-sm">
      <label htmlFor={id} className="mb-1 block font-semibold">{rotulo}</label>
      <input id={id} type="file" accept={aceita} multiple={multiplos} onChange={(e) => void escolher(e)} disabled={enviando}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border file:border-borda file:bg-white file:px-3 file:py-2 file:font-semibold" />
      {enviando ? <p role="status" className="mt-1 text-cinza">Enviando arquivo…</p> : null}
      {erro ? <p role="alert" className="mt-1 text-vermelho">{erro}</p> : null}
      {caminhos.length ? (
        <ul className="mt-2 space-y-1" aria-label="Arquivos enviados">
          {caminhos.map((c, i) => (
            <li key={c} className="flex items-center justify-between gap-2 rounded-lg bg-osso px-3 py-1.5">
              <span className="break-all font-mono text-xs">Arquivo {i + 1}: {c.split('/').pop()}</span>
              <button type="button" className="text-xs font-semibold underline" onClick={() => onMudar(caminhos.filter((x) => x !== c))}>Remover arquivo {i + 1}</button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

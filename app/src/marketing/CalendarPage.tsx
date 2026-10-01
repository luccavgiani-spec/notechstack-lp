import { useCallback, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CampoMidia } from './CampoMidia'
import { dataCompleta, dataHora, hojeSaoPaulo, localParaIso, rotuloStatus, somarDias, tomDoStatus } from './format'
import { type PostAgendado, marketing } from './marketing-service'
import { Carregando, Erro, PainelRevisao, Rotulo, Secao, Selo, Vazio, botaoPrimario, botaoSecundario, campo, tabela, td, th } from './ui'
import { useDados } from './useDados'
import { type FluxoRevisao, useRevisao } from './useRevisao'

const TIPOS = {
  instagram: [
    ['feed_image', 'Imagem no feed (JPG)'],
    ['carousel', 'Carrossel (2 a 10 JPG)'],
    ['reel', 'Reel (MP4 ou MOV)'],
  ],
  facebook: [['fb_post', 'Post na Página (texto, imagem ou vídeo)']],
} as const

const ROTULO_TIPO: Record<string, string> = {
  feed_image: 'Imagem', carousel: 'Carrossel', reel: 'Reel', feed_video: 'Vídeo (reel)', fb_post: 'Post',
}

const diaDe = (iso: string) => hojeSaoPaulo(new Date(iso))

function Grade({ de, ate, posts }: { de: string; ate: string; posts: PostAgendado[] }) {
  const porDia = new Map<string, number>()
  for (const p of posts) if (p.status !== 'cancelled') porDia.set(diaDe(p.agendado_para), (porDia.get(diaDe(p.agendado_para)) ?? 0) + 1)
  const dias: string[] = []
  for (let d = de; d <= ate && dias.length < 70; d = somarDias(d, 1)) dias.push(d)
  const hoje = hojeSaoPaulo()
  return (
    <ol className="grid grid-cols-7 gap-1 text-xs" aria-label="Posts por dia">
      {dias.map((d) => (
        <li key={d} className={`min-h-12 rounded-lg border p-1 ${d === hoje ? 'border-ambar' : 'border-borda'} bg-white`}>
          <span className="font-mono text-[0.625rem] text-cinza">{d.slice(8, 10)}/{d.slice(5, 7)}</span>
          {porDia.get(d) ? <span className="mt-1 block font-semibold">{porDia.get(d)} post{porDia.get(d)! > 1 ? 's' : ''}</span> : null}
        </li>
      ))}
    </ol>
  )
}

function Agendar({ fluxo, recarregar }: { fluxo: FluxoRevisao; recarregar: () => void }) {
  const [rede, setRede] = useState<'instagram' | 'facebook'>('instagram')
  const [tipo, setTipo] = useState<string>('feed_image')
  const [legenda, setLegenda] = useState('')
  const [midias, setMidias] = useState<string[]>([])
  const [quando, setQuando] = useState('')
  const [aviso, setAviso] = useState('')

  const aceita = tipo === 'reel' ? 'video/mp4,video/quicktime' : rede === 'instagram' ? 'image/jpeg' : 'image/jpeg,image/png,video/mp4,video/quicktime'

  function revisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const faltas: string[] = []
    if (!quando) faltas.push('data e hora')
    if (rede === 'instagram' && !midias.length) faltas.push('mídia')
    if (tipo === 'carousel' && (midias.length < 2 || midias.length > 10)) faltas.push('2 a 10 imagens no carrossel')
    if (rede === 'facebook' && !midias.length && !legenda.trim()) faltas.push('texto ou mídia')
    if (faltas.length) {
      setAviso(`Falta: ${faltas.join(', ')}.`)
      return
    }
    setAviso('')
    const agendado_para = localParaIso(quando)
    fluxo.revisar({
      titulo: `Agendar post no ${rede === 'instagram' ? 'Instagram' : 'Facebook'}`,
      itens: [
        ['Rede', rede === 'instagram' ? 'Instagram da nó' : 'Página da nó no Facebook'],
        ['Formato', ROTULO_TIPO[tipo] ?? tipo],
        ['Quando', `${dataHora(agendado_para)} (sai em até 5 minutos depois)`],
        ['Legenda', legenda || '(sem legenda)'],
        ['Mídias', midias.map((m) => m.split('/').pop()).join('\n') || '(nenhuma)'],
      ],
      aviso: 'Isto é publicação real na conta da nó no horário marcado. Dá para cancelar aqui até ela sair.',
      executar: (request_id) => marketing.agendarPost({ request_id, rede, tipo, legenda, midias, agendado_para }),
      aoConcluir: () => {
        setLegenda('')
        setMidias([])
        setQuando('')
        recarregar()
      },
    })
  }

  return (
    <form onSubmit={revisar} noValidate aria-label="Formulário para agendar post">
      <Secao titulo="Agendar post" acento="bg-vermelho">
        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="text-sm">
            <legend className="mb-1 font-semibold">Rede</legend>
            <label className="mr-4"><input type="radio" name="rede" checked={rede === 'instagram'} onChange={() => { setRede('instagram'); setTipo('feed_image'); setMidias([]) }} /> Instagram</label>
            <label><input type="radio" name="rede" checked={rede === 'facebook'} onChange={() => { setRede('facebook'); setTipo('fb_post'); setMidias([]) }} /> Facebook</label>
          </fieldset>
          <Rotulo texto="Formato">
            <select className={campo} value={tipo} onChange={(e) => { setTipo(e.target.value); setMidias([]) }}>
              {TIPOS[rede].map(([v, r]) => <option key={v} value={v}>{r}</option>)}
            </select>
          </Rotulo>
          <Rotulo texto="Legenda"><textarea className={`${campo} min-h-32`} maxLength={2200} value={legenda} onChange={(e) => setLegenda(e.target.value)} /></Rotulo>
          <div className="space-y-4">
            <CampoMidia rotulo={tipo === 'carousel' ? 'Imagens do carrossel' : 'Mídia do post'} aceita={aceita} multiplos={tipo === 'carousel'} caminhos={midias} onMudar={setMidias} />
            <Rotulo texto="Data e hora (horário de Brasília)"><input className={campo} type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} required /></Rotulo>
          </div>
        </div>
        {aviso ? <p role="alert" className="mt-4 rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-4 py-3 text-sm">{aviso}</p> : null}
        <button type="submit" className={`${botaoPrimario} mt-5`}>Revisar agendamento</button>
      </Secao>
    </form>
  )
}

export function CalendarPage() {
  const [params] = useSearchParams()
  const [hoje] = useState(() => hojeSaoPaulo())
  const de = params.get('de') ?? somarDias(hoje, -7)
  const ate = params.get('ate') ?? somarDias(hoje, 35)
  const carregar = useCallback(() => marketing.posts(de, ate), [de, ate])
  const { dados, erro, carregando, recarregar } = useDados(carregar)
  const fluxo = useRevisao()

  function cancelar(p: PostAgendado) {
    fluxo.revisar({
      titulo: 'Cancelar post agendado',
      itens: [
        ['Rede', p.rede === 'instagram' ? 'Instagram' : 'Facebook'],
        ['Formato', ROTULO_TIPO[p.tipo] ?? p.tipo],
        ['Agendado para', dataHora(p.agendado_para)],
        ['Legenda', p.legenda || '(sem legenda)'],
        ['Post', p.id],
      ],
      executar: (request_id) => marketing.cancelarPost(p.id, request_id),
      aoConcluir: recarregar,
    })
  }

  const posts = dados?.posts ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Calendário de posts</h1>
      <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Intervalo do calendário">
        <Link className={botaoSecundario} to={`?de=${somarDias(hoje, -7)}&ate=${somarDias(hoje, 35)}`}>Próximas 5 semanas</Link>
        <Link className={botaoSecundario} to={`?de=${somarDias(hoje, -30)}&ate=${hoje}`}>Últimos 30 dias</Link>
        <Link className={botaoSecundario} to={`?de=${somarDias(de, -35)}&ate=${somarDias(de, -1)}`}>← Anterior</Link>
        <Link className={botaoSecundario} to={`?de=${somarDias(ate, 1)}&ate=${somarDias(ate, 35)}`}>Seguinte →</Link>
      </div>
      <PainelRevisao fluxo={fluxo} />
      {!fluxo.pedido ? <Agendar fluxo={fluxo} recarregar={recarregar} /> : null}
      <Secao titulo={`Posts de ${dataCompleta(de)} a ${dataCompleta(ate)}`} acento="bg-vermelho">
        {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
        {!dados && carregando ? <Carregando texto="Buscando posts…" /> : null}
        {dados ? (
          <div className={`space-y-4 ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
            <Grade de={de} ate={ate} posts={posts} />
            {posts.length ? (
              <div className="overflow-x-auto">
                <table className={`${tabela} min-w-[760px]`}>
                  <caption className="sr-only">Posts agendados e publicados no intervalo</caption>
                  <thead><tr><th className={th}>Quando</th><th className={th}>Rede</th><th className={th}>Formato</th><th className={th}>Status</th><th className={th}>Legenda</th><th className={th}>Resultado</th><th className={th}>Ação</th></tr></thead>
                  <tbody>
                    {posts.map((p) => (
                      <tr key={p.id}>
                        <td className={`${td} whitespace-nowrap`}>{dataHora(p.agendado_para)}</td>
                        <td className={td}>{p.rede === 'instagram' ? 'Instagram' : 'Facebook'}</td>
                        <td className={td}>{ROTULO_TIPO[p.tipo] ?? p.tipo} · {p.midias.length} mídia(s)</td>
                        <td className={td}><Selo texto={rotuloStatus(p.status)} tom={tomDoStatus(p.status)} /></td>
                        <td className={`${td} max-w-xs whitespace-pre-wrap`}>{p.legenda || '—'}</td>
                        <td className={`${td} font-mono text-xs`}>
                          {p.id_externo ? `publicado ${dataHora(p.publicado_em)} · id ${p.id_externo}` : p.erro ?? '—'}
                          {p.criado_por_papel ? <span className="block text-cinza">agendado por {p.criado_por_papel === 'MARKETING_AGENT' ? 'dot' : 'Lucca'}</span> : null}
                        </td>
                        <td className={td}>
                          {p.status === 'scheduled' || p.status === 'draft'
                            ? <button type="button" className="text-sm font-semibold text-vermelho underline" onClick={() => cancelar(p)}>Cancelar post</button>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <Vazio texto="Nenhum post neste intervalo." />}
          </div>
        ) : null}
      </Secao>
    </div>
  )
}

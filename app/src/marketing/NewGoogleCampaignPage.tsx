import { useCallback, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { centavosDeReais, lerPalavras, reais } from './format'
import { marketing } from './marketing-service'
import { Erro, PainelRevisao, Rotulo, Secao, botaoPrimario, botaoSecundario, campo } from './ui'
import { useDados } from './useDados'
import { useRevisao } from './useRevisao'

const ESTRATEGIAS = [
  ['MAXIMIZE_CLICKS', 'Maximizar cliques'],
  ['MAXIMIZE_CONVERSIONS', 'Maximizar conversões'],
  ['MANUAL_CPC', 'CPC manual'],
] as const

const BRASIL = { id: '2076', nome: 'Brasil' }
const PORTUGUES = '1014'

const linhas = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean)

export function NewGoogleCampaignPage() {
  const fluxo = useRevisao()
  const carregarConfig = useCallback(() => marketing.configuracao(), [])
  const config = useDados(carregarConfig)
  const [nome, setNome] = useState('')
  const [valor, setValor] = useState('')
  const [estrategia, setEstrategia] = useState<string>('MAXIMIZE_CLICKS')
  const [cpc, setCpc] = useState('')
  const [locais, setLocais] = useState([BRASIL])
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<{ id: string; nome: string; tipo: string }[]>([])
  const [erroBusca, setErroBusca] = useState<unknown>(null)
  const [grupo, setGrupo] = useState('Grupo 1')
  const [palavras, setPalavras] = useState('')
  const [titulos, setTitulos] = useState('')
  const [descricoes, setDescricoes] = useState('')
  const [url, setUrl] = useState('https://www.notechstack.com.br/')
  const [caminho1, setCaminho1] = useState('')
  const [caminho2, setCaminho2] = useState('')
  const [aviso, setAviso] = useState('')

  async function buscar() {
    setErroBusca(null)
    try {
      setSugestoes((await marketing.locaisGoogle(busca)).locais)
    } catch (e) {
      setErroBusca(e)
    }
  }

  function revisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const orcamento = centavosDeReais(valor)
    const cpcMax = cpc ? centavosDeReais(cpc) : null
    const kws = lerPalavras(palavras)
    const hs = linhas(titulos)
    const ds = linhas(descricoes)
    const faltas: string[] = []
    if (nome.trim().length < 3) faltas.push('nome')
    if (orcamento === null) faltas.push('orçamento diário')
    if (estrategia === 'MANUAL_CPC' && cpcMax === null) faltas.push('CPC máximo')
    if (!locais.length) faltas.push('local')
    if (!kws.length) faltas.push('palavras-chave')
    if (hs.length < 3 || hs.length > 15 || hs.some((h) => h.length > 30)) faltas.push('títulos (3 a 15, até 30 caracteres cada)')
    if (ds.length < 2 || ds.length > 4 || ds.some((d) => d.length > 90)) faltas.push('descrições (2 a 4, até 90 caracteres cada)')
    if (faltas.length) {
      setAviso(`Confira: ${faltas.join(', ')}.`)
      return
    }
    setAviso('')
    const corpo = {
      nome: nome.trim(),
      orcamento_diario_centavos: orcamento,
      lances: { estrategia, cpc_max_centavos: cpcMax },
      locais: locais.map((l) => l.id),
      idiomas: [PORTUGUES],
      grupo: { nome: grupo.trim() || 'Grupo 1' },
      palavras_chave: kws,
      anuncio: { titulos: hs, descricoes: ds, url_final: url.trim(), caminho1: caminho1.trim(), caminho2: caminho2.trim() },
    }
    fluxo.revisar({
      titulo: 'Criar campanha Google de Pesquisa',
      itens: [
        ['Plataforma', 'Google Ads — rede de Pesquisa'],
        ['Nome', corpo.nome],
        ['Status ao criar', 'PAUSADA — nada é veiculado nem gasto até ativar'],
        ['Orçamento diário', reais(orcamento)],
        ['Lances', `${ESTRATEGIAS.find(([v]) => v === estrategia)?.[1]}${cpcMax ? ` · CPC máx. ${reais(cpcMax)}` : ''}`],
        ['Locais', locais.map((l) => `${l.nome} (${l.id})`).join('; ')],
        ['Idioma', 'Português'],
        ['Grupo', corpo.grupo.nome],
        ['Palavras-chave', kws.map((k) => `${k.texto} [${k.correspondencia}]`).join('\n')],
        ['Títulos', hs.join('\n')],
        ['Descrições', ds.join('\n')],
        ['URL final', corpo.anuncio.url_final],
        ['Caminho exibido', [corpo.anuncio.caminho1, corpo.anuncio.caminho2].filter(Boolean).join('/') || '—'],
      ],
      aviso: 'Nasce PAUSADA, numa só operação: se o Google recusar qualquer parte, nada é criado.',
      executar: (request_id) => marketing.criarCampanhaGoogle({ request_id, ...corpo }),
      link: (r) => (typeof r.resultado?.link === 'string' ? { href: r.resultado.link, texto: 'Abrir no Google Ads' } : null),
    })
  }

  const bloqueada = config.dados && !config.dados.google.criacao_liberada
  const criada = fluxo.resultado?.acao.ids_externos?.campaign_id

  return (
    <div className="space-y-6">
      <p className="text-sm"><Link className="text-azul underline" to="/no/marketing/campanhas">← Campanhas</Link></p>
      <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Nova campanha Google (Pesquisa)</h1>
      {bloqueada ? (
        <p role="note" className="rounded-xl border border-dashed border-borda bg-osso px-4 py-3 text-sm">
          A criação no Google Ads ainda está bloqueada no servidor até a prova de acesso da API (V6). O formulário funciona, mas a execução vai recusar.
        </p>
      ) : null}
      <PainelRevisao fluxo={fluxo} />
      {criada ? <p className="text-sm"><Link className="font-semibold text-azul underline" to={`/no/marketing/campanhas/google/${criada}`}>Ver a campanha {criada} no planner</Link></p> : null}
      {!fluxo.pedido ? (
        <form onSubmit={revisar} noValidate className="space-y-6" aria-label="Formulário de nova campanha Google">
          <Secao titulo="Campanha" acento="bg-verde">
            <div className="grid gap-4 md:grid-cols-2">
              <Rotulo texto="Nome da campanha"><input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} /></Rotulo>
              <Rotulo texto="Orçamento diário (R$)"><input className={campo} inputMode="decimal" placeholder="15,00" value={valor} onChange={(e) => setValor(e.target.value)} required /></Rotulo>
              <Rotulo texto="Estratégia de lances">
                <select className={campo} value={estrategia} onChange={(e) => setEstrategia(e.target.value)}>
                  {ESTRATEGIAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </Rotulo>
              <Rotulo texto={estrategia === 'MANUAL_CPC' ? 'CPC máximo (R$)' : 'Teto de CPC (R$, opcional)'}>
                <input className={campo} inputMode="decimal" value={cpc} onChange={(e) => setCpc(e.target.value)} disabled={estrategia === 'MAXIMIZE_CONVERSIONS'} />
              </Rotulo>
            </div>
          </Secao>
          <Secao titulo="Locais e idioma" acento="bg-verde">
            <ul className="mb-3 space-y-1 text-sm" aria-label="Locais escolhidos">
              {locais.map((l) => (
                <li key={l.id} className="flex items-center gap-3"><strong>{l.nome}</strong> <span className="font-mono text-xs text-cinza">{l.id}</span>
                  <button type="button" className="text-xs underline" onClick={() => setLocais(locais.filter((x) => x.id !== l.id))}>Remover {l.nome}</button></li>
              ))}
            </ul>
            <div className="flex flex-wrap items-end gap-2">
              <Rotulo texto="Buscar cidade ou estado"><input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} /></Rotulo>
              <button type="button" className={botaoSecundario} onClick={() => void buscar()} disabled={busca.trim().length < 2}>Buscar local</button>
            </div>
            {erroBusca ? <div className="mt-2"><Erro erro={erroBusca} /></div> : null}
            {sugestoes.length ? (
              <ul className="mt-2 space-y-1 text-sm" aria-label="Locais encontrados">
                {sugestoes.map((s) => (
                  <li key={s.id} className="flex items-center justify-between rounded-lg bg-osso px-3 py-1.5">
                    <span>{s.nome} <span className="text-cinza">({s.tipo})</span></span>
                    <button type="button" className="font-semibold underline" disabled={locais.some((l) => l.id === s.id)}
                      onClick={() => setLocais([...locais.filter((l) => l.id !== BRASIL.id), { id: s.id, nome: s.nome }])}>Adicionar {s.nome}</button>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-sm text-cinza">Idioma: Português.</p>
          </Secao>
          <Secao titulo="Grupo, palavras-chave e anúncio" acento="bg-verde">
            <div className="grid gap-4 md:grid-cols-2">
              <Rotulo texto="Nome do grupo de anúncios"><input className={campo} value={grupo} onChange={(e) => setGrupo(e.target.value)} /></Rotulo>
              <Rotulo texto='Palavras-chave (uma por linha: [exata], "frase" ou ampla)'>
                <textarea className={`${campo} min-h-28 font-mono`} value={palavras} onChange={(e) => setPalavras(e.target.value)} />
              </Rotulo>
              <Rotulo texto="Títulos (um por linha; 3 a 15, até 30 caracteres)">
                <textarea className={`${campo} min-h-40`} value={titulos} onChange={(e) => setTitulos(e.target.value)} />
              </Rotulo>
              <Rotulo texto="Descrições (uma por linha; 2 a 4, até 90 caracteres)">
                <textarea className={`${campo} min-h-40`} value={descricoes} onChange={(e) => setDescricoes(e.target.value)} />
              </Rotulo>
              <Rotulo texto="URL final (https)"><input className={campo} type="url" value={url} onChange={(e) => setUrl(e.target.value)} /></Rotulo>
              <div className="grid grid-cols-2 gap-2">
                <Rotulo texto="Caminho 1 (opcional)"><input className={campo} maxLength={15} value={caminho1} onChange={(e) => setCaminho1(e.target.value)} /></Rotulo>
                <Rotulo texto="Caminho 2 (opcional)"><input className={campo} maxLength={15} value={caminho2} onChange={(e) => setCaminho2(e.target.value)} /></Rotulo>
              </div>
            </div>
          </Secao>
          {aviso ? <p role="alert" className="rounded-xl border-l-4 border-vermelho bg-vermelho-tint px-4 py-3 text-sm">{aviso}</p> : null}
          <button type="submit" className={botaoPrimario}>Revisar campanha</button>
        </form>
      ) : null}
    </div>
  )
}

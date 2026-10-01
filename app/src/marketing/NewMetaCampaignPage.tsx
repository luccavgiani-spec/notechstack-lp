import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CampoMidia } from './CampoMidia'
import { centavosDeReais, dataHora, localParaIso, reais } from './format'
import { marketing } from './marketing-service'
import { Erro, PainelRevisao, Rotulo, Secao, botaoPrimario, botaoSecundario, campo } from './ui'
import { useRevisao } from './useRevisao'

const OBJETIVOS = [
  ['OUTCOME_LEADS', 'Leads no site (evento Lead do pixel)'],
  ['OUTCOME_TRAFFIC', 'Tráfego para o site'],
  ['OUTCOME_AWARENESS', 'Reconhecimento (alcance)'],
] as const

const CTAS = [
  ['LEARN_MORE', 'Saiba mais'],
  ['CONTACT_US', 'Fale conosco'],
  ['SIGN_UP', 'Cadastre-se'],
  ['GET_QUOTE', 'Solicitar orçamento'],
] as const

type Local = { key: string; nome: string; tipo: 'cidade' | 'regiao'; raio_km: number }

const rotuloDe = <T extends readonly (readonly [string, string])[]>(lista: T, id: string) => lista.find(([v]) => v === id)?.[1] ?? id

export function NewMetaCampaignPage() {
  const fluxo = useRevisao()
  const [nome, setNome] = useState('')
  const [objetivo, setObjetivo] = useState<string>('OUTCOME_LEADS')
  const [tipoOrcamento, setTipoOrcamento] = useState<'diario' | 'total'>('diario')
  const [valor, setValor] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [brasil, setBrasil] = useState(true)
  const [locais, setLocais] = useState<Local[]>([])
  const [busca, setBusca] = useState('')
  const [sugestoes, setSugestoes] = useState<Omit<Local, 'raio_km'>[]>([])
  const [erroBusca, setErroBusca] = useState<unknown>(null)
  const [idadeMin, setIdadeMin] = useState('25')
  const [idadeMax, setIdadeMax] = useState('55')
  const [genero, setGenero] = useState<'todos' | 'masculino' | 'feminino'>('todos')
  const [tipoCriativo, setTipoCriativo] = useState<'imagem' | 'video'>('imagem')
  const [midia, setMidia] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [titulo, setTitulo] = useState('')
  const [link, setLink] = useState('https://www.notechstack.com.br/')
  const [cta, setCta] = useState<string>('LEARN_MORE')
  const [aviso, setAviso] = useState('')

  async function buscarLocais() {
    setErroBusca(null)
    try {
      setSugestoes((await marketing.locaisMeta(busca)).locais)
    } catch (e) {
      setErroBusca(e)
    }
  }

  function revisar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const centavos = centavosDeReais(valor)
    const faltas: string[] = []
    if (nome.trim().length < 3) faltas.push('nome')
    if (centavos === null) faltas.push('orçamento')
    if (!inicio) faltas.push('início')
    if (tipoOrcamento === 'total' && !fim) faltas.push('término (obrigatório com orçamento total)')
    if (!brasil && !locais.length) faltas.push('local do público')
    if (!midia.length) faltas.push(tipoCriativo === 'imagem' ? 'imagem' : 'vídeo')
    if (!texto.trim() || !titulo.trim()) faltas.push('texto e título do anúncio')
    if (faltas.length) {
      setAviso(`Falta preencher: ${faltas.join(', ')}.`)
      return
    }
    setAviso('')
    const corpo = {
      nome: nome.trim(),
      objetivo,
      orcamento: { tipo: tipoOrcamento, centavos },
      inicio: localParaIso(inicio),
      fim: fim ? localParaIso(fim) : null,
      publico: {
        paises: brasil ? ['BR'] : [],
        cidades: brasil ? [] : locais.filter((l) => l.tipo === 'cidade').map(({ key, nome: n, raio_km }) => ({ key, nome: n, raio_km })),
        regioes: brasil ? [] : locais.filter((l) => l.tipo === 'regiao').map(({ key, nome: n }) => ({ key, nome: n })),
        idade_min: Number(idadeMin),
        idade_max: Number(idadeMax),
        genero,
      },
      criativo: { tipo: tipoCriativo, midia: midia[0], texto: texto.trim(), titulo: titulo.trim(), link: link.trim(), cta },
    }
    fluxo.revisar({
      titulo: 'Criar campanha Meta',
      itens: [
        ['Plataforma', 'Meta Ads (Facebook + Instagram, posicionamentos automáticos)'],
        ['Nome', corpo.nome],
        ['Objetivo', rotuloDe(OBJETIVOS, objetivo)],
        ['Status ao criar', 'PAUSADA — nada é veiculado nem gasto até ativar'],
        ['Orçamento', `${reais(centavos)} ${tipoOrcamento === 'diario' ? 'por dia' : 'no total'}`],
        ['Início', dataHora(corpo.inicio)],
        ['Término', corpo.fim ? dataHora(corpo.fim) : 'sem término'],
        ['Local', brasil ? 'Brasil inteiro' : locais.map((l) => (l.tipo === 'cidade' ? `${l.nome} (+${l.raio_km} km)` : l.nome)).join('; ')],
        ['Idade', `${idadeMin} a ${idadeMax} anos`],
        ['Gênero', genero],
        ['Criativo', `${tipoCriativo === 'imagem' ? 'Imagem' : 'Vídeo'}: ${midia[0].split('/').pop()}`],
        ['Texto principal', corpo.criativo.texto],
        ['Título', corpo.criativo.titulo],
        ['Link', corpo.criativo.link],
        ['Botão', rotuloDe(CTAS, cta)],
      ],
      aviso: 'A campanha nasce PAUSADA. Conjunto e anúncio nascem ativos dentro dela: ativar a campanha depois é o único passo que libera gasto.',
      executar: (request_id) => marketing.criarCampanhaMeta({ request_id, ...corpo }),
      link: (r) => (typeof r.resultado?.link === 'string' ? { href: r.resultado.link, texto: 'Abrir no Gerenciador de Anúncios' } : null),
    })
  }

  const campanhaCriada = fluxo.resultado?.acao.ids_externos?.campaign_id

  return (
    <div className="space-y-6">
      <p className="text-sm"><Link className="text-azul underline" to="/no/marketing/campanhas">← Campanhas</Link></p>
      <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Nova campanha Meta</h1>
      <PainelRevisao fluxo={fluxo} />
      {campanhaCriada ? (
        <p className="text-sm"><Link className="font-semibold text-azul underline" to={`/no/marketing/campanhas/meta/${campanhaCriada}`}>Ver a campanha {campanhaCriada} no planner</Link></p>
      ) : null}
      {!fluxo.pedido ? (
        <form onSubmit={revisar} noValidate className="space-y-6" aria-label="Formulário de nova campanha Meta">
          <Secao titulo="Campanha" acento="bg-azul">
            <div className="grid gap-4 md:grid-cols-2">
              <Rotulo texto="Nome da campanha"><input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required minLength={3} /></Rotulo>
              <Rotulo texto="Objetivo">
                <select className={campo} value={objetivo} onChange={(e) => setObjetivo(e.target.value)}>
                  {OBJETIVOS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                </select>
              </Rotulo>
              <fieldset className="text-sm">
                <legend className="mb-1 font-semibold">Tipo de orçamento</legend>
                <label className="mr-4"><input type="radio" name="tipo-orcamento" checked={tipoOrcamento === 'diario'} onChange={() => setTipoOrcamento('diario')} /> Diário</label>
                <label><input type="radio" name="tipo-orcamento" checked={tipoOrcamento === 'total'} onChange={() => setTipoOrcamento('total')} /> Total do período</label>
              </fieldset>
              <Rotulo texto="Orçamento (R$)"><input className={campo} inputMode="decimal" placeholder="20,00" value={valor} onChange={(e) => setValor(e.target.value)} required /></Rotulo>
              <Rotulo texto="Início (horário de Brasília)"><input className={campo} type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></Rotulo>
              <Rotulo texto="Término (opcional; obrigatório com orçamento total)"><input className={campo} type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} /></Rotulo>
            </div>
          </Secao>

          <Secao titulo="Público" acento="bg-azul">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={brasil} onChange={(e) => setBrasil(e.target.checked)} /> Brasil inteiro
            </label>
            {!brasil ? (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-end gap-2">
                  <Rotulo texto="Buscar cidade ou estado"><input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} /></Rotulo>
                  <button type="button" className={botaoSecundario} onClick={() => void buscarLocais()} disabled={busca.trim().length < 2}>Buscar local</button>
                </div>
                {erroBusca ? <Erro erro={erroBusca} /> : null}
                {sugestoes.length ? (
                  <ul className="space-y-1 text-sm" aria-label="Locais encontrados">
                    {sugestoes.map((s) => (
                      <li key={s.key} className="flex items-center justify-between rounded-lg bg-osso px-3 py-1.5">
                        <span>{s.nome} <span className="text-cinza">({s.tipo})</span></span>
                        <button type="button" className="font-semibold underline" disabled={locais.some((l) => l.key === s.key)}
                          onClick={() => setLocais([...locais, { ...s, raio_km: 25 }])}>Adicionar {s.nome}</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {locais.length ? (
                  <ul className="space-y-2 text-sm" aria-label="Locais escolhidos">
                    {locais.map((l) => (
                      <li key={l.key} className="flex flex-wrap items-center gap-2">
                        <strong>{l.nome}</strong>
                        {l.tipo === 'cidade' ? (
                          <label className="text-xs">Raio (km)
                            <input className={`${campo} ml-1 inline w-20 py-1`} type="number" min={1} max={80} value={l.raio_km}
                              onChange={(e) => setLocais(locais.map((x) => (x.key === l.key ? { ...x, raio_km: Number(e.target.value) } : x)))} />
                          </label>
                        ) : null}
                        <button type="button" className="text-xs underline" onClick={() => setLocais(locais.filter((x) => x.key !== l.key))}>Remover {l.nome}</button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Rotulo texto="Idade mínima"><input className={campo} type="number" min={18} max={65} value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} /></Rotulo>
              <Rotulo texto="Idade máxima"><input className={campo} type="number" min={18} max={65} value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} /></Rotulo>
              <Rotulo texto="Gênero">
                <select className={campo} value={genero} onChange={(e) => setGenero(e.target.value as typeof genero)}>
                  <option value="todos">Todos</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option>
                </select>
              </Rotulo>
            </div>
          </Secao>

          <Secao titulo="Anúncio" acento="bg-azul">
            <div className="grid gap-4 md:grid-cols-2">
              <fieldset className="text-sm">
                <legend className="mb-1 font-semibold">Formato</legend>
                <label className="mr-4"><input type="radio" name="formato" checked={tipoCriativo === 'imagem'} onChange={() => { setTipoCriativo('imagem'); setMidia([]) }} /> Imagem</label>
                <label><input type="radio" name="formato" checked={tipoCriativo === 'video'} onChange={() => { setTipoCriativo('video'); setMidia([]) }} /> Vídeo</label>
              </fieldset>
              <CampoMidia rotulo={tipoCriativo === 'imagem' ? 'Imagem do anúncio (JPG ou PNG)' : 'Vídeo do anúncio (MP4 ou MOV)'}
                aceita={tipoCriativo === 'imagem' ? 'image/jpeg,image/png' : 'video/mp4,video/quicktime'} caminhos={midia} onMudar={setMidia} />
              <Rotulo texto="Texto principal"><textarea className={`${campo} min-h-28`} value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} /></Rotulo>
              <div className="space-y-4">
                <Rotulo texto="Título"><input className={campo} value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={255} /></Rotulo>
                <Rotulo texto="Link de destino (https)"><input className={campo} type="url" value={link} onChange={(e) => setLink(e.target.value)} /></Rotulo>
                <Rotulo texto="Botão">
                  <select className={campo} value={cta} onChange={(e) => setCta(e.target.value)}>
                    {CTAS.map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                  </select>
                </Rotulo>
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

import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth/auth-context'
import { type Capacidade, type EstadoCapacidade, marketing } from './marketing-service'
import { Carregando, Erro, Secao, Selo, Vazio, botaoSecundario, tabela, td, th } from './ui'
import { useDados } from './useDados'

const ROTULO: Record<EstadoCapacidade, string> = {
  ok: 'ok',
  sem_permissao: 'sem permissão',
  nao_configurado: 'não configurado',
  erro: 'erro',
  nao_verificado: 'não verificado',
}

const TOM: Record<EstadoCapacidade, 'neutro' | 'ok' | 'alerta' | 'erro'> = {
  ok: 'ok',
  sem_permissao: 'erro',
  nao_configurado: 'alerta',
  erro: 'erro',
  nao_verificado: 'alerta',
}

const AVISO_NAO_VERIFICADO = 'leitura funcionar não prova publicação'

const PLATAFORMAS = [['meta', 'Meta'], ['google', 'Google']] as const

// Defesa na borda: a função já não devolve segredo (T2 critério 13), mas um
// valor com cara de token nunca chega à tela, nem se ela errar.
const TOKEN = /(?:ya29\.|1\/\/0|GOCSPX-|EAA[A-Za-z0-9])[A-Za-z0-9._\-/+=]*/g
const semToken = (texto: string) => texto.replace(TOKEN, '[valor omitido]')

function TabelaCapacidades({ nome, capacidades }: { nome: string; capacidades: Capacidade[] }) {
  if (!capacidades.length) return <Vazio texto={`Nenhuma capacidade ${nome} informada.`} />
  return (
    <div className="overflow-x-auto">
      <table className={`${tabela} min-w-[720px]`}>
        <caption className="sr-only">Capacidades {nome}</caption>
        <thead><tr><th className={th}>Capacidade</th><th className={th}>Estado</th><th className={th}>Detalhe</th><th className={th}>Como corrigir</th></tr></thead>
        <tbody>
          {capacidades.map((c) => {
            const detalhe = c.detalhe ? semToken(c.detalhe) : null
            const avisoPublicacao = c.estado === 'nao_verificado' && !detalhe?.includes(AVISO_NAO_VERIFICADO)
            return (
              <tr key={c.id}>
                <th scope="row" className={`${td} font-semibold`}>{c.rotulo}<span className="block font-mono text-[0.625rem] font-normal text-cinza">{c.id}</span></th>
                <td className={td} data-estado={c.estado}><Selo texto={ROTULO[c.estado]} tom={TOM[c.estado]} /></td>
                <td className={`${td} max-w-sm break-words`}>
                  {detalhe ?? '—'}
                  {avisoPublicacao ? <span className="mt-1 block text-xs text-cinza">{AVISO_NAO_VERIFICADO}</span> : null}
                </td>
                <td className={`${td} max-w-sm break-words`}>{c.correcao ? semToken(c.correcao) : '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ListaConcedida({ titulo, itens }: { titulo: string; itens: string[] | null }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{titulo}</h3>
      {itens === null ? <p className="mt-1 text-sm text-cinza">não informado pela plataforma</p> : null}
      {itens !== null && !itens.length ? <p className="mt-1 text-sm text-cinza">nenhum concedido</p> : null}
      {itens?.length ? (
        <ul aria-label={titulo} className="mt-1 space-y-0.5 font-mono text-xs">
          {itens.map((i) => <li key={i} className="break-all">{semToken(i)}</li>)}
        </ul>
      ) : null}
    </div>
  )
}

// Diagnóstico por capacidade (T2 critérios 10–12): o que cada integração consegue fazer.
export function ConnectionsPage() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [conectando, setConectando] = useState(false)
  const [erroConexao, setErroConexao] = useState<unknown>(null)
  const admin = session?.user.app_metadata.role === 'NO_ADMIN'
  const motivos: Record<string, string> = { state_invalido: 'A conexão expirou ou já foi usada. Conecte novamente.', access_denied: 'A autorização foi cancelada no Google.', troca_falhou: 'Não foi possível concluir a conexão. Tente novamente.' }
  async function conectar() {
    setConectando(true)
    setErroConexao(null)
    try { const { url } = await marketing.conectarGoogle(); window.location.assign(url) }
    catch (e) { setErroConexao(e); setConectando(false) }
  }
  const [forcar, setForcar] = useState(0)
  const carregar = useCallback(() => marketing.conexoes(forcar > 0), [forcar])
  const { dados, erro, carregando, recarregar } = useDados(carregar)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-[-0.04em]">Conexões</h1>
        <button type="button" className={botaoSecundario} onClick={() => setForcar((n) => n + 1)} disabled={carregando}>
          Testar de novo (sem cache)
        </button>
      </div>
      {admin ? <button type="button" className={botaoSecundario} disabled={conectando} onClick={() => void conectar()}>{conectando ? 'Conectando…' : 'Conectar Google'}</button> : null}
      {params.get('google') === 'ok' ? <p role="status">Google conectado. Consulte o diagnóstico abaixo.</p> : null}
      {params.get('google') === 'erro' ? <p role="alert">{motivos[params.get('motivo') ?? ''] ?? 'Não foi possível conectar o Google.'}</p> : null}
      {erroConexao ? <Erro erro={erroConexao} onTentar={() => void conectar()} /> : null}
      <p className="max-w-3xl text-sm text-cinza">
        Cada capacidade de leitura é testada por uma chamada própria, que não cria nada nas plataformas.
        Publicação e escrita só aparecem como ok depois de uma escrita bem-sucedida nos últimos 30 dias.
      </p>
      {erro ? <Erro erro={erro} onTentar={recarregar} /> : null}
      {!dados && carregando ? <Carregando texto="Testando cada conexão…" /> : null}
      {dados ? (
        <div className={`space-y-6 ${carregando ? 'opacity-60' : ''}`} aria-busy={carregando}>
          {PLATAFORMAS.map(([id, nome]) => (
            <Secao key={id} titulo={nome} rotulo="Capacidades" acento={id === 'meta' ? 'bg-azul' : 'bg-verde'}>
              <TabelaCapacidades nome={nome} capacidades={dados.capacidades.filter((c) => c.plataforma === id)} />
            </Secao>
          ))}
          <Secao titulo="Escopos e permissões dos tokens" rotulo="O que cada token recebeu" acento="bg-ambar">
            <div className="grid gap-6 md:grid-cols-2">
              <ListaConcedida titulo="Escopos Google concedidos" itens={dados.google_escopos} />
              <ListaConcedida titulo="Permissões Meta do token" itens={dados.meta_permissoes?.map(p => `${p.permissao}: ${p.status}`) ?? null} />
            </div>
          </Secao>
        </div>
      ) : null}
    </div>
  )
}

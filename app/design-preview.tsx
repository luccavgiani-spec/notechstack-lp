// Development-only visual review. Never imported by the application entry point.
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import './src/styles.css'

if (!import.meta.env.DEV) throw new Error('A prévia está disponível apenas no servidor local.')
const projectId = 'design-review'
const versions = [
  {id:'demo-v12',label:'V1.2',macro:'V1',status:'publicada',published_at:'2026-09-12T12:00:00Z',created_at:'2026-09-12T12:00:00Z',changelog:'Canais de texto com threads e histórico.\nLista de membros com presença em tempo real.\nAjustes de texto solicitados na V1.1.',build_reference:'8f21c4a',is_current:true},
  {id:'demo-v11',label:'V1.1',macro:'V1',status:'publicada',published_at:'2026-09-09T12:00:00Z',created_at:'2026-09-09T12:00:00Z',changelog:'Entrada e criação de servidor navegáveis. Primeira versão aberta ao Editor.',build_reference:'41b7de0',is_current:false},
  {id:'demo-v10',label:'V1.0',macro:'V1',status:'publicada',published_at:'2026-09-06T12:00:00Z',created_at:'2026-09-06T12:00:00Z',changelog:'Protótipo navegável publicado para sua avaliação.',build_reference:'c02a9f1',is_current:false},
]
const kanban = [
  ['Sala de voz e presença','Protótipo navegável','V1','a_fazer','2026-09-22'],
  ['Convites e permissões','Construção da V1','V1','a_fazer','2026-09-24'],
  ['Cargos e moderação','Lançamento','V2','a_fazer','2026-10-02'],
  ['Canais de texto e threads','Protótipo navegável','V1','em_andamento','2026-09-20'],
  ['Lista de membros online','Protótipo navegável','V1','em_andamento','2026-09-21'],
  ['Entrada e criação de servidor','Protótipo navegável','V1','concluido','2026-09-16'],
  ['Arquitetura de tempo real','Plano e arquitetura','V1','concluido','2026-09-10'],
  ['Descoberta e requisitos','Descoberta','V1','concluido','2026-09-08'],
].map(([title,phase,macro_version,status,scheduled_date],i)=>({id:`item-${i}`,title,phase,macro_version,status,scheduled_date,position:i}))
let preferred = 'completo'
const originalFetch = window.fetch.bind(window)
window.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin)
  if (url.origin === location.origin) return originalFetch(input, init)
  // Only local fixture responses: this page never sends project data to a server.
  let result: unknown
  const endpoint = url.pathname.split('/').pop()
  switch(endpoint) {
    case 'get_client_project_shell': result = [{project_id:projectId,project_name:'Herosyu33',effective_access_status:'INICIAL_15_DIAS',access_released_at:new Date(Date.now()-4*86400000).toISOString(),modules:{como_funciona:'ativo',prototipo:'ativo',etapas:'ativo',editor:'ativo',versoes:'ativo',marca:'bloqueado'}}]; break
    case 'roadmaps': result = [{stack:['React · Supabase Realtime','Postgres · LiveKit (WebRTC)'],costs:['Infra: R$ 420/mês','Voz: por minuto de uso'],next_steps:['Testar o protótipo','Escolher o caminho'],references:['Comunidades de jogos','Times remotos pequenos'],preferred_tier:preferred,prototype_url:`${location.origin}/prototipos/equipe-demo/`,published_at:'2026-09-08T12:00:00Z',tiers:{essencial:{escopo:'Um servidor, canais de texto, convites e perfis.',profundidade:'Base do produto',exclusoes:'Voz, cargos',complexidade:'Inicial',prazo_dias:30,valor_centavos:1840000},basico:{escopo:'Acrescenta voz em grupo, cargos, permissões e moderação básica.',profundidade:'Operação integrada',exclusoes:'Vídeo, mobile',complexidade:'Intermediária',prazo_dias:55,valor_centavos:3290000},completo:{escopo:'Acrescenta vídeo, bots e webhooks, apps mobile e painel de moderação.',profundidade:'Produto completo',exclusoes:'—',complexidade:'Avançada',prazo_dias:90,valor_centavos:6150000}}}]; break
    case 'kanban_items': result = kanban; break
    case 'project_versions': result = versions; break
    case 'list_client_version_checklists': result = [{id:'check-1',versionId:'demo-v12',status:'ingerido',baseVersionLabel:'V1.1',items:[{screen:'Criar servidor',component:'Título da tela',changes:[{before:{text:'Novo servidor'},after:{text:'Crie o seu servidor'}}]}]}]; break
    case 'set_preferred_tier': preferred = JSON.parse(String(init?.body)).p_tier; result={preferred_tier:preferred,changed:true}; break
    case 'get_client_editor_config': result=[{versionId:'demo-v12',label:'V1.2',buildReference:`${location.origin}/design-editor.html`,bridgeEnabled:true,allowedComponents:[{id:'title',label:'Título da tela',screen:'Criar servidor',controls:['text','size','color']},{id:'button',label:'Botão principal',screen:'Criar servidor',controls:['text','color']},{id:'brand',label:'Marca do servidor',screen:'Criar servidor',controls:['text','logo']},{id:'channel',label:'Nome do canal',screen:'Canal #geral',controls:['text','color']},{id:'invite',label:'Convite',screen:'Convidar pessoas',controls:['text']}]}]; break
    default: return new Response(JSON.stringify({message:'Prévia visual: envio remoto desativado.'}),{status:403,headers:{'content-type':'application/json'}})
  }
  return new Response(JSON.stringify(result),{headers:{'content-type':'application/json'}})
}
const { ClientDashboardPage } = await import('./src/client-dashboard/ClientDashboardPage')
createRoot(document.getElementById('root')!).render(<><div style={{position:'fixed',bottom:8,right:12,zIndex:60,padding:'6px 10px',borderRadius:6,background:'#eda33b',color:'#141414',fontSize:10,fontFamily:'monospace'}}>PRÉVIA LOCAL · DADOS DE DEMONSTRAÇÃO</div><HashRouter><Routes>{Object.entries({'como-funciona':'como_funciona',prototipo:'prototipo',etapas:'etapas',editor:'editor',versoes:'versoes',marca:'marca'} as const).map(([path,module])=><Route key={path} path={`/p/:projectId/${path}`} element={<ClientDashboardPage module={module}/>}/>)}<Route path="*" element={<Navigate to={`/p/${projectId}/como-funciona`} replace/>}/></Routes></HashRouter></>)

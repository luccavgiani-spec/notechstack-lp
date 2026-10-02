// Provas de viabilidade V1–V7 do hub de marketing (plan.md, Passo 0.3).
// Roda os ADAPTADORES DE PRODUÇÃO (supabase/functions/_shared/marketing) contra as
// APIs reais. Quem roda é o Lucca, com os secrets só nas variáveis do terminal:
// nada é lido de arquivo, nada de valor de segredo é impresso.
//
//   node supabase/tests/hub_marketing_viabilidade.mjs                 # só leitura
//   node supabase/tests/hub_marketing_viabilidade.mjs --executar-escritas
//        (V2 e V6 criam "[teste hub] apagar" PAUSADO e apagam na mesma execução)
//   ... --fixtures <pasta>   salva respostas anonimizadas para os testes do Vitest
//
// Variáveis: META_SYSTEM_USER_TOKEN, META_AD_ACCOUNT_ID (act_…), META_IG_USER_ID,
// V3_IMAGE_URL (JPEG público da nó; sem ela a V3 é pulada), GOOGLE_OAUTH_CLIENT_ID,
// GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN,
// GOOGLE_ADS_CUSTOMER_ID, GOOGLE_ADS_LOGIN_CUSTOMER_ID, GA4_PROPERTY_ID, GSC_SITE_URL.

import fs from 'node:fs'
import path from 'node:path'
import { GRAPH_API_VERSION, metaFetch } from '../functions/_shared/meta.ts'
import { metaResumo } from '../functions/_shared/marketing/meta.ts'
import { googleAccessToken, googleFetch } from '../functions/_shared/marketing/google-auth.ts'
import { ga4Resumo } from '../functions/_shared/marketing/ga4.ts'
import { gscResumo } from '../functions/_shared/marketing/gsc.ts'
import { GOOGLE_ADS_API, adsCampanhas, idCliente, operacoesCampanhaPesquisa } from '../functions/_shared/marketing/google-ads.ts'
import { META_LEAD_ACTION_TYPES, parsePeriodo } from '../functions/_shared/marketing/normalize.ts'

const args = process.argv.slice(2)
const escrever = args.includes('--executar-escritas')
const pastaFixtures = args.includes('--fixtures') ? args[args.indexOf('--fixtures') + 1] : null
// Colar num prompt mascarado pode trazer os marcadores invisíveis do "bracketed paste"
// (ESC[200~ … ESC[201~), quebras de linha ou aspas: tudo isso sai antes do uso.
const SUJEIRA = /\u001b\[20[01]~|\[20[01]~|[\u0000-\u001f\u007f]/g
const env = (n) => process.env[n]?.replace(SUJEIRA, '').trim().replace(/^["']|["']$/g, '') || null
const resultados = []

// Confere o formato sem nunca mostrar o valor: só tamanho e se bate com o esperado.
const FORMATOS = {
  META_SYSTEM_USER_TOKEN: [/^EAA[A-Za-z0-9]+$/, 'começa com EAA'],
  META_AD_ACCOUNT_ID: [/^act_\d+$/, 'act_ seguido de números'],
  META_IG_USER_ID: [/^\d{10,20}$/, 'só números'],
  GOOGLE_OAUTH_CLIENT_ID: [/^\d+-[a-z0-9]+\.apps\.googleusercontent\.com$/, 'termina com .apps.googleusercontent.com'],
  GOOGLE_OAUTH_CLIENT_SECRET: [/^GOCSPX-[A-Za-z0-9_-]+$/, 'começa com GOCSPX-'],
  GOOGLE_OAUTH_REFRESH_TOKEN: [/^1\/\/[A-Za-z0-9_-]+$/, 'começa com 1//'],
  GOOGLE_ADS_DEVELOPER_TOKEN: [/^[A-Za-z0-9_-]{15,40}$/, 'letras e números, sem espaço'],
  GOOGLE_ADS_CUSTOMER_ID: [/^\d{3}-?\d{3}-?\d{4}$/, '10 dígitos (xxx-xxx-xxxx)'],
  GOOGLE_ADS_LOGIN_CUSTOMER_ID: [/^\d{3}-?\d{3}-?\d{4}$/, '10 dígitos (xxx-xxx-xxxx)'],
  GA4_PROPERTY_ID: [/^\d{6,12}$/, 'só números'],
  GSC_SITE_URL: [/^(sc-domain:[a-z0-9.-]+|https?:\/\/\S+\/)$/, 'sc-domain:… ou https://…/ com barra no fim'],
}
console.log('Formato das variáveis (valores nunca são mostrados):')
for (const [nome, [re, esperado]] of Object.entries(FORMATOS)) {
  const bruto = process.env[nome]
  const v = env(nome)
  if (!v) { console.log(`  —        ${nome}: vazio`); continue }
  const limpou = bruto !== v ? ' (limpei caracteres invisíveis/aspas da colagem)' : ''
  console.log(`  ${re.test(v) ? 'ok      ' : 'PROBLEMA'} ${nome}: ${v.length} caracteres${re.test(v) ? '' : `; esperado: ${esperado}`}${limpou}`)
}
console.log('')

function registrar(id, prova, status, detalhe) {
  resultados.push({ id, prova, status, detalhe })
  console.log(`${status.padEnd(6)} ${id} ${prova} — ${detalhe}`)
}

// Mantém números e tipos de ação; troca ids, nomes e textos.
function anonimizar(valor, chave = '') {
  if (Array.isArray(valor)) return valor.map((v) => anonimizar(v, chave))
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, anonimizar(v, k)]))
  if (typeof valor !== 'string') return valor
  if (/action_type|status|objective|matchType|type$/i.test(chave)) return valor
  if (/(^id$|_id$|Id$|resourceName|^name$|_name$|username|permalink|link|caption|message|^text$|^keys$|url)/i.test(chave)) {
    return /^\d+$/.test(valor) ? '1'.repeat(Math.min(valor.length, 15)) : 'anonimizado'
  }
  return valor
}

function salvar(nome, dados) {
  if (!pastaFixtures) return
  fs.mkdirSync(pastaFixtures, { recursive: true })
  fs.writeFileSync(path.join(pastaFixtures, `${nome}.json`), `${JSON.stringify(anonimizar(dados), null, 2)}\n`)
}

async function prova(id, nome, faltam, corpo) {
  const ausentes = faltam.filter((n) => !env(n))
  if (ausentes.length) return registrar(id, nome, 'PULADA', `faltam variáveis: ${ausentes.join(', ')}`)
  try {
    registrar(id, nome, 'OK', await corpo())
  } catch (e) {
    const msg = e?.body?.error ? `${e.message} ${JSON.stringify(e.body.error).slice(0, 300)}` : String(e?.message ?? e)
    registrar(id, nome, 'FALHOU', msg)
  }
}

const agora = new Date()
const p7 = parsePeriodo('7d', agora)
const p28 = parsePeriodo(`${new Date(agora.getTime() - 30 * 86400000).toISOString().slice(0, 10)}..${new Date(agora.getTime() - 3 * 86400000).toISOString().slice(0, 10)}`, agora)
const ctxMeta = () => ({ token: env('META_SYSTEM_USER_TOKEN'), adAccountId: env('META_AD_ACCOUNT_ID'), igUserId: env('META_IG_USER_ID') })
const credGoogle = () => ({ clientId: env('GOOGLE_OAUTH_CLIENT_ID'), clientSecret: env('GOOGLE_OAUTH_CLIENT_SECRET'), refreshToken: env('GOOGLE_OAUTH_REFRESH_TOKEN') })
const META = ['META_SYSTEM_USER_TOKEN', 'META_AD_ACCOUNT_ID']
const GOOGLE = ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REFRESH_TOKEN']
const ADS = [...GOOGLE, 'GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID']

await prova('V1', 'Meta: /me + insights last_7d com o tipo de lead', META, async () => {
  const me = await metaFetch('/me', { access_token: env('META_SYSTEM_USER_TOKEN'), fields: 'id,name' })
  const campanhas = await metaFetch(`/${env('META_AD_ACCOUNT_ID')}/insights`, {
    access_token: env('META_SYSTEM_USER_TOKEN'), level: 'campaign', date_preset: 'last_7d',
    fields: 'campaign_id,campaign_name,spend,actions',
  })
  salvar('v1-meta-insights-campanha', campanhas)
  const resumo = await metaResumo(ctxMeta(), p7)
  salvar('v1-meta-resumo', resumo)
  const tipos = new Map()
  for (const linha of campanhas.data ?? []) for (const a of linha.actions ?? []) tipos.set(a.action_type, (tipos.get(a.action_type) ?? 0) + Number(a.value))
  const candidatos = META_LEAD_ACTION_TYPES.map((t) => `${t}=${tipos.get(t) ?? 0}`).join(', ')
  return `usuário do sistema ok (${me.id ? 'id presente' : 'sem id'}); ${campanhas.data?.length ?? 0} campanhas; gasto 7d ${(resumo.total.gasto_centavos / 100).toFixed(2)}; leads contados ${resumo.total.conversoes}; tipos: ${candidatos}. Conferir com a coluna "Leads" do Ads Manager.`
})

await prova('V2', 'Meta: criar campanha PAUSED "[teste hub] apagar" e apagar', META, async () => {
  if (!escrever) return 'escrita não executada (rode com --executar-escritas)'
  const conta = env('META_AD_ACCOUNT_ID')
  const criada = await metaFetch(`/${conta}/campaigns`, { access_token: env('META_SYSTEM_USER_TOKEN') }, {
    method: 'POST', maxRetries: 0,
    body: { name: '[teste hub] apagar', objective: 'OUTCOME_TRAFFIC', status: 'PAUSED', buying_type: 'AUCTION', special_ad_categories: [], is_adset_budget_sharing_enabled: false },
  })
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}/${criada.id}`)
  url.searchParams.set('access_token', env('META_SYSTEM_USER_TOKEN'))
  const apagada = await fetch(url, { method: 'DELETE' })
  if (!apagada.ok) throw new Error(`campanha ${criada.id} criada mas o DELETE deu ${apagada.status}: apagar à mão no Ads Manager`)
  return `criada ${criada.id} em PAUSED e apagada (HTTP ${apagada.status})`
})

await prova('V3', 'Instagram: container de mídia sem publicar', ['META_SYSTEM_USER_TOKEN', 'META_IG_USER_ID', 'V3_IMAGE_URL'], async () => {
  const c = await metaFetch(`/${env('META_IG_USER_ID')}/media`, { access_token: env('META_SYSTEM_USER_TOKEN') }, {
    method: 'POST', maxRetries: 0, body: { image_url: env('V3_IMAGE_URL'), caption: '[teste hub] não publicar' },
  })
  const s = await metaFetch(`/${c.id}`, { access_token: env('META_SYSTEM_USER_TOKEN'), fields: 'status_code' })
  return `container ${c.id} criado (${s.status_code}); não publicado, expira sozinho em 24 h`
})

await prova('V4', 'GA4: runReport 7d com advertiserAdCost e keyEvents', [...GOOGLE, 'GA4_PROPERTY_ID'], async () => {
  const token = await googleAccessToken(credGoogle())
  const r = await ga4Resumo(token, env('GA4_PROPERTY_ID'), p7)
  salvar('v4-ga4-resumo', r)
  return `sessões ${r.sessoes}; eventos-chave ${r.eventos_chave}; custo Google Ads segundo o GA4 ${(r.google_ads_segundo_ga4.gasto_centavos / 100).toFixed(2)}`
})

await prova('V5', 'Search Console: searchanalytics.query ~28 dias', [...GOOGLE, 'GSC_SITE_URL'], async () => {
  const token = await googleAccessToken(credGoogle())
  const r = await gscResumo(token, env('GSC_SITE_URL'), p28)
  salvar('v5-gsc-resumo', r)
  return `${r.cliques} cliques, ${r.impressoes} impressões, ${r.consultas.length} consultas, ${r.paginas.length} páginas`
})

await prova('V6', 'Google Ads: GAQL + mutate validateOnly + criar PAUSED e remover', ADS, async () => {
  const ctx = {
    token: await googleAccessToken(credGoogle()),
    developerToken: env('GOOGLE_ADS_DEVELOPER_TOKEN'),
    customerId: env('GOOGLE_ADS_CUSTOMER_ID'),
    loginCustomerId: env('GOOGLE_ADS_LOGIN_CUSTOMER_ID'),
  }
  const lista = await adsCampanhas(ctx, p7)
  salvar('v6-google-campanhas', lista)
  const entrada = {
    nome: '[teste hub] apagar', orcamento_diario_centavos: 100, lances: { estrategia: 'MAXIMIZE_CLICKS', cpc_max_centavos: null },
    locais: ['2076'], idiomas: ['1014'], grupo: { nome: '[teste hub] grupo' },
    palavras_chave: [{ texto: 'teste hub apagar', correspondencia: 'EXACT' }],
    anuncio: { titulos: ['Teste hub 1', 'Teste hub 2', 'Teste hub 3'], descricoes: ['Teste do hub, apagar.', 'Não veicula: nasce pausada.'], url_final: 'https://www.notechstack.com.br/', caminho1: '', caminho2: '' },
  }
  const cabec = { 'developer-token': ctx.developerToken, ...(ctx.loginCustomerId ? { 'login-customer-id': idCliente(ctx.loginCustomerId) } : {}) }
  const urlMutate = `${GOOGLE_ADS_API}/customers/${idCliente(ctx.customerId)}/googleAds:mutate`
  const ops = operacoesCampanhaPesquisa(ctx.customerId, entrada, 'viab')
  await googleFetch(urlMutate, ctx.token, { body: { mutateOperations: ops, validateOnly: true }, headers: cabec })
  if (!escrever) return `GAQL ok (${lista.length} campanhas); validateOnly ok; criação real não executada (rode com --executar-escritas)`
  const criada = await googleFetch(urlMutate, ctx.token, { body: { mutateOperations: ops }, headers: cabec })
  const nomes = (criada.mutateOperationResponses ?? []).map((r) => Object.values(r)[0]?.resourceName)
  const campanha = nomes.find((n) => n?.includes('/campaigns/'))
  const orcamento = nomes.find((n) => n?.includes('/campaignBudgets/'))
  await googleFetch(urlMutate, ctx.token, {
    body: { mutateOperations: [{ campaignOperation: { remove: campanha } }, { campaignBudgetOperation: { remove: orcamento } }] },
    headers: cabec,
  })
  return `GAQL ok (${lista.length} campanhas); validateOnly ok; ${campanha?.split('/').pop()} criada PAUSED e removida — Explorer Access permite criar`
})

registrar('V7', 'Versão da Graph API', 'OK', `${GRAPH_API_VERSION} (v21.0 da Marketing API expirou em 09/09/2025)`)

console.log('\nResumo para o execution.md (sem segredos):')
console.table(resultados.map(({ id, status, detalhe }) => ({ id, status, detalhe: detalhe.slice(0, 120) })))

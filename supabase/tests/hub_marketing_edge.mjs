// Integração local da marketing-hub no runtime Deno real, com contas reais do
// Auth local (TOTP de verdade para o aal2). Não fala com Meta nem Google.
//
// Pré-requisitos: `supabase start` (com [auth.mfa.totp] ligado) e, em outro
// terminal, `supabase functions serve marketing-hub`.
// Uso: node supabase/tests/hub_marketing_edge.mjs
// O segredo do cron é lido do Vault local pelo docker e passado só em memória.

import { execFileSync } from 'node:child_process'
import { createHmac, randomUUID } from 'node:crypto'

const status = execFileSync('supabase', ['status', '-o', 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
const envLocal = Object.fromEntries(status.split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="(.*)"$/)).filter(Boolean).map((m) => [m[1], m[2]]))
const API = envLocal.API_URL
const ANON = envLocal.ANON_KEY
const SERVICE = envLocal.SERVICE_ROLE_KEY
if (!API || !ANON || !SERVICE) throw new Error('Supabase local indisponível')
const FN = `${API}/functions/v1/marketing-hub`
const DB = 'supabase_db_sdeowbqmwkwseyktyemn'

const passes = []
function ok(cond, rotulo, detalhe) {
  if (!cond) throw new Error(`FALHOU: ${rotulo}${detalhe ? ` — ${JSON.stringify(detalhe).slice(0, 400)}` : ''}`)
  passes.push(rotulo)
  console.log(`PASS ${rotulo}`)
}

async function http(metodo, url, { token, apikey = ANON, corpo, extra = {} } = {}) {
  const r = await fetch(url, {
    method: metodo,
    headers: { apikey, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}), ...extra },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await r.text()
  let body = texto
  try { body = texto ? JSON.parse(texto) : null } catch { /* texto puro */ }
  return { status: r.status, body }
}

const admin = (metodo, caminho, corpo) => http(metodo, `${API}${caminho}`, { token: SERVICE, apikey: SERVICE, corpo })

function psql(sql) {
  return execFileSync('docker', ['exec', '-i', DB, 'psql', '-U', 'postgres', '-d', 'postgres', '-Atc', sql], { encoding: 'utf8' }).trim()
}

// RFC 6238 (SHA-1, 30 s, 6 dígitos), sem dependência nova.
function base32(segredo) {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of segredo.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}
function totp(segredo, agora = Date.now()) {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(agora / 30_000)))
  const h = createHmac('sha1', base32(segredo)).update(contador).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

const nonce = randomUUID().slice(0, 8)
const senha = `Hub-${randomUUID()}!aA1`
const criados = []

async function criarUsuario(papel) {
  const email = `hub-${papel.toLowerCase()}-${nonce}@example.test`
  const r = await admin('POST', '/auth/v1/admin/users', { email, password: senha, email_confirm: true, app_metadata: { role: papel } })
  if (r.status >= 300) throw new Error(`usuário ${papel}: ${r.status}`)
  criados.push(r.body.id)
  return { id: r.body.id, email }
}
async function entrar(email) {
  const r = await http('POST', `${API}/auth/v1/token?grant_type=password`, { corpo: { email, password: senha } })
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`)
  return r.body.access_token
}
const aal = (token) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).aal

let clienteNo = null
const postsTeste = []

try {
  const [uAdmin, uDot, uCliente] = await Promise.all([criarUsuario('NO_ADMIN'), criarUsuario('MARKETING_AGENT'), criarUsuario('CLIENT')])
  const tAdmin1 = await entrar(uAdmin.email)
  const tDot = await entrar(uDot.email)
  const tCliente = await entrar(uCliente.email)

  ok((await http('GET', `${FN}/overview?periodo=7d`)).status === 401, 'E1 sem sessão → 401')
  const r1 = await http('GET', `${FN}/overview?periodo=7d`, { token: tAdmin1 })
  ok(aal(tAdmin1) === 'aal1' && r1.status === 403 && r1.body.error_code === 'MFA_REQUIRED', 'E2 NO_ADMIN aal1 → 403 MFA_REQUIRED', r1)

  // TOTP real: cadastro → desafio → verificação → sessão aal2.
  const fator = await http('POST', `${API}/auth/v1/factors`, { token: tAdmin1, corpo: { factor_type: 'totp', friendly_name: `hub-${nonce}` } })
  ok(fator.status === 200 && fator.body.totp?.secret, 'E3 cadastro TOTP local', fator.status)
  const desafio = await http('POST', `${API}/auth/v1/factors/${fator.body.id}/challenge`, { token: tAdmin1, corpo: {} })
  const verificado = await http('POST', `${API}/auth/v1/factors/${fator.body.id}/verify`, {
    token: tAdmin1, corpo: { challenge_id: desafio.body.id, code: totp(fator.body.totp.secret) },
  })
  const tAdmin2 = verificado.body.access_token
  ok(verificado.status === 200 && aal(tAdmin2) === 'aal2', 'E4 verificação TOTP → sessão aal2', verificado.status)

  const visao = await http('GET', `${FN}/overview?periodo=7d`, { token: tAdmin2 })
  ok(visao.status === 200 && visao.body.blocos.leads.ok === true, 'E5 NO_ADMIN aal2 → 200 na visão geral', visao.body)
  ok(visao.body.blocos.meta_ads.motivo === 'nao_configurado', 'E6 sem token Meta o bloco é "não configurado"')
  const visaoDot = await http('GET', `${FN}/overview?periodo=30d`, { token: tDot })
  ok(visaoDot.status === 200, 'E7 MARKETING_AGENT → 200 na visão geral')
  ok((await http('GET', `${FN}/overview`, { token: tCliente })).status === 403, 'E8 CLIENT → 403')
  ok((await http('GET', `${FN}/agent`, { token: tDot })).status === 403, 'E9 dot → 403 em /agent')
  ok((await http('POST', `${FN}/agent/disable`, { token: tDot, corpo: { request_id: `req-${nonce}-dd`, user_id: uDot.id } })).status === 403, 'E10 dot não se desliga')

  // AC7: o dot não lê as áreas de clientes/financeiro nem dados pessoais.
  for (const rpc of ['list_admin_projects', 'list_admin_saldos']) {
    const r = await http('POST', `${API}/rest/v1/rpc/${rpc}`, { token: tDot, corpo: {} })
    ok(r.status >= 400 || (Array.isArray(r.body) && r.body.length === 0), `E11 dot sem dados em ${rpc} (${r.status})`, r.body)
  }
  const arquivo = await http('POST', `${API}/rest/v1/rpc/list_archive_assets`, { token: tDot, corpo: {} })
  ok(arquivo.status >= 400 || (Array.isArray(arquivo.body) && arquivo.body.length === 0), `E12 dot sem dados da biblioteca (${arquivo.status})`)
  const leads = await http('GET', `${API}/rest/v1/leads?select=nome,email,whatsapp&limit=1`, { token: tDot })
  ok(leads.status >= 400 || (Array.isArray(leads.body) && leads.body.length === 0), `E13 dot sem dados pessoais de leads (${leads.status})`)
  for (const tabela of ['marketing_actions', 'scheduled_posts', 'ad_accounts']) {
    const r = await http('GET', `${API}/rest/v1/${tabela}?select=*`, { token: tDot })
    ok(r.status === 401 || r.status === 403, `E14 dot sem acesso direto a ${tabela} (${r.status}, ${r.body?.code})`)
  }

  // Ativos da nó vêm do seed (20261001000937); o teste só usa, não cria.
  clienteNo = psql("select id from public.clients where slug = 'no-tech-stack'")
  ok(psql(`select count(*) from public.ad_accounts where client_id = '${clienteNo}' and access_token is null`) === '3', 'E14b seed com os 3 ativos Meta da nó, sem token')

  const post = {
    request_id: `req-${nonce}-post1`, rede: 'instagram', tipo: 'feed_image', legenda: '[teste hub] local',
    midias: [`2026/09/${randomUUID()}-teste.jpg`], agendado_para: new Date(Date.now() + 86_400_000).toISOString(),
  }
  const agendado = await http('POST', `${FN}/posts`, { token: tDot, corpo: post })
  ok(agendado.status === 200 && agendado.body.status === 'ok', 'E15 dot agenda post', agendado.body)
  const repetido = await http('POST', `${FN}/posts`, { token: tDot, corpo: post })
  ok(repetido.body.idempotente === true && repetido.body.acao_id === agendado.body.acao_id, 'E16 mesmo request_id é idempotente')
  const linha = psql(`select actor_role || '|' || status || '|' || kind from public.marketing_actions where request_id = 'req-${nonce}-post1'`)
  ok(linha === 'MARKETING_AGENT|ok|post.agendar', 'E17 registro com papel MARKETING_AGENT', linha)
  const postId = agendado.body.resultado.post_id
  postsTeste.push(postId)
  const cancelado = await http('DELETE', `${FN}/posts/${postId}`, { token: tAdmin2, corpo: { request_id: `req-${nonce}-cancel` } })
  ok(cancelado.status === 200 && psql(`select status from public.scheduled_posts where id = '${postId}'`) === 'cancelled', 'E18 cancelamento antes de sair')

  const upload = await http('POST', `${FN}/media`, { token: tDot, corpo: { nome_arquivo: 'Arte.jpg', tipo_mime: 'image/jpeg' } })
  ok(upload.status === 200 && /^\d{4}\/\d{2}\/[0-9a-f-]{36}-arte\.jpg$/.test(upload.body.caminho) && upload.body.url_upload, 'E19 URL de upload assinada no bucket privado')

  // Cron → pg_net → função, com o segredo do Vault (sem sair do banco no caminho real).
  ok((await http('POST', `${FN}/internal/publish-due`, { corpo: {}, extra: { 'x-cron-secret': 'errado' } })).status === 401, 'E20 publish-due recusa segredo errado')
  const segredo = psql("select decrypted_secret from vault.decrypted_secrets where name = 'MARKETING_CRON_SECRET'")
  const publicar = await http('POST', `${FN}/internal/publish-due`, { corpo: {}, extra: { 'x-cron-secret': segredo } })
  ok(publicar.status === 200 && publicar.body.processados === 0, 'E21 publish-due aceita o segredo do Vault', publicar.body)
  psql("select vault.create_secret('http://kong:8000/functions/v1/marketing-hub', 'marketing_hub_url')")
  const pedido = psql('select public.marketing_invoke_publish_due()')
  let resposta = ''
  for (let i = 0; i < 20 && !resposta; i++) {
    await new Promise((r) => setTimeout(r, 500))
    resposta = psql(`select status_code from net._http_response where id = ${pedido}`)
  }
  ok(resposta === '200', 'E22 pg_cron → pg_net → marketing-hub responde 200', resposta)

  // Conta do dot: convite pelo NO_ADMIN, desligar corta na hora, religar volta.
  const convite = await http('POST', `${FN}/agent/create`, { token: tAdmin2, corpo: { request_id: `req-${nonce}-inv`, email: `hub-dot2-${nonce}@example.test` } })
  ok(convite.status === 200 && String(convite.body.convite_link).includes('/auth/v1/verify'), 'E23 convite do dot gerado', convite.status)
  criados.push(convite.body.resultado.user_id)
  const papel = await admin('GET', `/auth/v1/admin/users/${convite.body.resultado.user_id}`)
  ok(papel.body.app_metadata.role === 'MARKETING_AGENT', 'E24 conta convidada nasce MARKETING_AGENT')
  ok(!psql(`select coalesce(result::text,'') || coalesce(payload::text,'') from public.marketing_actions where request_id = 'req-${nonce}-inv'`).includes('token'), 'E25 link do convite fora do registro')

  const desligar = await http('POST', `${FN}/agent/disable`, { token: tAdmin2, corpo: { request_id: `req-${nonce}-off`, user_id: uDot.id } })
  ok(desligar.status === 200, 'E26 NO_ADMIN aal2 desliga o dot')
  const barrado = await http('GET', `${FN}/overview?periodo=7d`, { token: tDot })
  ok(barrado.status === 401, `E27 dot desligado → 401 com o token antigo (${barrado.status})`)
  const relogin = await http('POST', `${API}/auth/v1/token?grant_type=password`, { corpo: { email: uDot.email, password: senha } })
  ok(relogin.status >= 400, `E28 dot desligado não entra de novo (${relogin.status})`)
  ok((await http('POST', `${FN}/agent/disable`, { token: tAdmin2, corpo: { request_id: `req-${nonce}-adm`, user_id: uAdmin.id } })).status === 409, 'E29 desligar recusa conta que não é do dot')
  const religar = await http('POST', `${FN}/agent/enable`, { token: tAdmin2, corpo: { request_id: `req-${nonce}-on`, user_id: uDot.id } })
  ok(religar.status === 200 && (await http('GET', `${FN}/overview?periodo=7d`, { token: await entrar(uDot.email) })).status === 200, 'E30 dot religado volta a operar')

  console.log(`\n${passes.length} verificações passaram.`)
} finally {
  psql("delete from vault.secrets where name = 'marketing_hub_url'")
  if (postsTeste.length) psql(`delete from public.scheduled_posts where id in (${postsTeste.map((id) => `'${id}'`).join(',')})`)
  psql(`delete from public.marketing_actions where request_id like 'req-${nonce}-%'`)
  for (const id of criados) await admin('DELETE', `/auth/v1/admin/users/${id}`)
}

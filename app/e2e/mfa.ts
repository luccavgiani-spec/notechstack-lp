import { execFileSync } from 'node:child_process'
import { createHmac } from 'node:crypto'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'

// Desde o hub de marketing (C2), todo NO_ADMIN passa pelo TOTP. As fixtures
// cadastram o fator pela API do Auth local e os logins digitam o código.

function statusLocal() {
  const output = execFileSync('supabase', ['status', '-o', 'env'], {
    cwd: path.resolve(process.cwd(), '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  const valores = new Map<string, string>()
  for (const linha of output.split(/\r?\n/)) {
    const m = linha.match(/^([A-Z_]+)="(.*)"$/)
    if (m) valores.set(m[1], m[2])
  }
  const apiUrl = valores.get('API_URL')
  const anonKey = valores.get('ANON_KEY')
  if (!apiUrl || !anonKey) throw new Error('Supabase local indisponível para o MFA do E2E')
  return { apiUrl, anonKey }
}

function base32(segredo: string): Buffer {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const c of segredo.replace(/=+$/, '').toUpperCase()) bits += alfabeto.indexOf(c).toString(2).padStart(5, '0')
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(Number.parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}

// RFC 6238: SHA-1, passo de 30 s, 6 dígitos.
export function totp(segredo: string, agora = Date.now()): string {
  const contador = Buffer.alloc(8)
  contador.writeBigUInt64BE(BigInt(Math.floor(agora / 30_000)))
  const h = createHmac('sha1', base32(segredo)).update(contador).digest()
  const o = h[h.length - 1] & 0xf
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

async function auth(apiUrl: string, anonKey: string, caminho: string, corpo: unknown, token?: string) {
  const resp = await fetch(`${apiUrl}/auth/v1${caminho}`, {
    method: 'POST',
    headers: { apikey: anonKey, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(corpo),
  })
  const body = await resp.json() as Record<string, unknown>
  if (!resp.ok) throw new Error(`Auth ${caminho}: ${resp.status}`)
  return body
}

export async function cadastrarTotp(email: string, password: string): Promise<string> {
  const { apiUrl, anonKey } = statusLocal()
  const login = await auth(apiUrl, anonKey, '/token?grant_type=password', { email, password })
  const token = String(login.access_token)
  const fator = await auth(apiUrl, anonKey, '/factors', { factor_type: 'totp', friendly_name: 'e2e' }, token) as { id: string; totp: { secret: string } }
  const desafio = await auth(apiUrl, anonKey, `/factors/${fator.id}/challenge`, {}, token) as { id: string }
  await auth(apiUrl, anonKey, `/factors/${fator.id}/verify`, { challenge_id: desafio.id, code: totp(fator.totp.secret) }, token)
  return fator.totp.secret
}

export async function concluirMfa(page: Page, segredo: string) {
  await expect(page.getByLabel('Código de 6 dígitos')).toBeVisible()
  await page.getByLabel('Código de 6 dígitos').fill(totp(segredo))
  await page.getByRole('button', { name: 'Confirmar código' }).click()
}

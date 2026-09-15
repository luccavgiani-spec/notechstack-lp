import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [, , projectId, contentPath] = process.argv

function usage() {
  console.error('Uso: npm run skill:01 -- <projectId> <arquivo.json>')
}

if (!projectId || !contentPath) {
  usage()
  process.exitCode = 2
} else {
  const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '')
  const anonKey = process.env.SUPABASE_ANON_KEY
  const accessToken = process.env.NO_ADMIN_ACCESS_TOKEN

  if (!supabaseUrl || !anonKey || !accessToken) {
    console.error('Configuração ausente: SUPABASE_URL, SUPABASE_ANON_KEY e NO_ADMIN_ACCESS_TOKEN são obrigatórias.')
    process.exitCode = 1
  } else {
    try {
      const content = JSON.parse(await readFile(resolve(contentPath), 'utf8'))
      const response = await fetch(`${supabaseUrl}/functions/v1/skill-01-ativar-dashboard`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ projectId, content }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok || !body.inviteLink) {
        throw new Error(body.error_code || `HTTP_${response.status}`)
      }
      console.log(`Projeto: ${body.projectId}`)
      console.log(`Acesso liberado em: ${body.accessReleasedAt}`)
      console.log(`Convite: ${body.inviteLink}`)
    } catch (error) {
      console.error(`Skill 01 falhou: ${error instanceof Error ? error.message : 'erro desconhecido'}`)
      process.exitCode = 1
    }
  }
}

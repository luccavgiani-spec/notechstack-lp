import type { Session } from '@supabase/supabase-js'

// O Auth grava o nível de garantia no próprio JWT da sessão (claim `aal`).
export function sessionAal(session: Session | null): string | null {
  const token = session?.access_token
  if (!token) return null
  try {
    const payload = token.split('.')[1] ?? ''
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=')
    const aal = (JSON.parse(atob(base64)) as { aal?: unknown }).aal
    return typeof aal === 'string' ? aal : null
  } catch {
    return null
  }
}

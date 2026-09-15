import { createClient } from '@supabase/supabase-js'

function requiredEnvironmentValue(name: keyof ImportMetaEnv) {
  const value = import.meta.env[name]

  if (!value) {
    throw new Error(`Variável pública obrigatória ausente: ${name}`)
  }

  return value
}

export const supabase = createClient(
  requiredEnvironmentValue('VITE_SUPABASE_URL'),
  requiredEnvironmentValue('VITE_SUPABASE_ANON_KEY'),
)

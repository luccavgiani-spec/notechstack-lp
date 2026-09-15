import { createContext, use } from 'react'
import type { AuthError, Session, User } from '@supabase/supabase-js'

export type SignInResult = {
  user: User | null
  error: AuthError | null
}

export type UpdatePasswordResult = {
  user: User | null
  error: AuthError | null
}

export type AuthContextValue = {
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<SignInResult>
  updatePassword: (password: string) => Promise<UpdatePasswordResult>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = use(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }

  return context
}

import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    void supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) {
          setSession(data.session)
        }
      })
      .catch(() => {
        if (mounted) {
          setSession(null)
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false)
        }
      })

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession)
        setLoading(false)
      }
    })

    return () => {
      mounted = false
      data.subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (!error && data.session) {
      setSession(data.session)
    }

    return { user: data.user, error }
  }, [])

  const value = useMemo(
    () => ({
      session,
      loading,
      signIn,
    }),
    [loading, session, signIn],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

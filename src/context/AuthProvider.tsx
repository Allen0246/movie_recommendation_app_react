import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabaseClient'
import { AuthContext, type AuthContextValue } from './AuthContext'

async function fetchRoles(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('user_roles').select('role_name').eq('user_id', userId)
  if (error) {
    console.error('Failed to load roles', error)
    return []
  }
  return (data ?? []).map((row) => row.role_name)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  // supabase-js delivers the current session to onAuthStateChange immediately on
  // subscribe (event "INITIAL_SESSION"), so a separate getSession() call is both
  // redundant and racy: without a sequence guard, two overlapping role fetches
  // (e.g. the initial load racing a fast logout/login) can resolve out of order
  // and let a stale roles fetch overwrite the current user's roles.
  const requestIdRef = useRef(0)

  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const requestId = ++requestIdRef.current
      setSession(nextSession)

      if (!nextSession) {
        setRoles([])
        setLoading(false)
        return
      }

      fetchRoles(nextSession.user.id).then((nextRoles) => {
        if (requestId !== requestIdRef.current) return // superseded by a later auth event
        setRoles(nextRoles)
        setLoading(false)
      })
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    roles,
    loading,
    isAdmin: roles.includes('admin'),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

import { createContext } from 'react'
import type { Session, User } from '@supabase/supabase-js'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  roles: string[]
  loading: boolean
  isAdmin: boolean
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface AdminUserRow {
  id: string
  username: string
  role: string
}

// A user can (incorrectly, or transiently mid-role-change) have more than one
// user_roles row -- there's no unique constraint on user_id alone. Pick a single
// display role deterministically rather than erroring or picking arbitrarily.
function pickPrimaryRole(roleNames: string[]): string {
  if (roleNames.includes('admin')) return 'admin'
  return roleNames[0] ?? '-'
}

async function invokeAdminUsers<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body })
  if (error) throw error
  if (data?.ok === false) throw new Error(data.error ?? 'admin-users request failed')
  return data
}

export function useAdminUsersList() {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: async (): Promise<AdminUserRow[]> => {
      const { data: profiles, error: profilesError } = await supabase.from('profiles').select('id, username')
      if (profilesError) throw profilesError

      const { data: roles, error: rolesError } = await supabase.from('user_roles').select('user_id, role_name')
      if (rolesError) throw rolesError

      const roleNamesByUserId = new Map<string, string[]>()
      for (const r of roles ?? []) {
        const list = roleNamesByUserId.get(r.user_id)
        if (list) list.push(r.role_name)
        else roleNamesByUserId.set(r.user_id, [r.role_name])
      }
      return (profiles ?? []).map((p) => ({
        id: p.id,
        username: p.username,
        role: pickPrimaryRole(roleNamesByUserId.get(p.id) ?? []),
      }))
    },
  })
}

export function useAdminUser(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'users', userId],
    enabled: !!userId,
    queryFn: async (): Promise<AdminUserRow> => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', userId!)
        .single()
      if (profileError) throw profileError

      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role_name')
        .eq('user_id', userId!)
      if (roleError) throw roleError

      return {
        id: profile.id,
        username: profile.username,
        role: pickPrimaryRole((roles ?? []).map((r) => r.role_name)),
      }
    },
  })
}

export function useCreateAdminUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { email: string; password: string; username: string; role: 'admin' | 'user' }) =>
      invokeAdminUsers<{ ok: true; userId: string }>({ action: 'create', ...input }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useDeleteAdminUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => invokeAdminUsers<{ ok: true }>({ action: 'delete', userId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (input: { userId: string; password: string }) =>
      invokeAdminUsers<{ ok: true }>({ action: 'reset_password', ...input }),
  })
}

export function useUpdateUsername() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, username }: { userId: string; username: string }) => {
      const { error } = await supabase.from('profiles').update({ username }).eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      userId,
      previousRole,
      newRole,
    }: {
      userId: string
      previousRole: string
      newRole: 'admin' | 'user'
    }) => {
      if (previousRole === newRole) return
      // Insert the new role before deleting the old one: if the delete then fails,
      // the user is left with both roles (still has access) rather than none.
      const { error: insertError } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role_name: newRole })
      if (insertError) throw insertError
      if (previousRole !== '-') {
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_name', previousRole)
        if (deleteError) throw deleteError
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

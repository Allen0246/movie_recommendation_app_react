// Admin user management, replacing services/web/project/views/user.py.
// Creating/deleting an auth.users row or resetting another user's password
// requires the Supabase Admin API (service-role key), which can never run in
// the browser — so those three actions are funneled through this function.
// Username edits and role reassignment don't touch auth.users; the frontend
// performs those directly against profiles/user_roles under the admin RLS
// policies from the roles_and_profiles migration, no edge function needed.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateUserPayload {
  action: 'create'
  email: string
  password: string
  username: string
  role: 'admin' | 'user'
}

interface DeleteUserPayload {
  action: 'delete'
  userId: string
}

interface ResetPasswordPayload {
  action: 'reset_password'
  userId: string
  password: string
}

type RequestPayload = CreateUserPayload | DeleteUserPayload | ResetPasswordPayload

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ ok: false, error: 'Missing Authorization header.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Scoped to the caller's own JWT, so auth.uid()/has_role() resolve as *them* — this is
  // the authorization check, not the mutation client.
  const callerClient = createClient(supabaseUrl, serviceRoleKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: isAdmin, error: roleCheckError } = await callerClient.rpc('has_role', { _role: 'admin' })
  if (roleCheckError) {
    console.error(roleCheckError)
    return jsonResponse({ ok: false, error: 'Unable to verify caller role.' }, 500)
  }
  if (!isAdmin) {
    return jsonResponse({ ok: false, error: 'Admin role required.' }, 403)
  }

  const { data: callerData } = await callerClient.auth.getUser()
  const actorId = callerData.user?.id ?? null

  const payload = (await req.json().catch(() => null)) as RequestPayload | null
  if (!payload?.action) {
    return jsonResponse({ ok: false, error: 'Missing action.' }, 400)
  }

  // Service-role client used only after the caller has been verified as admin above.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  // Logged explicitly here (rather than relying only on the user_roles trigger) because
  // these three actions go through the Admin API directly and, for 'create'/'delete',
  // never touch a trigger-covered table at all — without this they'd be untraceable.
  async function logAction(action: string, targetUserId: string | null, details: Record<string, unknown> = {}) {
    const { error } = await adminClient
      .from('audit_log')
      .insert({ action, actor_id: actorId, target_user_id: targetUserId, details })
    if (error) console.error('Failed to write audit_log entry:', error)
  }

  try {
    switch (payload.action) {
      case 'create': {
        const { email, password, username, role } = payload
        const { data: created, error: createError } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { username },
        })
        if (createError) throw createError

        const newUserId = created.user.id
        // The handle_new_user trigger already granted the default 'user' role.
        if (role === 'admin') {
          const { error: roleError } = await adminClient
            .from('user_roles')
            .insert({ user_id: newUserId, role_name: 'admin' })
          if (roleError) {
            // The auth user (and its default 'user' role, via the trigger) already
            // exist at this point. Without rolling back, we'd report "failed" while
            // silently leaving a stray account behind, indistinguishable to the
            // admin from creation never having happened.
            const { error: rollbackError } = await adminClient.auth.admin.deleteUser(newUserId)
            if (rollbackError) console.error('Failed to roll back user after role-insert failure:', rollbackError)
            throw roleError
          }
          // user_roles has no unique constraint on user_id alone (its PK is
          // (user_id, role_name)), so without this the account would keep both
          // 'admin' and the trigger's default 'user' row. Downstream code (the
          // admin users list/edit queries) assumes one role per user, so leaving
          // both breaks editing this account afterward.
          const { error: demoteError } = await adminClient
            .from('user_roles')
            .delete()
            .eq('user_id', newUserId)
            .eq('role_name', 'user')
          if (demoteError) console.error('Failed to remove default user role after admin grant:', demoteError)
        }
        await logAction('admin_user_create', newUserId, { email, username, role })
        return jsonResponse({ ok: true, userId: newUserId })
      }

      case 'delete': {
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(payload.userId)
        if (deleteError) throw deleteError
        await logAction('admin_user_delete', payload.userId)
        return jsonResponse({ ok: true })
      }

      case 'reset_password': {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(payload.userId, {
          password: payload.password,
        })
        if (updateError) throw updateError
        await logAction('admin_user_reset_password', payload.userId)
        return jsonResponse({ ok: true })
      }

      default:
        return jsonResponse({ ok: false, error: 'Unknown action.' }, 400)
    }
  } catch (error) {
    console.error(error)
    return jsonResponse({ ok: false, error: 'Action failed. Check function logs for details.' }, 500)
  }
})

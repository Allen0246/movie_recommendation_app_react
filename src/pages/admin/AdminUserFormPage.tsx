import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  useAdminUser,
  useCreateAdminUser,
  useResetUserPassword,
  useUpdateUserRole,
  useUpdateUsername,
} from '../../hooks/useAdminUsers'
import { passwordSchema, emailSchema, usernameSchema } from '../../lib/passwordSchema'

export function AdminUserFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEditMode = !!id
  const navigate = useNavigate()

  const { data: existingUser, isLoading, isError } = useAdminUser(id)
  const createUser = useCreateAdminUser()
  const updateUsername = useUpdateUsername()
  const updateRole = useUpdateUserRole()
  const resetPassword = useResetUserPassword()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'admin' | 'user'>('user')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (existingUser) {
      setUsername(existingUser.username)
      setRole(existingUser.role === 'admin' ? 'admin' : 'user')
    }
  }, [existingUser])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    // Validate every field up front, before triggering any mutation: previously the
    // edit-mode path saved username/role first and only validated the new password
    // afterward, so a weak password left those changes persisted with no indication
    // to the admin that the save was only partial.
    const usernameResult = usernameSchema.safeParse(username)
    if (!usernameResult.success) {
      setError(usernameResult.error.issues[0].message)
      return
    }
    // Trim once and reuse everywhere below — otherwise a whitespace-only password
    // passes the "did they type anything" check but the untrimmed value gets sent.
    const trimmedPassword = password.trim()
    const willChangePassword = isEditMode ? trimmedPassword !== '' : true
    if (willChangePassword) {
      const passwordResult = passwordSchema.safeParse(trimmedPassword)
      if (!passwordResult.success) {
        setError(passwordResult.error.issues[0].message)
        return
      }
    }
    if (!isEditMode) {
      const emailResult = emailSchema.safeParse(email)
      if (!emailResult.success) {
        setError(emailResult.error.issues[0].message)
        return
      }
    }

    setSubmitting(true)
    try {
      if (isEditMode && existingUser) {
        if (username !== existingUser.username) {
          await updateUsername.mutateAsync({ userId: existingUser.id, username })
        }
        if (role !== existingUser.role) {
          await updateRole.mutateAsync({ userId: existingUser.id, previousRole: existingUser.role, newRole: role })
        }
        if (willChangePassword) {
          await resetPassword.mutateAsync({ userId: existingUser.id, password: trimmedPassword })
        }
      } else {
        await createUser.mutateAsync({ email, password: trimmedPassword, username, role })
      }
      navigate('/admin/users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setSubmitting(false)
    }
  }

  if (isEditMode && isLoading) return <p>Loading user...</p>
  if (isEditMode && isError) return <p role="alert">Failed to load this user. Please go back and try again.</p>

  return (
    <section>
      <h1>{isEditMode ? 'Edit user' : 'Add user'}</h1>
      <form onSubmit={handleSubmit}>
        {!isEditMode && (
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
        )}
        <div>
          <label htmlFor="username">Username</label>
          <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password">{isEditMode ? 'New password (leave blank to keep current)' : 'Password'}</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div>
          <label htmlFor="role">Role</label>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'user')}>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </form>
    </section>
  )
}

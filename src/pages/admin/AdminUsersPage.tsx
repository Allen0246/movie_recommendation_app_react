import { Link } from 'react-router-dom'
import { useAdminUsersList, useDeleteAdminUser } from '../../hooks/useAdminUsers'

export function AdminUsersPage() {
  const { data: users, isLoading } = useAdminUsersList()
  const deleteUser = useDeleteAdminUser()

  if (isLoading) return <p>Loading users...</p>

  return (
    <section>
      <h1>Users</h1>
      <div className="toolbar">
        <Link className="btn" to="/admin/users/new">
          Add user
        </Link>
      </div>
      {deleteUser.isError && (
        <p role="alert">
          Failed to delete user: {deleteUser.error instanceof Error ? deleteUser.error.message : 'Unknown error'}
        </p>
      )}
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {(users ?? []).map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{user.role}</td>
              <td>
                <Link className="btn" to={`/admin/users/${user.id}/edit`}>
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete user "${user.username}"?`)) deleteUser.mutate(user.id)
                  }}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

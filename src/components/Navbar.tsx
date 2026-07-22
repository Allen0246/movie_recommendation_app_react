import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'

export function Navbar() {
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  if (!user) return null

  async function handleLogout() {
    await supabase.auth.signOut()
    // Query keys are scoped by user.id so there's no cross-account display bug,
    // but without this the previous session's cached data (e.g. a full admin user
    // list) stays resident in memory after logout.
    queryClient.clear()
    navigate('/', { replace: true })
  }

  return (
    <nav className="navbar">
      <div className="navbar__bar">
        <Link className="navbar__brand" to="/home">
          Movie App
        </Link>
        <ul className="navbar__links">
          <li>
            <Link to="/home">Home</Link>
          </li>
          <li>
            <Link to="/movies">Movies</Link>
          </li>
          <li>
            <Link to="/my-movies">My Movies</Link>
          </li>
          <li>
            <Link to="/recommendation">Recommendation</Link>
          </li>
          {isAdmin && (
            <>
              <li>
                <Link to="/admin/users">Users</Link>
              </li>
              <li>
                <Link to="/admin/logs">Audit Log</Link>
              </li>
            </>
          )}
        </ul>
        <button className="navbar__logout" type="button" onClick={handleLogout}>
          Log out
        </button>
      </div>
    </nav>
  )
}

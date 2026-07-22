import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export function HomePage() {
  const { user } = useAuth()

  return (
    <section>
      <h1>Welcome{user?.user_metadata?.username ? `, ${user.user_metadata.username}` : ''}</h1>
      <ul className="home-links">
        <li>
          <Link to="/movies">Browse movies</Link>
        </li>
        <li>
          <Link to="/my-movies">My movies</Link>
        </li>
        <li>
          <Link to="/recommendation">Get a recommendation</Link>
        </li>
      </ul>
    </section>
  )
}

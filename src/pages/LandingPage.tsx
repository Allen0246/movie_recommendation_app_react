import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { AuthLayout } from '../components/AuthLayout'

export function LandingPage() {
  const { user, loading } = useAuth()

  if (loading) return <p>Loading...</p>
  if (user) return <Navigate to="/home" replace />

  return (
    <AuthLayout>
      <h1>Movie App</h1>
      <p>Track movies, rate what you've watched, and get genre-based recommendations.</p>
      <Link className="btn" to="/login">
        Log in
      </Link>
      <Link className="btn" to="/register">
        Sign up
      </Link>
    </AuthLayout>
  )
}

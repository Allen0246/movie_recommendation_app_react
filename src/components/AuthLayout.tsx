import type { ReactNode } from 'react'
import movieSeats from '../assets/movie-seats.jpg'

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card__image" style={{ backgroundImage: `url(${movieSeats})` }} />
        <div className="auth-card__form">{children}</div>
      </div>
    </div>
  )
}

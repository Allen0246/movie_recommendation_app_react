import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from '../ProtectedRoute'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth')
const mockedUseAuth = vi.mocked(useAuth)

function renderProtected() {
  render(
    <MemoryRouter initialEntries={['/secret']}>
      <Routes>
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/secret"
          element={
            <ProtectedRoute>
              <p>Secret content</p>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows a loading state while auth is resolving', () => {
    mockedUseAuth.mockReturnValue({ user: null, session: null, roles: [], loading: true, isAdmin: false })
    renderProtected()
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('redirects to /login when unauthenticated', () => {
    mockedUseAuth.mockReturnValue({ user: null, session: null, roles: [], loading: false, isAdmin: false })
    renderProtected()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockedUseAuth.mockReturnValue({
      // @ts-expect-error partial user object is enough for this test
      user: { id: 'u1' },
      session: null,
      roles: ['user'],
      loading: false,
      isAdmin: false,
    })
    renderProtected()
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })
})

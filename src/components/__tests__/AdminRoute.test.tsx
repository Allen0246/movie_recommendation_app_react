import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { AdminRoute } from '../AdminRoute'
import { useAuth } from '../../hooks/useAuth'

vi.mock('../../hooks/useAuth')
const mockedUseAuth = vi.mocked(useAuth)

function renderAdmin() {
  render(
    <MemoryRouter initialEntries={['/admin/secret']}>
      <Routes>
        <Route path="/" element={<p>Home page</p>} />
        <Route path="/login" element={<p>Login page</p>} />
        <Route
          path="/admin/secret"
          element={
            <AdminRoute>
              <p>Admin content</p>
            </AdminRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('AdminRoute', () => {
  it('redirects to /login when unauthenticated', () => {
    mockedUseAuth.mockReturnValue({ user: null, session: null, roles: [], loading: false, isAdmin: false })
    renderAdmin()
    expect(screen.getByText('Login page')).toBeInTheDocument()
  })

  it('redirects a non-admin user to /', () => {
    mockedUseAuth.mockReturnValue({
      // @ts-expect-error partial user object is enough for this test
      user: { id: 'u1' },
      session: null,
      roles: ['user'],
      loading: false,
      isAdmin: false,
    })
    renderAdmin()
    expect(screen.getByText('Home page')).toBeInTheDocument()
  })

  it('renders children for an admin user', () => {
    mockedUseAuth.mockReturnValue({
      // @ts-expect-error partial user object is enough for this test
      user: { id: 'u1' },
      session: null,
      roles: ['admin'],
      loading: false,
      isAdmin: true,
    })
    renderAdmin()
    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })
})

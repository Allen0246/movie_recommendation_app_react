import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/__tests__/supabaseClient.mock'
import { LoginPage } from '../LoginPage'

vi.mock('../../lib/supabaseClient', () => ({ supabase }))

describe('LoginPage', () => {
  it('shows validation errors for empty submission', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findAllByText(/this field is required/i)).not.toHaveLength(0)
    expect(supabase.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('calls signInWithPassword with the entered credentials', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'somepassword')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() =>
      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'somepassword',
      }),
    )
  })

  it('shows an error message on incorrect credentials', async () => {
    supabase.auth.signInWithPassword.mockResolvedValueOnce({ error: { message: 'Invalid login credentials' } })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    )

    await user.type(screen.getByLabelText(/email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/^password$/i), 'wrongpassword')
    await user.click(screen.getByRole('button', { name: /log in/i }))

    expect(await screen.findByText(/incorrect email or password/i)).toBeInTheDocument()
  })
})

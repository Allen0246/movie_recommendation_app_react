import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../../lib/__tests__/supabaseClient.mock'
import { RegisterPage } from '../RegisterPage'

vi.mock('../../lib/supabaseClient', () => ({ supabase }))

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { email = 'newuser@example.com', username = 'newuser', password = 'Passw0rd!', confirmPassword = 'Passw0rd!' } = {},
) {
  await user.type(screen.getByLabelText(/email/i), email)
  await user.type(screen.getByLabelText(/username/i), username)
  await user.type(screen.getByLabelText(/^password$/i), password)
  await user.type(screen.getByLabelText(/confirm password/i), confirmPassword)
}

describe('RegisterPage', () => {
  it('rejects a password missing complexity requirements', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await fillForm(user, { password: 'alllowercase1!', confirmPassword: 'alllowercase1!' })
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(await screen.findByText(/must contain at least one uppercase letter/i)).toBeInTheDocument()
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('rejects mismatched password confirmation', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await fillForm(user, { password: 'Passw0rd!', confirmPassword: 'Different1!' })
    await user.click(screen.getByRole('button', { name: /register/i }))

    expect(await screen.findByText(/password verification failed/i)).toBeInTheDocument()
    expect(supabase.auth.signUp).not.toHaveBeenCalled()
  })

  it('calls signUp with email, password, and username metadata on valid submission', async () => {
    supabase.auth.signUp.mockResolvedValueOnce({ error: null })
    const user = userEvent.setup()
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    )

    await fillForm(user)
    await user.click(screen.getByRole('button', { name: /register/i }))

    await waitFor(() =>
      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: 'newuser@example.com',
        password: 'Passw0rd!',
        options: { data: { username: 'newuser' } },
      }),
    )
  })
})

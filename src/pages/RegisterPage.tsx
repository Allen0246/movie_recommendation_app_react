import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { registerSchema, type RegisterFormValues } from '../lib/passwordSchema'
import { AuthLayout } from '../components/AuthLayout'

export function RegisterPage() {
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) })

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null)
    const { error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: { data: { username: values.username } },
    })
    if (error) {
      // Normalized like LoginPage's error handling: Supabase's raw message (e.g.
      // "User already registered") would otherwise reveal whether an email has an
      // account, a classic enumeration vector.
      setFormError('Unable to create account. Please check your details and try again.')
      return
    }
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout>
      <h1>Register</h1>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...register('email')} />
          {errors.email && <p role="alert">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="username">Username</label>
          <input id="username" type="text" autoComplete="username" {...register('username')} />
          {errors.username && <p role="alert">{errors.username.message}</p>}
        </div>
        <div>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" autoComplete="new-password" {...register('password')} />
          {errors.password && <p role="alert">{errors.password.message}</p>}
        </div>
        <div>
          <label htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            {...register('confirmPassword')}
          />
          {errors.confirmPassword && <p role="alert">{errors.confirmPassword.message}</p>}
        </div>
        {formError && <p role="alert">{formError}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating account...' : 'Register'}
        </button>
      </form>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  )
}

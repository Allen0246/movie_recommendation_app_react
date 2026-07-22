import { z } from 'zod'

// Ported verbatim from the original app's services/web/project/forms/register.py
const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).+$/

export const passwordSchema = z
  .string()
  .min(8, 'Minimum 8 characters.')
  .regex(
    PASSWORD_COMPLEXITY_REGEX,
    'Must contain at least one uppercase letter, one lowercase letter, one number, and one other character: @$!%*?&',
  )

export const usernameSchema = z
  .string()
  .trim()
  .min(1, 'This field is required.')
  .max(100, 'Username must be at most 100 characters.')

export const emailSchema = z.string().trim().min(1, 'This field is required.').email('Enter a valid email address.')

export const registerSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'This field is required.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Password verification failed.',
    path: ['confirmPassword'],
  })

export type RegisterFormValues = z.infer<typeof registerSchema>

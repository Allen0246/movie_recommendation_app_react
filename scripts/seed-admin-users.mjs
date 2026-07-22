#!/usr/bin/env node
// Mirrors the Flask app's startup auto-seed of default admin/user accounts:
// idempotent, safe to run on every dev startup (wired as `predev`) as well as
// manually against any environment:
//   node scripts/seed-admin-users.mjs
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (service role key must never
// be committed or shipped to the browser) plus the DEFAULT_* vars, all read from
// the environment (see .env.example).

import { logger } from './lib/logger.mjs'

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DEFAULT_ADMIN_EMAIL',
  'DEFAULT_ADMIN_PASSWORD',
  'DEFAULT_ADMIN_USERNAME',
  'DEFAULT_USER_EMAIL',
  'DEFAULT_USER_PASSWORD',
  'DEFAULT_USER_USERNAME',
]
const missing = required.filter((name) => !process.env[name])
if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
  DEFAULT_USER_EMAIL,
  DEFAULT_USER_PASSWORD,
  DEFAULT_USER_USERNAME,
} = process.env

async function adminFetch(path, options) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(`${options?.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(payload)}`)
  }
  return payload
}

// GoTrue's GET /admin/users only supports page/per_page pagination, not a
// server-side email filter (the `email=` query param below is silently ignored) —
// so a single unpaginated request only ever checked whatever the default first
// page returned. Against an environment with more users than fit on one page,
// that produced a false "not found", and createUser then failed on the
// already-registered email. Page through explicitly instead.
const MAX_PAGES = 1000 // sane ceiling (200k users at 200/page) against a runaway loop

async function findUserByEmail(email) {
  const perPage = 200
  for (let page = 1; page <= MAX_PAGES; page++) {
    const payload = await adminFetch(`/auth/v1/admin/users?page=${page}&per_page=${perPage}`)
    const users = Array.isArray(payload) ? payload : (payload.users ?? [])
    const match = users.find((existingUser) => existingUser.email === email)
    if (match) return match
    if (users.length < perPage) return undefined
  }
  throw new Error(`Exceeded ${MAX_PAGES} pages while searching for ${email}.`)
}

async function createUser(email, password, username) {
  return adminFetch('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { username } }),
  })
}

async function ensureUser(email, password, username) {
  const existing = await findUserByEmail(email)
  if (existing) {
    logger.info(`  ${email} already exists (${existing.id}), skipping creation.`)
    return existing
  }
  const created = await createUser(email, password, username)
  logger.success(`  created ${email} (${created.id}).`)
  return created
}

async function grantAdminRole(userId) {
  // The handle_new_user trigger already grants 'user'; this adds 'admin' on top, then
  // removes 'user' so the account ends up with exactly one role row (user_roles has no
  // unique constraint on user_id alone, and the admin UI's role lookup assumes one row
  // per user). ignore-duplicates makes the insert safe to call even if 'admin' was
  // already granted (e.g. re-running this script against an existing environment).
  await adminFetch('/rest/v1/user_roles', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ user_id: userId, role_name: 'admin' }),
  })
  await adminFetch(`/rest/v1/user_roles?user_id=eq.${userId}&role_name=eq.user`, {
    method: 'DELETE',
  })
}

async function main() {
  logger.info(`Ensuring default admin account (${DEFAULT_ADMIN_EMAIL})...`)
  const admin = await ensureUser(DEFAULT_ADMIN_EMAIL, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_USERNAME)
  await grantAdminRole(admin.id)

  logger.info(`Ensuring default user account (${DEFAULT_USER_EMAIL})...`)
  await ensureUser(DEFAULT_USER_EMAIL, DEFAULT_USER_PASSWORD, DEFAULT_USER_USERNAME)

  logger.success('Done.')
}

main().catch((error) => {
  logger.error(error.message)
  process.exit(1)
})

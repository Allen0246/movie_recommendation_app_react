#!/usr/bin/env node
// One-time historical backfill, run once per environment after tmdb-sync is deployed
// and its TMDB_TOKEN/TMDB_HOSTNAME secrets are set:
//   node scripts/bootstrap-tmdb-sync.mjs
//
// Mirrors the original app's PRIMARY_RELEASE_DATE_GTE config option, but as a one-off
// script instead of a persistent env var — routine syncs (cron + the "Update" button)
// always default to "today" and stay fast; only this script pulls a wide date range.

import { logger } from './lib/logger.mjs'

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'PRIMARY_RELEASE_DATE_GTE']
const missing = required.filter((name) => !process.env[name])
if (missing.length > 0) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, PRIMARY_RELEASE_DATE_GTE } = process.env
const to = new Date().toISOString().slice(0, 10)

logger.info(`Backfilling movies from ${PRIMARY_RELEASE_DATE_GTE} to ${to}. This may take a while...`)

const response = await fetch(`${SUPABASE_URL}/functions/v1/tmdb-sync`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ from: PRIMARY_RELEASE_DATE_GTE, to }),
})

const payload = await response.json().catch(() => ({}))
if (!response.ok || payload.ok === false) {
  logger.error(`tmdb-sync failed (${response.status}):`, payload)
  process.exit(1)
}

logger.success(`Done: ${payload.genres} genres, ${payload.movies} movies upserted.`)

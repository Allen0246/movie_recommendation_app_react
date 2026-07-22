// Server-side TMDB proxy, replacing services/web/project/extensions/REST_THEMOVIEDB.py
// and the Flask app's startup genre/movie seeding. The TMDB Read Access Token lives
// only here (as a Supabase secret), never in frontend code.
//
// Invoked three ways, all authenticated (see requireCaller below — the platform's
// verify_jwt only proves the request carries *a* valid project JWT, e.g. the public
// anon key qualifies, so this function must still check *who* it is itself):
//   1. Manually, via the "Update" button on the Movies page (any logged-in user).
//   2. Daily via pg_cron (see supabase/migrations/..._schedule_tmdb_sync.sql), using
//      the service-role key as its bearer token.
//   3. scripts/bootstrap-tmdb-sync.mjs for a one-time historical backfill, also
//      using the service-role key.
// The button and cron both send an empty body, so `from`/`to` default to today —
// keeping routine runs fast. Only the service-role callers (2 and 3) may request a
// wider historical range; a merely-logged-in user is capped to a short window so a
// crafted request can't force a huge/slow TMDB crawl (see MAX_USER_RANGE_DAYS).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_USER_RANGE_DAYS = 31
const MAX_PAGES = 500 // TMDB's own /discover ceiling; a hard stop either way.

interface CallerContext {
  role: 'service_role' | 'authenticated'
  userId: string | null
}

// The gateway already verified the JWT's signature (verify_jwt defaults to true), so
// decoding the payload here is safe — we're reading claims, not re-authenticating.
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const [, payload] = token.split('.')
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return null
  }
}

function requireCaller(req: Request): CallerContext {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing Authorization header.')
  }
  const claims = decodeJwtPayload(authHeader.slice('Bearer '.length))
  if (!claims) {
    throw new HttpError(401, 'Invalid Authorization token.')
  }
  const role = claims.role
  if (role === 'service_role') {
    return { role: 'service_role', userId: null }
  }
  if (role === 'authenticated' && typeof claims.sub === 'string') {
    return { role: 'authenticated', userId: claims.sub }
  }
  // Covers the anon-key case (role "anon") and anything else unrecognized.
  throw new HttpError(403, 'Authentication required.')
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

interface TmdbGenre {
  id: number
  name: string
}

interface TmdbMovie {
  id: number
  title: string
  overview: string | null
  popularity: number | null
  release_date: string | null
  genre_ids: number[]
}

const TMDB_HOSTNAME = Deno.env.get('TMDB_HOSTNAME') ?? 'api.themoviedb.org'
const TMDB_TOKEN = Deno.env.get('TMDB_TOKEN')!

// TMDB has two credential types that authenticate differently: a short (32-char)
// v3 "API Key" sent as an `api_key` query param, or a long v4 "API Read Access
// Token" (JWT-shaped) sent as a Bearer header. Support both so TMDB_TOKEN works
// regardless of which one was issued.
const isV4ReadAccessToken = TMDB_TOKEN.length > 40

function tmdbUrl(path: string, params: Record<string, string>): URL {
  const url = new URL(`https://${TMDB_HOSTNAME}/3${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  if (!isV4ReadAccessToken) url.searchParams.set('api_key', TMDB_TOKEN)
  return url
}

async function tmdbFetch(url: URL): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...(isV4ReadAccessToken ? { Authorization: `Bearer ${TMDB_TOKEN}` } : {}),
    },
  })
  if (!response.ok) {
    throw new Error(`TMDB request failed (${response.status}): ${url.pathname}`)
  }
  return response.json()
}

async function fetchAllPages<T>(
  path: string,
  params: Record<string, string>,
  resultsKey: string,
): Promise<T[]> {
  const first = await tmdbFetch(tmdbUrl(path, { ...params, page: '1' }))
  const items: T[] = [...((first[resultsKey] as T[]) ?? [])]
  const totalPages = Math.min(Number(first.total_pages ?? 1), MAX_PAGES)

  for (let page = 2; page <= totalPages; page++) {
    const payload = await tmdbFetch(tmdbUrl(path, { ...params, page: String(page) }))
    items.push(...((payload[resultsKey] as T[]) ?? []))
  }
  return items
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const caller = requireCaller(req)

    const body = await req.json().catch(() => ({}))
    const today = new Date().toISOString().slice(0, 10)
    const from = typeof body.from === 'string' ? body.from : today
    const to = typeof body.to === 'string' ? body.to : today

    if (!DATE_RE.test(from) || !DATE_RE.test(to) || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to))) {
      throw new HttpError(400, 'from/to must be valid YYYY-MM-DD dates.')
    }
    if (to < from) {
      throw new HttpError(400, '"to" must not be before "from".')
    }
    // Only the service-role callers (cron, bootstrap script) may request a range
    // wider than a merely-logged-in user clicking "Update" — see file header.
    if (caller.role === 'authenticated') {
      const spanDays = (Date.parse(to) - Date.parse(from)) / 86_400_000
      if (spanDays > MAX_USER_RANGE_DAYS) {
        throw new HttpError(400, `Date range too wide (max ${MAX_USER_RANGE_DAYS} days for this caller).`)
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const tmdbGenres = await fetchAllPages<TmdbGenre>('/genre/movie/list', {}, 'genres')
    if (tmdbGenres.length > 0) {
      const { error } = await supabase
        .from('genres')
        .upsert(
          tmdbGenres.map((g) => ({ tmdb_id: g.id, name: g.name })),
          { onConflict: 'tmdb_id' },
        )
      if (error) throw error
    }

    const { data: genreRows, error: genreReadError } = await supabase
      .from('genres')
      .select('id, tmdb_id')
    if (genreReadError) throw genreReadError
    const genreIdByTmdbId = new Map((genreRows ?? []).map((g) => [g.tmdb_id as number, g.id as number]))

    const tmdbMovies = await fetchAllPages<TmdbMovie>(
      '/discover/movie',
      { 'primary_release_date.gte': from, 'primary_release_date.lte': to },
      'results',
    )

    let upsertedCount = 0
    if (tmdbMovies.length > 0) {
      const { data: upsertedMovies, error: movieError } = await supabase
        .from('movies')
        .upsert(
          tmdbMovies.map((m) => ({
            tmdb_id: m.id,
            title: m.title,
            overview: m.overview,
            popularity: m.popularity,
            release_date: m.release_date || null,
          })),
          { onConflict: 'tmdb_id' },
        )
        .select('id, tmdb_id')
      if (movieError) throw movieError
      upsertedCount = upsertedMovies?.length ?? 0

      const movieIdByTmdbId = new Map(
        (upsertedMovies ?? []).map((m) => [m.tmdb_id as number, m.id as number]),
      )
      const movieGenreLinks = tmdbMovies.flatMap((m) => {
        const movieId = movieIdByTmdbId.get(m.id)
        if (!movieId) return []
        return (m.genre_ids ?? [])
          .map((tmdbGenreId) => genreIdByTmdbId.get(tmdbGenreId))
          .filter((genreId): genreId is number => genreId !== undefined)
          .map((genreId) => ({ movie_id: movieId, genre_id: genreId }))
      })

      if (movieGenreLinks.length > 0) {
        const { error: linkError } = await supabase
          .from('movie_genres')
          .upsert(movieGenreLinks, { onConflict: 'movie_id,genre_id' })
        if (linkError) throw linkError
      }
    }

    const { error: auditError } = await supabase.from('audit_log').insert({
      action: 'tmdb_sync',
      actor_id: caller.userId,
      details: { from, to, genres: tmdbGenres.length, movies: upsertedCount, triggeredBy: caller.role },
    })
    if (auditError) console.error('Failed to write audit log for tmdb_sync:', auditError)

    return new Response(
      JSON.stringify({ ok: true, genres: tmdbGenres.length, movies: upsertedCount, from, to }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error(error)
    const status = error instanceof HttpError ? error.status : 500
    const message = error instanceof HttpError ? error.message : 'Sync failed. Check function logs for details.'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

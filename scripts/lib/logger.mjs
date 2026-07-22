// Shared logger for local dev/ops scripts (scripts/*.mjs). Not used by the frontend
// (browsers can't write files) or the Supabase edge functions (no durable local
// filesystem there - use `supabase functions logs` / Studio for those instead).
//
// Prints readable, timestamped, color-coded lines to the console and appends the
// same lines (without color codes) to logs/YYYY-MM-DD.log, so a day's run history
// can be reviewed later by opening that day's file.

import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const LOG_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'logs')

const COLORS = {
  info: '\x1b[36m',
  warn: '\x1b[33m',
  error: '\x1b[31m',
  success: '\x1b[32m',
}
const RESET = '\x1b[0m'

// Bucketing and timestamps use local wall-clock time, not UTC: this is a
// single-developer local dev tool, so "today's file" should match the
// calendar day on the machine running it, not UTC's.
function pad(n) {
  return String(n).padStart(2, '0')
}

function localTimestamp(date) {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return { datePart, stamp: `${datePart} ${timePart}` }
}

function format(args) {
  return args.map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg, null, 2))).join(' ')
}

function write(level, args) {
  const { datePart, stamp } = localTimestamp(new Date())
  const line = `[${stamp}] ${level.toUpperCase().padEnd(7)} ${format(args)}`
  const stream = level === 'error' || level === 'warn' ? console.error : console.log
  stream(`${COLORS[level] ?? ''}${line}${RESET}`)

  mkdirSync(LOG_DIR, { recursive: true })
  appendFileSync(join(LOG_DIR, `${datePart}.log`), `${line}\n`)
}

export const logger = {
  info: (...args) => write('info', args),
  warn: (...args) => write('warn', args),
  error: (...args) => write('error', args),
  success: (...args) => write('success', args),
}

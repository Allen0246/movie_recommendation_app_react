import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

const RECENT_LIMIT = 200

// `date` is a "YYYY-MM-DD" local-calendar-day string (from an <input type="date">).
// Parsing it without a timezone suffix makes JS treat it as local midnight, so the
// filtered range matches the admin's own calendar day, not UTC's.
function localDayRange(date: string) {
  const start = new Date(`${date}T00:00:00`)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function useAuditLog(date?: string) {
  return useQuery({
    queryKey: ['admin', 'audit_log', date ?? 'recent'],
    queryFn: async () => {
      let query = supabase
        .from('audit_log')
        .select('id, occurred_at, actor_id, action, details')
        .order('occurred_at', { ascending: false })

      if (date) {
        const { start, end } = localDayRange(date)
        query = query.gte('occurred_at', start).lt('occurred_at', end)
      } else {
        query = query.limit(RECENT_LIMIT)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

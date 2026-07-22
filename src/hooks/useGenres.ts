import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: async () => {
      const { data, error } = await supabase.from('genres').select('id, name').order('name')
      if (error) throw error
      return data
    },
  })
}

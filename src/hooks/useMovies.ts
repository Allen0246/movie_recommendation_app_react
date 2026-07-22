import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

export interface MovieWithGenres {
  id: number
  title: string
  overview: string | null
  popularity: number | null
  release_date: string | null
  genres: string[]
}

export function useMovies() {
  return useQuery({
    queryKey: ['movies'],
    queryFn: async (): Promise<MovieWithGenres[]> => {
      const { data, error } = await supabase
        .from('movies')
        .select('id, title, overview, popularity, release_date, movie_genres(genres(name))')
        .order('title')
      if (error) throw error

      return (data ?? []).map((movie) => ({
        id: movie.id,
        title: movie.title,
        overview: movie.overview,
        popularity: movie.popularity,
        release_date: movie.release_date,
        genres: movie.movie_genres.map((mg) => mg.genres?.name).filter((name): name is string => !!name),
      }))
    },
  })
}

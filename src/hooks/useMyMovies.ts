import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'

export interface WatchedMovie {
  id: number
  movie_id: number
  rating: number | null
  watched_date: string
  title: string
  overview: string | null
  popularity: number | null
  release_date: string | null
  genres: string[]
}

export function useMyMovies() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['user_movies', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<WatchedMovie[]> => {
      const { data, error } = await supabase
        .from('user_movies')
        .select(
          'id, movie_id, rating, watched_date, movies(title, overview, popularity, release_date, movie_genres(genres(name)))',
        )
        .order('watched_date', { ascending: false })
      if (error) throw error

      return (data ?? [])
        .filter((row) => row.movies)
        .map((row) => ({
          id: row.id,
          movie_id: row.movie_id,
          rating: row.rating,
          watched_date: row.watched_date,
          title: row.movies!.title,
          overview: row.movies!.overview,
          popularity: row.movies!.popularity,
          release_date: row.movies!.release_date,
          genres: row.movies!.movie_genres.map((mg) => mg.genres?.name).filter((name): name is string => !!name),
        }))
    },
  })
}

// Returns a Map from movie_id to that movie's user_movies row id, so callers can
// both check watched-status (`.has(movieId)`) and resolve the row id they need for
// rewatch/unwatch mutations — without a separate ad-hoc query per click (which
// previously duplicated this same lookup in MoviesPage and silently dropped errors).
export function useWatchedMovieIds() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['user_movie_ids', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Map<number, number>> => {
      const { data, error } = await supabase.from('user_movies').select('id, movie_id')
      if (error) throw error
      return new Map((data ?? []).map((row) => [row.movie_id, row.id]))
    },
  })
}

export function useMarkWatched() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      movieId,
      rating,
      watchedDate,
    }: {
      movieId: number
      rating: number
      watchedDate: string
    }) => {
      if (!user) throw new Error('Not authenticated')
      const { error } = await supabase
        .from('user_movies')
        .insert({ user_id: user.id, movie_id: movieId, rating, watched_date: watchedDate })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_movies'] })
      queryClient.invalidateQueries({ queryKey: ['user_movie_ids'] })
    },
  })
}

export function useRewatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userMovieId,
      rating,
      watchedDate,
    }: {
      userMovieId: number
      rating: number
      watchedDate: string
    }) => {
      const { error } = await supabase
        .from('user_movies')
        .update({ rating, watched_date: watchedDate })
        .eq('id', userMovieId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_movies'] })
      queryClient.invalidateQueries({ queryKey: ['user_movie_ids'] })
    },
  })
}

export function useUnwatch() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userMovieId: number) => {
      const { error } = await supabase.from('user_movies').delete().eq('id', userMovieId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user_movies'] })
      queryClient.invalidateQueries({ queryKey: ['user_movie_ids'] })
    },
  })
}

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'
import { exportToExcel } from '../lib/exportToExcel'
import { useMovies, type MovieWithGenres } from '../hooks/useMovies'
import { useMarkWatched, useRewatch, useUnwatch, useWatchedMovieIds } from '../hooks/useMyMovies'
import { MovieTable } from '../components/MovieTable'
import { RatingDialog } from '../components/RatingDialog'

export function MoviesPage() {
  const { data: movies, isLoading } = useMovies()
  const { data: watchedIds } = useWatchedMovieIds()
  const markWatched = useMarkWatched()
  const rewatch = useRewatch()
  const unwatch = useUnwatch()
  const queryClient = useQueryClient()

  const [dialogMovie, setDialogMovie] = useState<MovieWithGenres | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  async function handleUpdate() {
    setUpdating(true)
    setUpdateMessage(null)
    try {
      const { data, error } = await supabase.functions.invoke('tmdb-sync', { body: {} })
      if (error) throw error
      setUpdateMessage(`Synced ${data.movies} movies, ${data.genres} genres.`)
      queryClient.invalidateQueries({ queryKey: ['movies'] })
    } catch (error) {
      setUpdateMessage(error instanceof Error ? error.message : 'Update failed.')
    } finally {
      setUpdating(false)
    }
  }

  function handleExport() {
    if (!movies) return
    exportToExcel(
      movies.map((m) => ({
        title: m.title,
        overview: m.overview,
        release_date: m.release_date,
        popularity: m.popularity,
      })),
      'movies',
      'movies',
    )
  }

  if (isLoading) return <p>Loading movies...</p>

  return (
    <section>
      <h1>Movies</h1>
      <div className="toolbar">
        <button type="button" onClick={handleUpdate} disabled={updating}>
          {updating ? 'Updating...' : 'Update from TMDB'}
        </button>
        <button type="button" onClick={handleExport}>
          Export to Excel
        </button>
      </div>
      {updateMessage && <p>{updateMessage}</p>}
      {actionError && <p role="alert">{actionError}</p>}

      <MovieTable
        rows={movies ?? []}
        renderActions={(movie) => {
          const userMovieId = watchedIds?.get(movie.id)
          return userMovieId !== undefined ? (
            <>
              <button type="button" onClick={() => setDialogMovie(movie)}>
                Rewatch
              </button>
              <button
                type="button"
                onClick={() => {
                  setActionError(null)
                  unwatch.mutate(userMovieId, {
                    onError: (error) =>
                      setActionError(error instanceof Error ? error.message : 'Failed to update watched status.'),
                  })
                }}
              >
                Not seen
              </button>
            </>
          ) : (
            <button type="button" onClick={() => setDialogMovie(movie)}>
              Mark watched
            </button>
          )
        }}
      />

      {dialogMovie && (
        <RatingDialog
          title={`Rate "${dialogMovie.title}"`}
          onClose={() => setDialogMovie(null)}
          onSubmit={async (rating, watchedDate) => {
            const existingId = watchedIds?.get(dialogMovie.id)
            if (existingId !== undefined) {
              await rewatch.mutateAsync({ userMovieId: existingId, rating, watchedDate })
            } else {
              await markWatched.mutateAsync({ movieId: dialogMovie.id, rating, watchedDate })
            }
          }}
        />
      )}
    </section>
  )
}

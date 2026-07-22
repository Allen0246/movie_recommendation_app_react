import { useState } from 'react'
import { exportToExcel } from '../lib/exportToExcel'
import { useMyMovies, useRewatch, useUnwatch, type WatchedMovie } from '../hooks/useMyMovies'
import { MovieTable } from '../components/MovieTable'
import { RatingDialog } from '../components/RatingDialog'

export function MyMoviesPage() {
  const { data: movies, isLoading } = useMyMovies()
  const rewatch = useRewatch()
  const unwatch = useUnwatch()
  const [dialogMovie, setDialogMovie] = useState<WatchedMovie | null>(null)

  function handleExport() {
    if (!movies) return
    exportToExcel(
      movies.map((m) => ({
        title: m.title,
        overview: m.overview,
        release_date: m.release_date,
        popularity: m.popularity,
      })),
      'my movies',
      'my_movies',
    )
  }

  if (isLoading) return <p>Loading your movies...</p>

  return (
    <section>
      <h1>My Movies</h1>
      <div className="toolbar">
        <button type="button" onClick={handleExport}>
          Export to Excel
        </button>
      </div>

      <MovieTable
        rows={movies?.map((m) => ({ ...m, watchedDate: m.watched_date })) ?? []}
        showWatchedColumns
        renderActions={(movie) => (
          <>
            <button type="button" onClick={() => setDialogMovie(movie)}>
              Rewatch
            </button>
            <button type="button" onClick={() => unwatch.mutate(movie.id)}>
              Not seen
            </button>
          </>
        )}
      />

      {dialogMovie && (
        <RatingDialog
          title={`Rate "${dialogMovie.title}"`}
          initialRating={dialogMovie.rating ?? undefined}
          initialDate={dialogMovie.watched_date}
          onClose={() => setDialogMovie(null)}
          onSubmit={async (rating, watchedDate) => {
            await rewatch.mutateAsync({ userMovieId: dialogMovie.id, rating, watchedDate })
          }}
        />
      )}
    </section>
  )
}

import { useState } from 'react'
import { useGenres } from '../hooks/useGenres'
import { useMovies, type MovieWithGenres } from '../hooks/useMovies'
import { useWatchedMovieIds } from '../hooks/useMyMovies'

export function RecommendationPage() {
  const { data: genres, isLoading: genresLoading } = useGenres()
  const { data: movies, isLoading: moviesLoading } = useMovies()
  const { data: watchedIds, isLoading: watchedLoading, isError: watchedError } = useWatchedMovieIds()

  const [selectedGenre, setSelectedGenre] = useState('')
  const [result, setResult] = useState<MovieWithGenres | 'none' | null>(null)

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const candidates = (movies ?? []).filter(
      (movie) => movie.genres.includes(selectedGenre) && !watchedIds?.has(movie.id),
    )
    if (candidates.length === 0) {
      setResult('none')
      return
    }
    setResult(candidates[Math.floor(Math.random() * candidates.length)])
  }

  if (genresLoading || moviesLoading || watchedLoading) return <p>Loading...</p>
  if (watchedError) return <p role="alert">Failed to load your watched movies. Please refresh and try again.</p>

  return (
    <section>
      <h1>Get a recommendation</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="genre_select">Genre</label>
        <select
          id="genre_select"
          value={selectedGenre}
          onChange={(e) => setSelectedGenre(e.target.value)}
          required
        >
          <option value="" disabled>
            Select a genre
          </option>
          {(genres ?? []).map((genre) => (
            <option key={genre.id} value={genre.name}>
              {genre.name}
            </option>
          ))}
        </select>
        <button type="submit">Recommend</button>
      </form>

      {result === 'none' && <p>No unwatched movies found in that genre.</p>}
      {result && result !== 'none' && (
        <article className="card">
          <h2>{result.title}</h2>
          <p>{result.overview}</p>
          <p>Release date: {result.release_date ?? '-'}</p>
          <p>Genres: {result.genres.join(', ') || '-'}</p>
        </article>
      )}
    </section>
  )
}

import { useEffect, useRef, useState } from 'react'

// Must match the DB's `current_date` (evaluated in UTC), not the browser's local
// calendar day: user_movies.watched_date has a `<= current_date` check constraint.
// For timezones ahead of UTC, local-date "today" can be a day ahead of UTC's for a
// few hours after each UTC midnight, so a local-date "today" here would pass this
// client check but still get rejected by the DB with a raw constraint-violation error.
const today = () => {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

interface RatingDialogProps {
  title: string
  initialRating?: number
  initialDate?: string
  onSubmit: (rating: number, watchedDate: string) => void | Promise<void>
  onClose: () => void
}

export function RatingDialog({ title, initialRating, initialDate, onSubmit, onClose }: RatingDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [rating, setRating] = useState(initialRating ?? 5)
  const [watchedDate, setWatchedDate] = useState(initialDate ?? today())
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (watchedDate > today()) {
      setError('The date cannot be in the future!')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(rating, watchedDate)
      // Only close() here — the native <dialog> "close" event below already
      // invokes onClose, so calling both would fire it twice per submit.
      dialogRef.current?.close()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <dialog ref={dialogRef} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <h2>{title}</h2>
        <div>
          <label htmlFor="rating">Rating</label>
          <select id="rating" value={rating} onChange={(e) => setRating(Number(e.target.value))}>
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="watchedDate">Date</label>
          <input
            id="watchedDate"
            type="date"
            max={today()}
            value={watchedDate}
            onChange={(e) => setWatchedDate(e.target.value)}
            required
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" disabled={submitting}>
          Save
        </button>
        <button type="button" onClick={() => dialogRef.current?.close()}>
          Cancel
        </button>
      </form>
    </dialog>
  )
}

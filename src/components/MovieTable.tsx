import type { ReactNode } from 'react'

export interface MovieTableRow {
  id: number
  title: string
  release_date: string | null
  genres: string[]
  rating?: number | null
  watchedDate?: string | null
}

interface MovieTableProps<T extends MovieTableRow> {
  rows: T[]
  showWatchedColumns?: boolean
  renderActions: (row: T) => ReactNode
}

export function MovieTable<T extends MovieTableRow>({ rows, showWatchedColumns, renderActions }: MovieTableProps<T>) {
  if (rows.length === 0) {
    return <p>No movies to show.</p>
  }

  return (
    <table>
      <thead>
        <tr>
          <th>Title</th>
          <th>Release date</th>
          <th>Genres</th>
          {showWatchedColumns && (
            <>
              <th>Rating</th>
              <th>Watched date</th>
            </>
          )}
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.title}</td>
            <td>{row.release_date ?? '-'}</td>
            <td>{row.genres.join(', ') || '-'}</td>
            {showWatchedColumns && (
              <>
                <td>{row.rating ?? '-'}</td>
                <td>{row.watchedDate ?? '-'}</td>
              </>
            )}
            <td>{renderActions(row)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

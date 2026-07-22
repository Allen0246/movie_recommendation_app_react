import { useMemo, useState } from 'react'
import { useAuditLog } from '../../hooks/useAuditLog'

const todayLocal = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function AdminAuditLogPage() {
  const [selectedDate, setSelectedDate] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const { data: entries, isLoading } = useAuditLog(selectedDate || undefined)

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return entries ?? []
    return (entries ?? []).filter((entry) => {
      const haystack = `${entry.action} ${entry.actor_id ?? 'system'} ${JSON.stringify(entry.details)}`.toLowerCase()
      return haystack.includes(term)
    })
  }, [entries, searchTerm])

  return (
    <section>
      <h1>Audit Log</h1>
      <div className="toolbar">
        <label htmlFor="auditDate">Date</label>
        <input
          id="auditDate"
          type="date"
          max={todayLocal()}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        {selectedDate && (
          <button type="button" onClick={() => setSelectedDate('')}>
            Clear (show recent)
          </button>
        )}
        <label htmlFor="auditSearch">Search</label>
        <input
          id="auditSearch"
          type="search"
          placeholder="Search action, actor, or details..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        {searchTerm && (
          <button type="button" onClick={() => setSearchTerm('')}>
            Clear search
          </button>
        )}
      </div>
      {isLoading ? (
        <p>Loading audit log...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {filteredEntries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.occurred_at).toLocaleString()}</td>
                <td>{entry.actor_id ?? 'system'}</td>
                <td>{entry.action}</td>
                <td>
                  <pre>{JSON.stringify(entry.details)}</pre>
                </td>
              </tr>
            ))}
            {filteredEntries.length === 0 && (
              <tr>
                <td colSpan={4}>
                  {searchTerm
                    ? `No audit entries match "${searchTerm}".`
                    : `No audit entries for ${selectedDate || 'this range'}.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  )
}

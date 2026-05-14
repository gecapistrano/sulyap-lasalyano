/**
 * PresidentArtifacts — mock list of artifacts tied to one president (browse → president tap).
 * Replace filtering with API `GET /presidents/:id/artifacts` (or similar) when backend exists.
 */
import { useMemo, useState } from 'react'
import { getMockArtifactsForPresident } from '../data/artifactBrowseMocks'
import { validateSearchQuery } from '../utils/security'
import './BrowseMode.css'
import './PresidentArtifacts.css'

function formatServiceYears(service) {
  if (!service) return ''
  const parts = service.split(' - ')
  if (parts.length === 2) {
    const start = parts[0].trim()
    const end = parts[1].trim()
    if (start === end) return start
    return `${start} - ${end}`
  }
  return service
}

export default function PresidentArtifacts({ president, onBack, onOpenArtifact, darkMode }) {
  const [query, setQuery] = useState('')

  const { sanitized: safeQuery } = validateSearchQuery(query)

  const filtered = useMemo(() => {
    const base = getMockArtifactsForPresident(president?.name ?? '')
    if (!safeQuery) return base
    const q = safeQuery.toLowerCase()
    return base.filter((a) =>
      [a.name, a.subtitle, a.year, a.owner].join(' ').toLowerCase().includes(q),
    )
  }, [president?.name, safeQuery])

  if (!president) return null

  return (
    <div className={`browse-root president-artifacts-root${darkMode ? ' browse-dark' : ''}`}>
      <header className="browse-header">
        <button type="button" className="browse-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <div style={{ flex: 1 }} />
        <div style={{ width: '1.25rem' }} />
      </header>

      <div className="pa-profile">
        <div className="pa-profile-photo" aria-hidden>
          <span>👤</span>
        </div>
        <h2 className="pa-profile-name">{president.name}</h2>
        <p className="pa-profile-years">{formatServiceYears(president.service)}</p>
      </div>

      <div className="browse-search-wrap">
        <svg className="browse-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="browse-search"
          placeholder="Search memorabilia from this president..."
          value={query}
          onChange={(event) => {
            const { sanitized, isValid } = validateSearchQuery(event.target.value)
            if (isValid) setQuery(sanitized)
          }}
        />
      </div>

      <p className="president-artifacts-count" role="status">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
      </p>

      <div className="browse-list">
        {filtered.length === 0 ? (
          <div className="president-artifacts-empty">
            No memorabilia registered from this president yet. Stay tuned — more treasures are on the way.
          </div>
        ) : (
          filtered.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="browse-card-button"
              onClick={() => onOpenArtifact?.(entry)}
            >
              <div className="browse-card-thumb" aria-hidden>
                <span>{entry.icon}</span>
              </div>

              <div className="browse-card-body">
                <div className="browse-card-name">{entry.name}</div>
                <div className="browse-card-meta-wrap">
                  <div className="browse-card-year">{entry.year}</div>
                  <div className="browse-card-owner">{entry.subtitle}</div>
                </div>
              </div>

              <div className="browse-card-chevron" aria-hidden>
                ›
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

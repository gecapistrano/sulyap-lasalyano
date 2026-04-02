/**
 * PresidentArtifacts — mock list of artifacts tied to one president (browse → president tap).
 * Replace filtering with API `GET /presidents/:id/artifacts` (or similar) when backend exists.
 */
import { useMemo, useState } from 'react'
import { getMockArtifactsForPresident } from '../data/artifactBrowseMocks'
import { validateSearchQuery } from '../utils/security'
import './BrowseMode.css'
import './PresidentArtifacts.css'

export default function PresidentArtifacts({ president, onBack, onOpenArtifact }) {
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
    <div className="browse-root president-artifacts-root">
      <header className="browse-header">
        <button type="button" className="browse-back" onClick={onBack}>
          ← Back
        </button>

        <div className="president-artifacts-title-wrap">
          <h1 className="browse-title president-artifacts-title">{president.name}</h1>
          <p className="president-artifacts-eyebrow">Memorabilia · {president.service}</p>
        </div>

        <span className="president-artifacts-spacer" aria-hidden />
      </header>

      <div className="browse-search-wrap">
        <input
          type="text"
          className="browse-search"
          placeholder="Search this president’s artifacts…"
          value={query}
          onChange={(event) => {
            const { sanitized, isValid } = validateSearchQuery(event.target.value)
            if (isValid) setQuery(sanitized)
          }}
        />
      </div>

      <p className="president-artifacts-count" role="status">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'} (mock)
      </p>

      <div className="browse-list">
        {filtered.length === 0 ? (
          <div className="president-artifacts-empty">
            No artifacts match your search. Try clearing the search field.
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

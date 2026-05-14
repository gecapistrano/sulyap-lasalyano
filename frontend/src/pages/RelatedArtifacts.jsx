/**
 * RelatedArtifacts — list of memorabilia sharing a selected tag (same card style as Browse).
 */
import { useMemo, useState } from 'react'
import { getArtifactsForRelatedTag } from '../lib/relatedTags'
import { validateSearchQuery } from '../utils/security'
import './BrowseMode.css'
import './RelatedArtifacts.css'

export default function RelatedArtifacts({ tag, onBack, onOpenArtifact, darkMode }) {
  const [query, setQuery] = useState('')

  const { sanitized: safeQuery } = validateSearchQuery(query)

  const baseList = useMemo(() => getArtifactsForRelatedTag(tag ?? ''), [tag])

  const filtered = useMemo(() => {
    if (!safeQuery) return baseList
    const q = safeQuery.toLowerCase()
    return baseList.filter((a) =>
      [a.name, a.subtitle, a.year, a.owner, a.rdCode].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [baseList, safeQuery])

  const title = typeof tag === 'string' && tag.trim() ? tag.trim() : 'Related'

  return (
    <div className={`browse-root related-artifacts-root${darkMode ? ' browse-dark' : ''}`}>
      <header className="browse-header">
        <button type="button" className="browse-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h1 className="browse-title ra-title" title={title}>
          {title}
        </h1>

        <div style={{ width: '1.25rem' }} />
      </header>

      <div className="browse-search-wrap">
        <svg className="browse-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          type="text"
          className="browse-search"
          placeholder="Search in this tag…"
          value={query}
          onChange={(event) => {
            const { sanitized, isValid } = validateSearchQuery(event.target.value)
            if (isValid) setQuery(sanitized)
          }}
        />
      </div>

      <p className="ra-count" role="status">
        {filtered.length} {filtered.length === 1 ? 'item' : 'items'}
      </p>

      <div className="browse-list">
        {filtered.length === 0 ? (
          <div className="ra-empty">No artifacts match this tag or your search yet.</div>
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
                  <div className="browse-card-year">{entry.rdCode ? `${entry.rdCode} · ` : ''}{entry.year}</div>
                  <div className="browse-card-owner">{entry.owner}</div>
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

/**
 * BrowseMode.jsx — "DLSU Presidents" browsing page.
 * Shows the list of DLSU-D presidents; tapping a card opens their memorabilia.
 */
import { useMemo, useState } from 'react'
import { validateSearchQuery } from '../utils/security'
import './BrowseMode.css'

const PRESIDENTS = [
  { id: 1, name: 'Br. Rafael S. Donato, FSC', service: '1987 - 1994', icon: '👤' },
  { id: 2, name: 'Br. Gus Boquer, FSC', service: '1994 - 1999', icon: '👤' },
  { id: 3, name: 'Br. Andrew B. Gonzalez, FSC', service: '1999 - 2001', icon: '👤' },
  { id: 4, name: 'Br. Rolando V. Dizon, FSC', service: '2001 - 2004', icon: '👤' },
  { id: 5, name: 'Br. Narciso S. Erguiza, FSC', service: '2004 - 2008', icon: '👤' },
  { id: 6, name: 'Br. Armin A. Luistro, FSC', service: '2008 - 2010', icon: '👤' },
  { id: 7, name: 'Dr. Carmelita R. Quebengco', service: '2010 - 2016', icon: '👤' },
  { id: 8, name: 'Br. Geminiano M. Buenaventura, FSC', service: '2016 - 2019', icon: '👤' },
  { id: 9, name: 'Br. Francisco "Sockie" dela Rosa VI, FSC', service: '2019 - 2024', icon: '👤' },
  { id: 10, name: 'Br. Iñigo Riola, FSC', service: '2024 - present', icon: '👤' },
]

export default function BrowseMode({ onBack, onOpenPresident, darkMode }) {
  const [query, setQuery] = useState('')

  const { sanitized: safeQuery } = validateSearchQuery(query)

  const filtered = useMemo(() => {
    if (!safeQuery) return PRESIDENTS
    const q = safeQuery.toLowerCase()
    return PRESIDENTS.filter((p) =>
      [p.name, p.service].join(' ').toLowerCase().includes(q),
    )
  }, [safeQuery])

  return (
    <div className={`browse-root${darkMode ? ' browse-dark' : ''}`}>
      <header className="browse-header">
        <button type="button" className="browse-back" onClick={onBack} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h1 className="browse-title">DLSU Presidents</h1>

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
          placeholder="Search presidents..."
          value={query}
          onChange={(event) => {
            const { sanitized, isValid } = validateSearchQuery(event.target.value)
            if (isValid) setQuery(sanitized)
          }}
        />
      </div>

      <div className="browse-list">
        {filtered.map((president) => (
          <button
            key={president.id}
            type="button"
            className="browse-card-button"
            onClick={() => onOpenPresident?.(president)}
          >
            <div className="browse-card-thumb" aria-hidden>
              <span>{president.icon}</span>
            </div>

            <div className="browse-card-body">
              <div className="browse-card-name">{president.name}</div>
              <div className="browse-card-meta">{president.service}</div>
            </div>

            <div className="browse-card-chevron" aria-hidden>
              ›
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

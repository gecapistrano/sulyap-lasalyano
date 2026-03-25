/**
 * BrowseMode.jsx — searchable list of presidents or artifacts; optional merge with API when the user is authenticated.
 * Mock rows keep the UI usable offline or before login; successful `listArtifacts` replaces artifact rows.
 */
import { useEffect, useMemo, useState } from 'react'
import { listArtifacts } from '../lib/archiveApi'
import { sanitizeText, validateSearchQuery } from '../utils/security'
import './BrowseMode.css'

/** Demo artifact rows when API is unreachable or returns nothing useful. */
const mockArtifacts = [
  {
    id: 1,
    name: 'Founding Plaque',
    subtitle: 'From the first expansion era',
    year: '1975',
    owner: 'Br. Andrew B. Gonzalez, FSC',
    icon: '🏺',
  },
  {
    id: 2,
    name: 'Excellence Trophy',
    subtitle: 'Institutional achievement marker',
    year: '1988',
    owner: 'Br. Rolando V. Dizon, FSC',
    icon: '🏆',
  },
  {
    id: 3,
    name: 'Presidential Portrait',
    subtitle: 'Official museum collection',
    year: '1995',
    owner: 'Br. Narciso S. Erguiza, FSC',
    icon: '🖼️',
  },
  {
    id: 4,
    name: 'Accreditation Medallion',
    subtitle: 'Quality standards milestone',
    year: '2003',
    owner: 'Dr. Carmelita R. Quebengco',
    icon: '🎖️',
  },
  {
    id: 5,
    name: 'Charter Document',
    subtitle: 'Historic governance record',
    year: '2010',
    owner: 'Br. Armin A. Luistro, FSC',
    icon: '📜',
  },
]

const mockPresidents = [
  { id: 1, name: 'Br. Andrew B. Gonzalez, FSC', service: '1975 - 1987', icon: '👤' },
  { id: 2, name: 'Br. Rolando V. Dizon, FSC', service: '1988 - 1998', icon: '👤' },
  { id: 3, name: 'Br. Narciso S. Erguiza, FSC', service: '1998 - 2004', icon: '👤' },
  { id: 4, name: 'Dr. Carmelita R. Quebengco', service: '2004 - 2008', icon: '👤' },
  { id: 5, name: 'Br. Armin A. Luistro, FSC', service: '2008 - 2010', icon: '👤' },
]

export default function BrowseMode({ onBack }) {
  const [query, setQuery] = useState('')
  const [view, setView] = useState('presidents')
  const [artifacts, setArtifacts] = useState(mockArtifacts)

  // Try to hydrate artifacts from the backend; on failure (401, network) we keep `mockArtifacts`.
  useEffect(() => {
    let isMounted = true
    listArtifacts()
      .then((items) => {
        if (!isMounted || !Array.isArray(items)) return
        setArtifacts(
          items.map((item, idx) => {
            const fallbackOwner =
              mockPresidents[idx % mockPresidents.length]?.name ?? 'DLSU President'
            const rawOwner = item.owner_name
            const ownerName =
              typeof rawOwner === 'string' ? (rawOwner.trim() ? rawOwner : fallbackOwner) : fallbackOwner
            return {
              id: Number(item.id) || idx + 1,
              name: sanitizeText(item.title ?? 'Untitled Artifact'),
              subtitle: sanitizeText(item.category ?? 'Artifact entry'),
              year: String(item.created_at ?? '').slice(0, 4) || 'N/A',
              owner: sanitizeText(ownerName),
              icon: '🏺',
            }
          }),
        )
      })
      .catch(() => {
        // Keep local mock data when the authenticated API is unavailable.
      })

    return () => {
      isMounted = false
    }
  }, [])

  const { sanitized: safeQuery } = validateSearchQuery(query)

  /** Client-side filter over president name + service years. */
  const filteredPresidents = useMemo(() => {
    if (!safeQuery) return mockPresidents
    const normalizedQuery = safeQuery.toLowerCase()
    return mockPresidents.filter((president) =>
      [president.name, president.service].join(' ').toLowerCase().includes(normalizedQuery),
    )
  }, [safeQuery])

  /** Includes owner line so search matches president names shown on artifact cards. */
  const filteredArtifacts = useMemo(() => {
    if (!safeQuery) return artifacts
    const normalizedQuery = safeQuery.toLowerCase()
    return artifacts.filter((artifact) =>
      [artifact.name, artifact.subtitle, artifact.year, artifact.owner].join(' ').toLowerCase().includes(
        normalizedQuery,
      ),
    )
  }, [artifacts, safeQuery])

  const isPresidentView = view === 'presidents'
  const list = isPresidentView ? filteredPresidents : filteredArtifacts

  return (
    <div className="browse-root">
      <header className="browse-header">
        <button type="button" className="browse-back" onClick={onBack}>
          ← Back
        </button>

        <h1 className="browse-title">{isPresidentView ? 'All DLSU Presidents' : 'All Artifacts'}</h1>

        <button
          type="button"
          className="browse-switch"
          onClick={() => {
            setView((prev) => (prev === 'presidents' ? 'artifacts' : 'presidents'))
            setQuery('')
          }}
        >
          {isPresidentView ? 'All Artifacts' : 'All Presidents'}
        </button>
      </header>

      <div className="browse-search-wrap">
        <input
          type="text"
          className="browse-search"
          placeholder={isPresidentView ? 'Search presidents...' : 'Search artifacts...'}
          value={query}
          onChange={(event) => {
            const { sanitized, isValid } = validateSearchQuery(event.target.value)
            if (isValid) setQuery(sanitized)
          }}
        />
      </div>

      <div className="browse-list">
        {list.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className="browse-card-button"
            onClick={() => {
              // Placeholder action while detail page/data wiring is pending.
            }}
          >
            <div className="browse-card-thumb" aria-hidden>
              <span>{entry.icon}</span>
            </div>

            <div className="browse-card-body">
              <div className="browse-card-name">{entry.name}</div>

              {isPresidentView ? (
                <div className="browse-card-meta">{entry.service}</div>
              ) : (
                <div className="browse-card-meta-wrap">
                  <div className="browse-card-year">{entry.year}</div>
                  <div className="browse-card-owner">{entry.owner}</div>
                </div>
              )}
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

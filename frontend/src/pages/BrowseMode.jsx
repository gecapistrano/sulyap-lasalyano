/**
 * BrowseMode.jsx — searchable list of presidents or artifacts; optional merge with API when the user is authenticated.
 * Mock rows keep the UI usable offline or before login; successful `listArtifacts` replaces artifact rows.
 */
import { useEffect, useMemo, useState } from 'react'
import { MOCK_ARTIFACTS_BROWSE, PLACEHOLDER_ARTIFACT_DESCRIPTION } from '../data/artifactBrowseMocks'
import { listArtifacts } from '../lib/archiveApi'
import { sanitizeText, validateSearchQuery } from '../utils/security'
import './BrowseMode.css'

const mockPresidents = [
  { id: 1, name: 'Br. Andrew B. Gonzalez, FSC', service: '1975 - 1987', icon: '👤' },
  { id: 2, name: 'Br. Rolando V. Dizon, FSC', service: '1988 - 1998', icon: '👤' },
  { id: 3, name: 'Br. Narciso S. Erguiza, FSC', service: '1998 - 2004', icon: '👤' },
  { id: 4, name: 'Dr. Carmelita R. Quebengco', service: '2004 - 2008', icon: '👤' },
  { id: 5, name: 'Br. Armin A. Luistro, FSC', service: '2008 - 2010', icon: '👤' },
]

export default function BrowseMode({
  onBack,
  onOpenArtifact,
  onOpenPresident,
  listView: listViewProp,
  onListViewChange,
}) {
  const [query, setQuery] = useState('')
  const [artifacts, setArtifacts] = useState(MOCK_ARTIFACTS_BROWSE)
  const [internalView, setInternalView] = useState('presidents')

  const controlled = typeof onListViewChange === 'function'
  const view =
    controlled && (listViewProp === 'artifacts' || listViewProp === 'presidents')
      ? listViewProp
      : internalView
  const setView = controlled ? onListViewChange : setInternalView

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
              description: sanitizeText(
                typeof item.description === 'string' && item.description.trim()
                  ? item.description
                  : PLACEHOLDER_ARTIFACT_DESCRIPTION,
              ),
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
            setView(view === 'presidents' ? 'artifacts' : 'presidents')
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
              if (isPresidentView && typeof onOpenPresident === 'function') {
                onOpenPresident(entry)
              } else if (!isPresidentView && typeof onOpenArtifact === 'function') {
                onOpenArtifact(entry)
              }
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

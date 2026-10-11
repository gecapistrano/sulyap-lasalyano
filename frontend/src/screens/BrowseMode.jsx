/**
 * BrowseMode.jsx — "DLSU Presidents" browsing page.
 * Shows the list of DLSU-D presidents; tapping a card opens their memorabilia.
 */
import { useEffect, useMemo, useState } from 'react'
import { MOCK_PRESIDENTS } from '../data/presidentBrowseMocks'
import { isBackendConfigured, listCatalogPresidents } from '../lib/archiveApi'
import { t } from '../i18n'
import { validateSearchQuery } from '../utils/security'
import './BrowseMode.css'

export default function BrowseMode({ language = 'English', onBack, onOpenPresident, darkMode }) {
  const [query, setQuery] = useState('')
  const [presidents, setPresidents] = useState(MOCK_PRESIDENTS)

  useEffect(() => {
    if (!isBackendConfigured()) return undefined
    let cancelled = false
    listCatalogPresidents()
      .then((rows) => {
        if (cancelled || !Array.isArray(rows) || rows.length === 0) return
        setPresidents(rows)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const { sanitized: safeQuery } = validateSearchQuery(query)

  const filtered = useMemo(() => {
    if (!safeQuery) return presidents
    const q = safeQuery.toLowerCase()
    return presidents.filter((p) =>
      [p.name, p.service].join(' ').toLowerCase().includes(q),
    )
  }, [presidents, safeQuery])

  return (
    <div className={`browse-root${darkMode ? ' browse-dark' : ''}`}>
      <header className="browse-header">
        <button type="button" className="browse-back" onClick={onBack} aria-label={t(language, 'nav.back')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h1 className="browse-title">{t(language, 'browse.presidentsTitle')}</h1>

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
          placeholder={t(language, 'browse.searchPresidents')}
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
              {president.photo_url ? (
                <img src={president.photo_url} alt="" />
              ) : (
                <span>{president.icon || '👤'}</span>
              )}
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

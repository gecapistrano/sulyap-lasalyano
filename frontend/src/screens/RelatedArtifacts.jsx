/**
 * RelatedArtifacts — list of memorabilia sharing a selected tag (same card style as Browse).
 */
import { useEffect, useMemo, useState } from 'react'
import { isBackendConfigured, listRelatedArtifacts } from '../lib/archiveApi'
import { t } from '../i18n'
import { validateSearchQuery } from '../utils/security'
import './BrowseMode.css'
import './RelatedArtifacts.css'

export default function RelatedArtifacts({ language = 'English', tag, onBack, onOpenArtifact, darkMode }) {
  const [query, setQuery] = useState('')
  const [apiList, setApiList] = useState(null)
  const [loading, setLoading] = useState(() => Boolean(String(tag || '').trim() && isBackendConfigured()))

  const { sanitized: safeQuery } = validateSearchQuery(query)

  useEffect(() => {
    let cancelled = false
    const needle = typeof tag === 'string' ? tag.trim() : ''
    if (!needle || !isBackendConfigured()) {
      setApiList(null)
      return undefined
    }
    setLoading(true)
    listRelatedArtifacts({ tag: needle })
      .then((rows) => {
        if (!cancelled) setApiList(rows)
      })
      .catch(() => {
        if (!cancelled) setApiList(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [tag])

  const baseList = useMemo(() => (Array.isArray(apiList) ? apiList : []), [apiList])

  const filtered = useMemo(() => {
    if (!safeQuery) return baseList
    const q = safeQuery.toLowerCase()
    return baseList.filter((a) =>
      [a.name, a.subtitle, a.year, a.owner, a.rdCode, a.idCode]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    )
  }, [baseList, safeQuery])

  const title = typeof tag === 'string' && tag.trim() ? tag.trim() : t(language, 'browse.related')

  return (
    <div className={`browse-root related-artifacts-root${darkMode ? ' browse-dark' : ''}`}>
      <header className="browse-header">
        <button type="button" className="browse-back" onClick={onBack} aria-label={t(language, 'nav.back')}>
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
          placeholder={t(language, 'browse.searchTag')}
          value={query}
          onChange={(event) => {
            const { sanitized, isValid } = validateSearchQuery(event.target.value)
            if (isValid) setQuery(sanitized)
          }}
        />
      </div>

      <p className="ra-count" role="status">
        {loading
          ? '…'
          : t(language, filtered.length === 1 ? 'browse.item' : 'browse.items', { count: filtered.length })}
      </p>

      <div className="browse-list">
        {loading ? (
          <div className="ra-empty">{t(language, 'browse.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="ra-empty">{t(language, 'browse.emptyTag')}</div>
        ) : (
          filtered.map((entry) => (
            <button
              key={entry.id ?? entry.idCode ?? entry.rdCode}
              type="button"
              className="browse-card-button"
              onClick={() => onOpenArtifact?.(entry)}
            >
              <div className="browse-card-thumb" aria-hidden>
                <span>{entry.icon || '🏺'}</span>
              </div>

              <div className="browse-card-body">
                <div className="browse-card-name">{entry.name}</div>
                <div className="browse-card-meta-wrap">
                  <div className="browse-card-year">
                    {entry.rdCode || entry.idCode
                      ? `${entry.rdCode || entry.idCode} · `
                      : ''}
                    {entry.year}
                  </div>
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

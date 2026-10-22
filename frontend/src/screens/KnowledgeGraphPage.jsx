/**
 * Knowledge Graph — 3D constellation fed by the public catalog
 * (same GET /catalog/presidents + /catalog/artifacts Browse and Scan use).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../i18n'
import { env } from '../config/env'
import { isBackendConfigured, listCatalogArtifacts, listCatalogPresidents } from '../lib/archiveApi'
import { buildCatalogGraph, summarizeGraph } from '../features/knowledge-graph/buildCatalogForceGraph'
import CatalogForceGraph3D from '../features/knowledge-graph/CatalogForceGraph3D'
import './KnowledgeGraphPage.css'

export default function KnowledgeGraphPage({ language = 'English', onBack, darkMode }) {
  const hostWrapRef = useRef(null)
  const [status, setStatus] = useState('loading')
  const [presidents, setPresidents] = useState([])
  const [artifacts, setArtifacts] = useState([])
  const [selected, setSelected] = useState(null)
  const [layout, setLayout] = useState('web')

  useEffect(() => {
    if (!isBackendConfigured()) {
      setStatus('unconfigured')
      setPresidents([])
      setArtifacts([])
      return undefined
    }
    let cancelled = false
    setStatus('loading')
    Promise.all([listCatalogPresidents(), listCatalogArtifacts({ limit: 2000 })])
      .then(([presidentRows, artifactRows]) => {
        if (cancelled) return
        setPresidents(Array.isArray(presidentRows) ? presidentRows : [])
        setArtifacts(Array.isArray(artifactRows) ? artifactRows : [])
        setStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setPresidents([])
        setArtifacts([])
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const graph = useMemo(
    () => buildCatalogGraph(presidents, artifacts, { apiBase: env.apiBaseUrl }),
    [presidents, artifacts],
  )
  const summary = useMemo(() => summarizeGraph(graph), [graph])
  const presidentCount = summary.counts.president || 0
  const artifactCount = summary.counts.artifact || 0

  const onSelect = useCallback((node) => {
    setSelected(node)
  }, [])

  const callHost = useCallback((fn) => {
    const host = hostWrapRef.current?.querySelector('.kg-graph-host')
    host?.[fn]?.()
  }, [])

  const setLayoutMode = useCallback((mode) => {
    setLayout(mode)
    const host = hostWrapRef.current?.querySelector('.kg-graph-host')
    host?.__kgLayout?.(mode)
  }, [])

  let statusText = t(language, 'kg.hint')
  if (status === 'loading') statusText = t(language, 'kg.loading')
  else if (status === 'error') statusText = t(language, 'kg.error')
  else if (status === 'unconfigured') statusText = t(language, 'kg.unconfigured')
  else if (presidentCount === 0 && artifactCount === 0) statusText = t(language, 'kg.empty')
  else {
    statusText = t(language, 'kg.counts', {
      presidents: presidentCount,
      artifacts: artifactCount,
    })
  }

  return (
    <div className={`kg-root kg-3d${darkMode ? ' kg-dark' : ''}`}>
      <header className="kg-header">
        <button type="button" className="kg-back" onClick={onBack} aria-label={t(language, 'nav.back')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="kg-header-title">{t(language, 'kg.title')}</h1>
        <div className="kg-header-spacer" aria-hidden />
      </header>

      <p
        className="kg-sub"
        data-kg-status={status}
        data-president-count={presidentCount}
        data-artifact-count={artifactCount}
        data-node-count={summary.nodeCount}
      >
        {statusText}
      </p>

      <div className="kg-viewport-wrap" ref={hostWrapRef}>
        {status === 'ready' && graph.nodes.length ? (
          <CatalogForceGraph3D graph={graph} onSelect={onSelect} selectedId={selected?.id} />
        ) : null}

        {status === 'loading' ? (
          <div className="kg-banner" role="status">
            {t(language, 'kg.loading')}
          </div>
        ) : null}

        {selected ? (
          <aside className="kg-detail">
            <p className="kg-detail-kicker">
              {selected.type === 'president'
                ? t(language, 'kg.nodePresident')
                : selected.type === 'artifact'
                  ? t(language, 'kg.nodeArtifact')
                  : t(language, 'kg.nodeCluster')}
            </p>
            <h2 className="kg-detail-title">{selected.label || selected.name}</h2>
            {selected.type === 'president' ? (
              <p className="kg-detail-meta">{[selected.termStart, selected.termEnd].filter(Boolean).join(' – ')}</p>
            ) : null}
            {selected.type === 'artifact' ? (
              <p className="kg-detail-meta">
                {[selected.rdCode, selected.year].filter(Boolean).join(' · ')}
              </p>
            ) : null}
          </aside>
        ) : null}

        <details className="kg-legend">
          <summary>{t(language, 'kg.legend')}</summary>
          <ul className="kg-legend-list">
            <li><span className="kg-swatch kg-swatch--pres" aria-hidden />{t(language, 'kg.legendPresident')}</li>
            <li><span className="kg-swatch kg-swatch--art" aria-hidden />{t(language, 'kg.legendArtifact')}</li>
            <li><span className="kg-swatch kg-swatch--cat" aria-hidden />{t(language, 'kg.legendCategory')}</li>
            <li><span className="kg-swatch kg-swatch--era" aria-hidden />{t(language, 'kg.legendEra')}</li>
          </ul>
        </details>

        <div className="kg-tools">
          <div className="kg-layout" role="group" aria-label={t(language, 'kg.layoutWeb')}>
            <button
              type="button"
              className="kg-zoom-btn"
              aria-pressed={layout === 'web'}
              onClick={() => setLayoutMode('web')}
            >
              {t(language, 'kg.layoutWeb')}
            </button>
            <button
              type="button"
              className="kg-zoom-btn"
              aria-pressed={layout === 'timeline'}
              onClick={() => setLayoutMode('timeline')}
            >
              {t(language, 'kg.layoutTimeline')}
            </button>
          </div>
          <div className="kg-zoom-tools" aria-label="Zoom controls">
            <button type="button" className="kg-zoom-btn" onClick={() => callHost('__kgZoomIn')} aria-label={t(language, 'kg.zoomIn')}>
              +
            </button>
            <button type="button" className="kg-zoom-btn" onClick={() => callHost('__kgZoomOut')} aria-label={t(language, 'kg.zoomOut')}>
              −
            </button>
            <button type="button" className="kg-zoom-btn kg-zoom-btn--fit" onClick={() => callHost('__kgFit')}>
              {t(language, 'kg.fit')}
            </button>
          </div>
        </div>
      </div>

      <footer className="kg-footer">
        <span className="kg-footer-lang">{language}</span>
        <span className="kg-footer-note">{t(language, 'kg.live')}</span>
      </footer>
    </div>
  )
}

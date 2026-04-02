/**
 * ArtifactDetail — landscape-first “museum cabinet” layout for an artifact opened from Browse.
 * Data is mock- or API-shaped; wire fields when the backend is integrated.
 *
 * `onViewKnowledgeGraph` opens the in-app gesture-controlled 3D explorer (same UI as `/gesture-demo`);
 * graph data and models will follow when the database is wired.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import ModelViewer from '../components/ar/ModelViewer'
import './ArtifactDetail.css'

export default function ArtifactDetail({ artifact, onBack, onViewKnowledgeGraph }) {
  const copyScrollRef = useRef(null)
  const [copyFadeTop, setCopyFadeTop] = useState(false)
  const [copyFadeBottom, setCopyFadeBottom] = useState(false)

  const updateCopyScrollFades = useCallback(() => {
    const el = copyScrollRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const canScroll = scrollHeight > clientHeight + 2
    if (!canScroll) {
      setCopyFadeTop(false)
      setCopyFadeBottom(false)
      return
    }
    const atTop = scrollTop <= 6
    const atBottom = scrollTop + clientHeight >= scrollHeight - 6
    setCopyFadeTop(!atTop)
    setCopyFadeBottom(!atBottom)
  }, [])

  useEffect(() => {
    const el = copyScrollRef.current
    if (!el) return
    updateCopyScrollFades()
    el.addEventListener('scroll', updateCopyScrollFades, { passive: true })
    const ro = new ResizeObserver(updateCopyScrollFades)
    ro.observe(el)
    window.addEventListener('resize', updateCopyScrollFades)
    return () => {
      el.removeEventListener('scroll', updateCopyScrollFades)
      ro.disconnect()
      window.removeEventListener('resize', updateCopyScrollFades)
    }
  }, [updateCopyScrollFades, artifact])

  if (!artifact) return null

  const title = artifact.name ?? 'Artifact'
  const owner = artifact.owner ?? '—'
  const year = artifact.year ?? '—'
  const description =
    typeof artifact.description === 'string' && artifact.description.trim()
      ? artifact.description
      : 'Description will appear here when this record is loaded from the database.'

  return (
    <div className="artifact-detail-root">
      <div className="artifact-detail-vignette" aria-hidden />

      <header className="artifact-detail-header">
        <button type="button" className="artifact-detail-back" onClick={onBack}>
          ← Back
        </button>

        {/* Vision board: same control family as “View Collection” (btn-secondary) — see REFERENCES/VISION BOARD - THEME - REFERENCE.html */}
        <button
          type="button"
          className="btn btn-secondary artifact-detail-graph-btn"
          onClick={() => onViewKnowledgeGraph?.(artifact)}
          aria-label="Open gesture-controlled 3D view (knowledge graph preview)"
        >
          View Knowledge Graph
        </button>
      </header>

      <div className="artifact-detail-main">
        <section className="artifact-detail-cabinet-column" aria-label="3D artifact preview">
          <div className="cabinet-wrap">
            <div className="cabinet-glass">
              <div className="artifact-detail-model-slot">
                <ModelViewer showArtifactLabel={false} showTapHint={false} />
              </div>
            </div>
          </div>
          <p className="artifact-detail-cabinet-caption">Rotate or zoom to view</p>
        </section>

        <section className="artifact-detail-copy" aria-label="Artifact information">
          <div className="artifact-detail-copy-scroll" ref={copyScrollRef}>
            <h1 className="artifact-detail-title">{title}</h1>

            <p className="artifact-detail-label">DLSU President</p>
            <p className="artifact-detail-owner">{owner}</p>

            <p className="artifact-detail-label">Year acquired</p>
            <p className="artifact-detail-year">{year}</p>

            <div className="artifact-detail-divider" aria-hidden />

            <h2 className="artifact-detail-desc-heading">Description</h2>
            <p className="artifact-detail-description">{description}</p>
          </div>
          <div
            className={`artifact-detail-copy-fade artifact-detail-copy-fade--top${copyFadeTop ? ' is-visible' : ''}`}
            aria-hidden
          />
          <div
            className={`artifact-detail-copy-fade artifact-detail-copy-fade--bottom${copyFadeBottom ? ' is-visible' : ''}`}
            aria-hidden
          />
        </section>
      </div>
    </div>
  )
}

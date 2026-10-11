/**
 * ArtifactDetail — detail view for a single artifact opened from the president's memorabilia list.
 * Styled to match the Browse page warm palette.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ModelViewer from '../components/ar/ModelViewer'
import { t } from '../i18n'
import { useTranslatedText } from '../i18n/useTranslatedText'
import { getRelatedTagsForArtifact } from '../lib/relatedTags'
import './ArtifactDetail.css'

/** Center header: catalog RD code (e.g. RD204) from artifact fields or embedded in title. */
function getArtifactRdHeaderLabel(artifact) {
  if (!artifact) return 'Artifact'
  const raw =
    artifact.rdCode ??
    artifact.rd_code ??
    artifact.catalog_code ??
    artifact.class_label ??
    artifact.detection_label
  if (typeof raw === 'string' && raw.trim()) {
    const t = raw.trim()
    return /^RD\d+/i.test(t) ? t.replace(/^rd/i, 'RD') : t
  }
  const name = String(artifact.name ?? '')
  const m = name.match(/\bRD\d{2,}\b/i)
  if (m) return m[0].toUpperCase()
  return 'Artifact'
}

export default function ArtifactDetail({ language = 'English', artifact, onBack, onViewKnowledgeGraph, onRelatedTag, darkMode }) {
  const copyScrollRef = useRef(null)
  const [copyFadeTop, setCopyFadeTop] = useState(false)
  const [copyFadeBottom, setCopyFadeBottom] = useState(false)
  const [descExpanded, setDescExpanded] = useState(false)

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
    setCopyFadeTop(scrollTop > 6)
    setCopyFadeBottom(scrollTop + clientHeight < scrollHeight - 6)
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

  const relatedTags = useMemo(() => getRelatedTagsForArtifact(artifact), [artifact])
  const sourceDescription =
    typeof artifact?.description === 'string' && artifact.description.trim()
      ? artifact.description
      : t(language, 'detail.fallbackDesc')
  const { text: translatedDescription, loading: translating } = useTranslatedText(sourceDescription, language)

  if (!artifact) return null

  const title = artifact.name ?? t(language, 'detail.artifact')
  const owner = artifact.owner ?? '\u2014'
  const year = artifact.year ?? '\u2014'
  const headerRdLabel = getArtifactRdHeaderLabel(artifact)
  const description = translating ? t(language, 'detail.translating') : translatedDescription
  const descLong = typeof description === 'string' && description.length > 280
  const visibleDescription =
    !descLong || descExpanded ? description : `${description.slice(0, 280).trim()}…`

  return (
    <div className={`ad-root${darkMode ? ' ad-dark' : ''}`}>
      <header className="ad-header">
        <button type="button" className="ad-back" onClick={onBack} aria-label={t(language, 'nav.back')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>

        <h1 className="ad-header-title">{headerRdLabel}</h1>

        {typeof onViewKnowledgeGraph === 'function' ? (
          <button
            type="button"
            className="ad-kg"
            onClick={onViewKnowledgeGraph}
            aria-label={t(language, 'nav.openKnowledgeGraph')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
              <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
              <ellipse cx="12" cy="12" rx="8" ry="3.25" />
              <ellipse cx="12" cy="12" rx="8" ry="3.25" transform="rotate(60 12 12)" />
              <ellipse cx="12" cy="12" rx="8" ry="3.25" transform="rotate(-60 12 12)" />
            </svg>
          </button>
        ) : (
          <div className="ad-header-trailing-spacer" aria-hidden />
        )}
      </header>

      <div className="ad-main">
        <section className="ad-model-section" aria-label="3D artifact preview">
          <div className="ad-model-frame">
            <div className="ad-model-slot">
              <ModelViewer
                showArtifactLabel={false}
                showTapHint={false}
                language={language}
                modelUrl={typeof artifact?.modelUrl === 'string' ? artifact.modelUrl : ''}
              />
            </div>
          </div>
          <p className="ad-model-caption">{t(language, 'detail.rotate')}</p>
        </section>

        <section className="ad-info" aria-label="Artifact information">
          <div className="ad-info-scroll" ref={copyScrollRef}>
            <div className="ad-info-head">
              <div className="ad-info-head-text">
                <h2 className="ad-title">{title}</h2>

                <p className="ad-label">{t(language, 'detail.president')}</p>
                <p className="ad-owner">{owner}</p>

                <p className="ad-label">{t(language, 'detail.year')}</p>
                <p className="ad-year">{year}</p>
              </div>

              <div className="ad-president-photo" role="img" aria-label="President portrait (placeholder)">
                <span aria-hidden>👤</span>
              </div>
            </div>

            <div className="ad-divider" aria-hidden />

            <h3 className="ad-desc-heading">{t(language, 'detail.description')}</h3>
            <p className="ad-description">{visibleDescription}</p>
            {descLong ? (
              <button type="button" className="ad-related-tag" onClick={() => setDescExpanded((v) => !v)}>
                {descExpanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}

            {relatedTags.length > 0 && (
              <section className="ad-related" aria-labelledby="ad-related-heading">
                <h3 id="ad-related-heading" className="ad-related-heading">
                  {t(language, 'detail.related')}
                </h3>
                <div className="ad-related-tags">
                  {relatedTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="ad-related-tag"
                      onClick={() => onRelatedTag?.(tag)}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>
          <div className={`ad-fade ad-fade--top${copyFadeTop ? ' is-visible' : ''}`} aria-hidden />
          <div className={`ad-fade ad-fade--bottom${copyFadeBottom ? ' is-visible' : ''}`} aria-hidden />
        </section>
      </div>
    </div>
  )
}

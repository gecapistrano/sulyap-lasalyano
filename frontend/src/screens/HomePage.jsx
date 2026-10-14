'use client'

import { useEffect, useRef, useState } from 'react'
import './HomePage.css'
import { LANGUAGE_OPTIONS, t } from '../i18n'

const heroBg = '/images/aea_images/homepage-cover.png'

function LangDropdown({ language, onLanguageChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [])

  return (
    <div className="hp-lang" ref={ref}>
      <button
        type="button"
        className="aca-header-link hp-lang-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t(language, 'nav.selectLanguage')}
        aria-expanded={open}
      >
        {language}
        <svg viewBox="0 0 12 8" className={`hp-lang-arrow${open ? ' is-open' : ''}`} aria-hidden>
          <path
            d="M1 1.5l5 5 5-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div className={`hp-lang-menu${open ? ' is-open' : ''}`}>
        {LANGUAGE_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`hp-lang-option${item.id === language ? ' is-active' : ''}`}
            onClick={() => {
              onLanguageChange?.(item.id)
              setOpen(false)
            }}
          >
            {item.id}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function HomePage({
  language,
  onLanguageChange,
  onStartCamera,
  onBrowse,
  onOpenKnowledgeGraph,
  onOpenCurator,
}) {
  const rootRef = useRef(null)
  const [headerScrolled, setHeaderScrolled] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const onScroll = () => setHeaderScrolled(root.scrollTop > 40)
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="hp-root" ref={rootRef}>
      <header className={`hp-header${headerScrolled ? ' is-scrolled' : ''}`}>
        <span className="aca-header-brand hp-brand">{t(language, 'home.brand')}</span>
        <nav className="aca-header-nav hp-nav" aria-label="Primary">
          <button type="button" className="aca-header-link" onClick={onBrowse}>
            {t(language, 'home.browse')}
          </button>
          <button type="button" className="aca-header-link" onClick={onOpenKnowledgeGraph}>
            {t(language, 'home.knowledgeGraphShort')}
          </button>
          <button type="button" className="aca-header-link" onClick={onStartCamera}>
            {t(language, 'home.liveScan')}
          </button>
        </nav>
        <LangDropdown language={language} onLanguageChange={onLanguageChange} />
      </header>

      <section className="hp-hero" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="hp-hero-veil" aria-hidden="true" />
        <div className="hp-hero-inner">
          <p className="aca-volume">{t(language, 'home.welcome')}</p>
          <h1 className="hp-title">{t(language, 'home.brand')}</h1>
          <p className="hp-tagline">{t(language, 'home.tagline')}</p>
          <div className="hp-cta">
            <button type="button" className="aca-btn-primary" onClick={onStartCamera}>
              {t(language, 'home.liveScan')}
            </button>
            <button type="button" className="aca-btn-secondary" onClick={onBrowse}>
              {t(language, 'home.browse')}
            </button>
            <button type="button" className="aca-btn-ghost" onClick={onOpenKnowledgeGraph}>
              {t(language, 'home.knowledgeGraph')}
            </button>
          </div>
        </div>
      </section>

      <section className="hp-intro">
        <p className="aca-dropcap hp-intro-copy">{t(language, 'home.intro')}</p>
        <div className="aca-ornate-divider" aria-hidden="true" />
      </section>

      <section className="hp-volumes">
        <article className="aca-card aca-flourish hp-volume">
          <p className="aca-volume">{t(language, 'home.volume1')}</p>
          <h2 className="hp-volume-title">{t(language, 'home.feature.browse.title')}</h2>
          <p className="hp-volume-body">{t(language, 'home.feature.browse.body')}</p>
          <button type="button" className="aca-btn-ghost" onClick={onBrowse}>
            {t(language, 'home.browse')}
          </button>
        </article>

        <div className="aca-ornate-divider" aria-hidden="true" />

        <article className="aca-card aca-flourish hp-volume">
          <p className="aca-volume">{t(language, 'home.volume2')}</p>
          <h2 className="hp-volume-title">{t(language, 'home.feature.kg.title')}</h2>
          <p className="hp-volume-body">{t(language, 'home.feature.kg.body')}</p>
          <button type="button" className="aca-btn-ghost" onClick={onOpenKnowledgeGraph}>
            {t(language, 'home.knowledgeGraph')}
          </button>
        </article>

        <div className="aca-ornate-divider" aria-hidden="true" />

        <article className="aca-card aca-flourish hp-volume">
          <p className="aca-volume">{t(language, 'home.volume3')}</p>
          <h2 className="hp-volume-title">{t(language, 'home.feature.scan.title')}</h2>
          <p className="hp-volume-body">{t(language, 'home.feature.scan.body')}</p>
          <button type="button" className="aca-btn-ghost" onClick={onStartCamera}>
            {t(language, 'home.liveScan')}
          </button>
        </article>
      </section>

      <footer className="aca-footer hp-footer">
        <p>{t(language, 'home.footer')}</p>
        {typeof onOpenCurator === 'function' ? (
          <p>
            <button type="button" onClick={onOpenCurator}>
              {t(language, 'home.curator')}
            </button>
          </p>
        ) : null}
      </footer>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import './HomePage.css'
import heroBg from '../../images/aea_images/homepage-cover.png'
import nameLogo from '../../images/logo/NAME_Dark-Mode.png'
import { LANGUAGE_OPTIONS, t } from '../i18n'

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
    <div className="hp-hero-lang" ref={ref}>
      <button
        type="button"
        className="hp-lang-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t(language, 'nav.selectLanguage')}
        aria-expanded={open}
      >
        {language}
        <svg viewBox="0 0 12 8" className={`hp-lang-arrow ${open ? 'hp-lang-arrow--open' : ''}`}>
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`hp-lang-menu ${open ? 'hp-lang-menu--open' : ''}`}>
        {LANGUAGE_OPTIONS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`hp-lang-option ${item.id === language ? 'hp-lang-option--active' : ''}`}
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
  darkMode,
  onToggleDarkMode,
}) {
  const rootRef = useRef(null)
  const headerRef = useRef(null)
  const featuresRef = useRef(null)
  const [headerScrolled, setHeaderScrolled] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onScroll = () => setHeaderScrolled(root.scrollTop > 30)
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('hp-visible')
          }
        })
      },
      { root: rootRef.current, threshold: 0.15 },
    )

    const elements = featuresRef.current?.querySelectorAll('.hp-fade-in')
    elements?.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [])

  return (
    <div className={`hp-root ${darkMode ? 'hp-dark' : ''}`} ref={rootRef}>
      {/* ── Sticky Header (always at the very top) ── */}
      <header className={`hp-header ${headerScrolled ? 'hp-header-scrolled' : ''}`} ref={headerRef}>
        <LangDropdown language={language} onLanguageChange={onLanguageChange} />

        <div className="hp-header-actions">
          <button
            type="button"
            className="hp-mode-toggle"
            onClick={onToggleDarkMode}
            aria-label={darkMode ? t(language, 'home.lightMode') : t(language, 'home.darkMode')}
          >
            {darkMode ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="hp-mode-icon">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="hp-mode-icon">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>
      </header>

      {/* Parallax background — stays fixed within the scroll container */}
      <div className="hp-parallax-bg" style={{ backgroundImage: `url(${heroBg})` }} aria-hidden="true" />

      {/* ── Hero Section ── */}
      <section className="hp-hero">
        <div className="hp-hero-overlay" />

        <div className="hp-hero-content">
          <span className="hp-welcome-label">{t(language, 'home.welcome')}</span>
          <img src={nameLogo} alt="Sulyap Lasalyano" className="hp-name-logo" />
        </div>

        <div className="hp-hero-actions">
          <button type="button" className="hp-pill-btn" onClick={onBrowse}>
            {t(language, 'home.browse')}
          </button>
          <button type="button" className="hp-pill-btn" onClick={onOpenKnowledgeGraph}>
            {t(language, 'home.knowledgeGraph')}
          </button>
          <button type="button" className="hp-pill-btn" onClick={onStartCamera}>
            {t(language, 'home.liveScan')}
          </button>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="hp-features" ref={featuresRef}>
        <div className="hp-features-grid">
          <div className="hp-feature-card hp-fade-in">
            <h3 className="hp-feature-title">{t(language, 'home.feature.browse.title')}</h3>
            <p className="hp-feature-desc">{t(language, 'home.feature.browse.body')}</p>
          </div>

          <div className="hp-center-line">
            <div className="hp-line" />
            <div className="hp-dot" />
            <div className="hp-line" />
          </div>

          <div className="hp-feature-card hp-fade-in">
            <h3 className="hp-feature-title">{t(language, 'home.feature.kg.title')}</h3>
            <p className="hp-feature-desc">{t(language, 'home.feature.kg.body')}</p>
          </div>

          <div className="hp-center-line">
            <div className="hp-line" />
            <div className="hp-dot" />
            <div className="hp-line" />
          </div>

          <div className="hp-feature-card hp-fade-in">
            <h3 className="hp-feature-title">{t(language, 'home.feature.scan.title')}</h3>
            <p className="hp-feature-desc">{t(language, 'home.feature.scan.body')}</p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <p>{t(language, 'home.footer')}</p>
        {typeof onOpenCurator === 'function' ? (
          <p className="hp-footer-curator">
            <button type="button" className="hp-footer-curator-btn" onClick={onOpenCurator}>
              {t(language, 'home.curator')}
            </button>
          </p>
        ) : null}
      </footer>
    </div>
  )
}

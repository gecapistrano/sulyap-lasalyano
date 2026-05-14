import { useEffect, useRef, useState } from 'react'
import './HomePage.css'
import heroBg from '../../images/aea_images/homepage-cover.png'
import nameLogo from '../../images/logo/NAME_Dark-Mode.png'

const LANGUAGES = [
  'English',
  'Filipino',
  'Spanish',
  'French',
  'Chinese',
  'Korean',
  'Japanese',
]

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
        aria-label="Select language"
        aria-expanded={open}
      >
        {language}
        <svg viewBox="0 0 12 8" className={`hp-lang-arrow ${open ? 'hp-lang-arrow--open' : ''}`}>
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={`hp-lang-menu ${open ? 'hp-lang-menu--open' : ''}`}>
        {LANGUAGES.map((item) => (
          <button
            key={item}
            type="button"
            className={`hp-lang-option ${item === language ? 'hp-lang-option--active' : ''}`}
            onClick={() => {
              onLanguageChange?.(item)
              setOpen(false)
            }}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function HomePage({ language, onLanguageChange, onStartCamera, onBrowse, onOpenKnowledgeGraph, darkMode, onToggleDarkMode }) {
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

        <button
          type="button"
          className="hp-mode-toggle"
          onClick={onToggleDarkMode}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
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
      </header>

      {/* Parallax background — stays fixed within the scroll container */}
      <div className="hp-parallax-bg" style={{ backgroundImage: `url(${heroBg})` }} aria-hidden="true" />

      {/* ── Hero Section ── */}
      <section className="hp-hero">
        <div className="hp-hero-overlay" />

        <div className="hp-hero-content">
          <span className="hp-welcome-label">Welcome to</span>
          <img src={nameLogo} alt="Sulyap Lasalyano" className="hp-name-logo" />
        </div>

        <div className="hp-hero-actions">
          <button type="button" className="hp-pill-btn" onClick={onBrowse}>
            Browse
          </button>
          <button type="button" className="hp-pill-btn" onClick={onOpenKnowledgeGraph}>
            View Knowledge Graph
          </button>
          <button type="button" className="hp-pill-btn" onClick={onStartCamera}>
            Live Scan
          </button>
        </div>
      </section>

      {/* ── Features Section ── */}
      <section className="hp-features" ref={featuresRef}>
        <div className="hp-features-grid">
          <div className="hp-feature-card hp-fade-in">
            <h3 className="hp-feature-title">Browse</h3>
            <p className="hp-feature-desc">
              Take your time and explore at your own pace.
              Browse the full collection of presidential memorabilia
              from wherever you are. Whether you're on-site or miles away,
              the legacy of De La Salle is always within reach.
            </p>
          </div>

          <div className="hp-center-line">
            <div className="hp-line" />
            <div className="hp-dot" />
            <div className="hp-line" />
          </div>

          <div className="hp-feature-card hp-fade-in">
            <h3 className="hp-feature-title">Knowledge Graph</h3>
            <p className="hp-feature-desc">
              Trace the threads of our shared heritage.
              Explore an interactive map that connects presidents, artifacts,
              and milestones across generations of Lasallian history.
              See how each piece of memorabilia weaves into the rich
              tapestry of DLSU's story, and perhaps, your own.
            </p>
          </div>

          <div className="hp-center-line">
            <div className="hp-line" />
            <div className="hp-dot" />
            <div className="hp-line" />
          </div>

          <div className="hp-feature-card hp-fade-in">
            <h3 className="hp-feature-title">Live Scan</h3>
            <p className="hp-feature-desc">
              Step into history with your camera.
              Simply point your device at any memorabilia in the gallery,
              and watch as its story comes alive. Learn who it belonged to,
              why it matters, and how it shaped the legacy of De La Salle.
              Every artifact has a story waiting to be told.
            </p>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="hp-footer">
        <p>
          &copy; 2026 Sulyap Lasalyano &mdash; De La Salle University-Dasmari&ntilde;as. All rights reserved.
          Developed by J.N. Lagajino, J.U. Ricafrente &amp; G.E. Capistrano
        </p>
      </footer>
    </div>
  )
}

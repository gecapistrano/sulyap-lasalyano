'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import './HomePage.css'
import { LANGUAGE_OPTIONS, languageToCode, t } from '../i18n'

const heroBg = '/images/aea_images/homepage-cover.png'
const logoDark = '/logo/LOGO_Dark-Mode.png'
const logoLight = '/logo/LOGO_Light-Mode.png'

/** Staff easter egg: long-press logo (~3s) → Curator desk (no nav link). */
const CURATOR_HOLD_MS = 3000
const CURATOR_HINT_MS = 1500
const CURATOR_MOVE_PX = 16

function langShort(language) {
  const code = languageToCode(language)
  if (code.startsWith('zh')) return 'ZH'
  return code.slice(0, 2).toUpperCase()
}

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
        {langShort(language)}
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

function ThemeToggle({ language, darkMode, onToggleDarkMode }) {
  return (
    <button
      type="button"
      className="hp-theme-btn"
      onClick={onToggleDarkMode}
      aria-pressed={darkMode}
      aria-label={darkMode ? t(language, 'home.lightMode') : t(language, 'home.darkMode')}
    >
      {darkMode ? (
        <svg className="hp-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 14.5A8.5 8.5 0 0 1 9.5 3 7 7 0 1 0 21 14.5z" />
        </svg>
      ) : (
        <svg className="hp-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
    </button>
  )
}

export default function HomePage({
  language,
  onLanguageChange,
  darkMode = true,
  onToggleDarkMode,
  onStartCamera,
  onBrowse,
  onOpenKnowledgeGraph,
  onOpenCurator,
}) {
  const rootRef = useRef(null)
  const logoRef = useRef(null)
  const holdRef = useRef({
    timer: null,
    hintTimer: null,
    startX: 0,
    startY: 0,
    startT: 0,
    armed: false,
    opened: false,
    activeId: null,
  })
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [logoHint, setLogoHint] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return undefined
    const onScroll = () => setHeaderScrolled(root.scrollTop > 40)
    root.addEventListener('scroll', onScroll, { passive: true })
    return () => root.removeEventListener('scroll', onScroll)
  }, [])

  const clearHoldTimers = useCallback(() => {
    const state = holdRef.current
    if (state.timer) {
      clearTimeout(state.timer)
      state.timer = null
    }
    if (state.hintTimer) {
      clearTimeout(state.hintTimer)
      state.hintTimer = null
    }
  }, [])

  const disarmHold = useCallback(() => {
    clearHoldTimers()
    const state = holdRef.current
    state.armed = false
    state.activeId = null
    setLogoHint(false)
  }, [clearHoldTimers])

  const openCuratorEgg = useCallback(() => {
    const state = holdRef.current
    if (state.opened || typeof onOpenCurator !== 'function') return
    state.opened = true
    disarmHold()
    try {
      if (navigator.vibrate) navigator.vibrate(12)
    } catch {
      /* ignore */
    }
    onOpenCurator()
  }, [disarmHold, onOpenCurator])

  useEffect(() => {
    const el = logoRef.current
    if (!el || typeof onOpenCurator !== 'function') return undefined

    const heldLongEnough = () => {
      const state = holdRef.current
      return state.startT > 0 && Date.now() - state.startT >= CURATOR_HOLD_MS - 30
    }

    const onPointerDown = (e) => {
      if (e.isPrimary === false) return
      if (typeof e.button === 'number' && e.button !== 0) return
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        try {
          e.preventDefault()
        } catch {
          /* ignore */
        }
      }
      const state = holdRef.current
      state.opened = false
      state.armed = true
      state.activeId = e.pointerId
      state.startX = e.clientX
      state.startY = e.clientY
      state.startT = Date.now()
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
      clearHoldTimers()
      setLogoHint(false)
      state.hintTimer = setTimeout(() => {
        if (!holdRef.current.armed || holdRef.current.opened) return
        setLogoHint(true)
      }, CURATOR_HINT_MS)
      state.timer = setTimeout(openCuratorEgg, CURATOR_HOLD_MS)
    }

    const onPointerMove = (e) => {
      const state = holdRef.current
      if (!state.armed || (state.activeId != null && e.pointerId !== state.activeId)) return
      const dx = e.clientX - state.startX
      const dy = e.clientY - state.startY
      if (dx * dx + dy * dy > CURATOR_MOVE_PX * CURATOR_MOVE_PX) disarmHold()
    }

    const onPointerUp = (e) => {
      const state = holdRef.current
      if (state.activeId != null && e.pointerId !== state.activeId) return
      if (state.armed && heldLongEnough()) {
        openCuratorEgg()
        return
      }
      disarmHold()
    }

    const onPointerCancel = (e) => {
      const state = holdRef.current
      if (state.activeId != null && e.pointerId !== state.activeId) return
      if (state.armed && heldLongEnough()) {
        openCuratorEgg()
        return
      }
      disarmHold()
    }

    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    el.addEventListener('contextmenu', onContextMenu)
    return () => {
      disarmHold()
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
      el.removeEventListener('contextmenu', onContextMenu)
    }
  }, [clearHoldTimers, disarmHold, onOpenCurator, openCuratorEgg])

  return (
    <div className="hp-root" ref={rootRef}>
      <header className={`hp-header${headerScrolled ? ' is-scrolled' : ''}`}>
        <img
          ref={logoRef}
          className={`hp-logo${logoHint ? ' is-egg-hint' : ''}`}
          src={darkMode ? logoDark : logoLight}
          alt={t(language, 'home.brand')}
          draggable={false}
        />
        <div className="hp-header-actions">
          {typeof onToggleDarkMode === 'function' ? (
            <ThemeToggle language={language} darkMode={darkMode} onToggleDarkMode={onToggleDarkMode} />
          ) : null}
          <LangDropdown language={language} onLanguageChange={onLanguageChange} />
        </div>
      </header>

      <section className="hp-hero" style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="hp-hero-veil" aria-hidden="true" />
        <div className="hp-hero-inner">
          <p className="aca-volume">{t(language, 'home.welcome')}</p>
          <h1 className="hp-title">{t(language, 'home.brand')}</h1>
          <p className="hp-tagline">{t(language, 'home.tagline')}</p>
          <div className="hp-cta">
            {/* Hierarchy: Live Scan (core) → Knowledge Graph (unique) → Browse (habit / quieter) */}
            <button type="button" className="aca-btn-primary" onClick={onStartCamera}>
              {t(language, 'home.liveScan')}
            </button>
            <button type="button" className="aca-btn-secondary" onClick={onOpenKnowledgeGraph}>
              {t(language, 'home.knowledgeGraph')}
            </button>
            <button type="button" className="aca-btn-ghost" onClick={onBrowse}>
              {t(language, 'home.browse')}
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
          <h2 className="hp-volume-title">{t(language, 'home.placeholderTitle')}</h2>
          <p className="hp-volume-body">{t(language, 'home.placeholderBody')}</p>
          <button type="button" className="aca-btn-ghost" onClick={onBrowse}>
            {t(language, 'home.browse')}
          </button>
        </article>

        <div className="aca-ornate-divider" aria-hidden="true" />

        <article className="aca-card aca-flourish hp-volume">
          <p className="aca-volume">{t(language, 'home.volume2')}</p>
          <h2 className="hp-volume-title">{t(language, 'home.placeholderTitle')}</h2>
          <p className="hp-volume-body">{t(language, 'home.placeholderBody')}</p>
          <button type="button" className="aca-btn-ghost" onClick={onOpenKnowledgeGraph}>
            {t(language, 'home.knowledgeGraph')}
          </button>
        </article>

        <div className="aca-ornate-divider" aria-hidden="true" />

        <article className="aca-card aca-flourish hp-volume">
          <p className="aca-volume">{t(language, 'home.volume3')}</p>
          <h2 className="hp-volume-title">{t(language, 'home.placeholderTitle')}</h2>
          <p className="hp-volume-body">{t(language, 'home.placeholderBody')}</p>
          <button type="button" className="aca-btn-ghost" onClick={onStartCamera}>
            {t(language, 'home.liveScan')}
          </button>
        </article>
      </section>

      <footer className="aca-footer hp-footer">
        <p>{t(language, 'home.footer')}</p>
      </footer>
    </div>
  )
}

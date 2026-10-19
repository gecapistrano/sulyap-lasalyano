/**
 * Onboarding.jsx — two-step first-run instructions (camera + tap) with pager dots.
 * Pair with `Onboarding.css` for lens/finger illustrations and glass treatments.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import './Onboarding.css'
import { t } from '../i18n'

/** Served from `public/` — Next static imports return objects, not URL strings. */
const nameLogoDark = '/images/logo/NAME_Dark-Mode.png'
const nameLogoLight = '/images/logo/NAME_Light-Mode.png'

/** Realistic front-facing lens (pure CSS stacking, no images). */
function LensIcon() {
  return (
    <div className="onb-lens" aria-hidden="true">
      <div className="onb-lens__shadow" />
      <div className="onb-lens__outer">
        <div className="onb-lens__silver">
          <div className="onb-lens__inner-housing">
            <div className="onb-lens__outer-lens">
              <div className="onb-lens__outer-ribbing">
                <div className="onb-lens__ribbing">
                  <div className="onb-lens__aperture-housing">
                    <div className="onb-lens__small-outer">
                      <div className="onb-lens__small-inner">
                        <div className="onb-lens__tiny-outer">
                          <div className="onb-lens__tiny-inner" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="onb-lens__shine" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Backhand index pointing up — same glyph as HTML &#128070; (U+1F446) */
function FingerIcon() {
  return (
    <div className="onb-finger" aria-hidden="true">
      <span className="onb-finger__emoji">{'\u{1F446}'}</span>
    </div>
  )
}

/** `onFinish` advances App state to the camera screen (see `App.jsx`). */
export default function Onboarding({ language = 'English', onFinish, onBack, darkMode }) {
  const [page, setPage] = useState(0)
  const pages = useMemo(
    () => [
      {
        id: 'camera',
        title: t(language, 'onb.pointTitle'),
        body: t(language, 'onb.pointBody'),
        Icon: LensIcon,
      },
      {
        id: 'tap',
        title: t(language, 'onb.tapTitle'),
        body: t(language, 'onb.tapBody'),
        Icon: FingerIcon,
      },
    ],
    [language],
  )
  const slide = pages[page]
  const Icon = slide.Icon

  const handleNext = () => {
    if (page < pages.length - 1) {
      window.history.pushState({ onbPage: page + 1 }, '', null)
      setPage((p) => p + 1)
    } else {
      onFinish()
    }
  }

  const handleBack = useCallback(() => {
    if (page > 0) {
      setPage((p) => p - 1)
    } else {
      onBack?.()
    }
  }, [page, onBack])

  useEffect(() => {
    const onPopState = (e) => {
      if (e.state?.onbPage !== undefined) {
        setPage(e.state.onbPage)
      } else {
        handleBack()
      }
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [handleBack])

  return (
    <div className={`onboarding-root ${darkMode ? 'onb-dark' : ''}`}>
      <button type="button" className="onb-back-btn" onClick={handleBack} aria-label={t(language, 'nav.goBack')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <header className="onb-header">
        <img src={darkMode ? nameLogoDark : nameLogoLight} alt={t(language, 'home.brand')} className="onb-name-logo" />
      </header>

      <main className="onb-main" key={slide.id} aria-live="polite">
        <div className="onb-glass-icon">
          <Icon />
        </div>
        <h1 className="onb-title">{slide.title}</h1>
        <div className="onb-body">
          <span className="onb-body-line">{slide.body}</span>
        </div>
      </main>

      <footer className="onb-footer">
        <div
          className="onb-dots"
          role="img"
          aria-label={t(language, 'onb.step', { current: page + 1, total: pages.length })}
        >
          <span className={`onb-dot ${page === 0 ? 'onb-dot--active' : ''}`} aria-hidden />
          <span className={`onb-dot ${page === 1 ? 'onb-dot--active' : ''}`} aria-hidden />
        </div>

        <button type="button" className="onb-btn-next" onClick={handleNext}>
          {t(language, 'onb.next')}
        </button>

        <button type="button" className="onb-btn-skip" onClick={onFinish}>
          {t(language, 'onb.skip')}
        </button>
      </footer>
    </div>
  )
}

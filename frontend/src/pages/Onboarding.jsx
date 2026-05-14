/**
 * Onboarding.jsx — two-step first-run instructions (camera + tap) with pager dots.
 * Pair with `Onboarding.css` for lens/finger illustrations and glass treatments.
 */
import { useCallback, useEffect, useState } from 'react'
import './Onboarding.css'
import nameLogoDark from '../../images/logo/NAME_Dark-Mode.png'
import nameLogoLight from '../../images/logo/NAME_Light-Mode.png'

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

/** Slides: id is used as React `key` for enter transitions; Icon is the hero graphic. */
const PAGES = [
  {
    id: 'camera',
    title: 'Point your camera',
    body: (
      <>
        <span className="onb-body-line">Aim your camera at any artifact in the gallery. Sulyap Lasalyano will recognize it automatically.</span>
      </>
    ),
    Icon: LensIcon,
  },
  {
    id: 'tap',
    title: 'Tap to learn more',
    body: (
      <span className="onb-body-line">
        When an artifact is detected, tap it on the screen to view full details.
      </span>
    ),
    Icon: FingerIcon,
  },
]

/** `onFinish` advances App state to the camera screen (see `App.jsx`). */
export default function Onboarding({ onFinish, onBack, darkMode }) {
  const [page, setPage] = useState(0)
  const slide = PAGES[page]
  const Icon = slide.Icon

  const handleNext = () => {
    if (page < PAGES.length - 1) {
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
      <button type="button" className="onb-back-btn" onClick={handleBack} aria-label="Go back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <header className="onb-header">
        <img src={darkMode ? nameLogoDark : nameLogoLight} alt="Sulyap Lasalyano" className="onb-name-logo" />
      </header>

      <main className="onb-main" key={slide.id} aria-live="polite">
        <div className="onb-glass-icon">
          <Icon />
        </div>
        <h1 className="onb-title">{slide.title}</h1>
        <div className="onb-body">{slide.body}</div>
      </main>

      <footer className="onb-footer">
        <div className="onb-dots" role="img" aria-label={`Step ${page + 1} of ${PAGES.length}`}>
          <span className={`onb-dot ${page === 0 ? 'onb-dot--active' : ''}`} aria-hidden />
          <span className={`onb-dot ${page === 1 ? 'onb-dot--active' : ''}`} aria-hidden />
        </div>

        <button type="button" className="onb-btn-next" onClick={handleNext}>
          Next
        </button>

        <button type="button" className="onb-btn-skip" onClick={onFinish}>
          Skip
        </button>
      </footer>
    </div>
  )
}

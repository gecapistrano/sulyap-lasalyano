/**
 * Onboarding.jsx — two-step first-run instructions (camera + tap) with pager dots.
 * Pair with `Onboarding.css` for lens/finger illustrations and glass treatments.
 */
import { useState } from 'react'
import './Onboarding.css'

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
        <span className="onb-body-line">Aim your camera at any artifact in the gallery.</span>
        <span className="onb-body-line">ARchive will recognize it automatically.</span>
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
export default function Onboarding({ onFinish }) {
  const [page, setPage] = useState(0)
  const slide = PAGES[page]
  const Icon = slide.Icon

  const handleNext = () => {
    if (page < PAGES.length - 1) setPage((p) => p + 1)
    else onFinish()
  }

  return (
    <div className="onboarding-root">
      <header className="onb-header">
        <div className="onb-wordmark">
          <span className="onb-ar">AR</span>
          <span className="onb-chive">chive</span>
        </div>
        <p className="onb-subtext">DLSU Presidents Memoribilia</p>
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

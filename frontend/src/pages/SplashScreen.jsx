/**
 * SplashScreen.jsx — first paint: logo, wordmark, loading bar, timed transition.
 * Lives in `src/pages/` with co-located `SplashScreen.css` (vision-board styling).
 */
import { useEffect } from 'react'
import './SplashScreen.css'

/**
 * Full-screen splash. After animations (~2.35s), calls onComplete so the app continues to onboarding.
 * Respects `prefers-reduced-motion` with a shorter delay.
 */
export default function SplashScreen({ onComplete }) {
  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ms = reduced ? 400 : 2350
    const id = window.setTimeout(() => {
      onComplete()
    }, ms)
    return () => window.clearTimeout(id)
  }, [onComplete])

  return (
    <div className="archive-splash-mount" role="presentation" aria-hidden="true">
      <div className="splash-layer">
        <div className="splash-container">
          <div className="icon-wrapper glass">
            <img className="archive-logo" src="/LOGO.svg" alt="" />
            <img className="logo-shine-pass" src="/LOGO.svg" alt="" aria-hidden="true" />
          </div>

          <div className="wordmark">
            <span className="ar">AR</span>
            <span className="chive">chive</span>
          </div>

          <div className="subtext">DLSU Presidents Memoribilia</div>

          <div className="loading-bar">
            <div className="loading-progress" />
          </div>
        </div>
      </div>
    </div>
  )
}

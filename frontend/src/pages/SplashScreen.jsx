/**
 * SplashScreen.jsx — first paint: logo, wordmark, loading bar, timed transition.
 * Lives in `src/pages/` with co-located `SplashScreen.css` (vision-board styling).
 */
import { useEffect, useState } from 'react'
import './SplashScreen.css'
import splashPoster from '../../images/logo/LOGO_Dark-Mode.png'
import { getRdScannerReadyPromise, preloadRdScanner } from '../lib/rdClassifier'

/** Served from `public/splash/` so the URL is stable in dev, preview, and production. */
const SPLASH_ICON_GIF_SRC = '/splash/icon-splash-screen3.gif'

/**
 * Full-screen splash. After animations (~2.35s), calls onComplete so the app continues to onboarding.
 * Respects `prefers-reduced-motion` with a shorter delay.
 */
export default function SplashScreen({ onComplete }) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    const apply = () => setReducedMotion(Boolean(mq?.matches))
    apply()
    mq?.addEventListener('change', apply)
    return () => mq?.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let cancelled = false
    const reducedQuick =
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    const MIN_SPLASH_MS = reducedQuick ? 700 : 2200
    const EXIT_BUFFER_MS = reducedQuick ? 120 : 650
    const MAX_WAIT_MS = 15000

    void preloadRdScanner()

    const minDelay = new Promise((resolve) => window.setTimeout(resolve, MIN_SPLASH_MS))
    const maxDelay = new Promise((resolve) => window.setTimeout(resolve, MAX_WAIT_MS))
    const ready = getRdScannerReadyPromise().catch(() => null)

    Promise.race([Promise.all([ready, minDelay]), maxDelay]).then(() => {
      if (cancelled) return
      const finishId = window.setTimeout(() => {
        if (!cancelled) onComplete()
      }, EXIT_BUFFER_MS)
      if (cancelled) window.clearTimeout(finishId)
    })

    return () => {
      cancelled = true
    }
  }, [onComplete])

  return (
    <div className="sulyap-splash-mount" role="presentation" aria-hidden="true">
      <div className="splash-layer">
        <div className="splash-container">
          <div className="icon-wrapper glass">
            {reducedMotion ? (
              <img className="sulyap-splash-logo" src={splashPoster} alt="" />
            ) : (
              <img className="sulyap-splash-logo" src={SPLASH_ICON_GIF_SRC} alt="" />
            )}
          </div>

          <div className="loading-bar">
            <div className="loading-progress" />
          </div>
        </div>
      </div>
    </div>
  )
}

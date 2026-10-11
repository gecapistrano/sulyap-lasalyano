/**
 * SplashScreen.jsx — original splash animation via hardware-decoded video (same frames as GIF).
 * Falls back to the source GIF only if video fails. Scanner preload stays deferred in App.jsx.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import './SplashScreen.css'

const SPLASH_WEBM = '/splash/icon-splash-screen3.webm'
const SPLASH_MP4 = '/splash/icon-splash-screen3.mp4'
const SPLASH_GIF = '/splash/icon-splash-screen3.gif'
const SPLASH_POSTER = '/splash/splash-logo.png'

function readReducedMotion() {
  if (typeof window === 'undefined') return false
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
}

export default function SplashScreen({ onComplete }) {
  const [reducedMotion] = useState(readReducedMotion)
  const [useGifFallback, setUseGifFallback] = useState(false)
  const videoRef = useRef(null)
  const finishTimerRef = useRef(null)

  const scheduleFinish = useCallback(
    (waitMs) => {
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current)
      const reducedQuick = reducedMotion
      const exitBuffer = reducedQuick ? 120 : 450
      finishTimerRef.current = window.setTimeout(() => {
        onComplete()
      }, waitMs + exitBuffer)
    },
    [onComplete, reducedMotion],
  )

  useEffect(() => {
    let cancelled = false
    const reducedQuick = reducedMotion
    const minSplashMs = reducedQuick ? 700 : 2400

    if (reducedQuick || useGifFallback) {
      const gifWait = useGifFallback ? Math.max(minSplashMs, 5000) : minSplashMs
      scheduleFinish(gifWait)
      return () => {
        cancelled = true
        if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current)
      }
    }

    const video = videoRef.current
    if (!video) {
      scheduleFinish(minSplashMs)
      return () => {
        cancelled = true
        if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current)
      }
    }

    const resolveWaitMs = () => {
      const durationMs =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : 5000
      return Math.max(minSplashMs, Math.ceil(durationMs))
    }

    const startPlayback = async () => {
      try {
        video.muted = true
        video.playsInline = true
        await video.play()
        if (cancelled) return
        scheduleFinish(resolveWaitMs())
      } catch {
        if (!cancelled) {
          setUseGifFallback(true)
          scheduleFinish(minSplashMs)
        }
      }
    }

    if (video.readyState >= 2) {
      void startPlayback()
    } else {
      video.addEventListener('loadeddata', () => void startPlayback(), { once: true })
    }

    return () => {
      cancelled = true
      if (finishTimerRef.current) window.clearTimeout(finishTimerRef.current)
    }
  }, [reducedMotion, scheduleFinish, useGifFallback])

  const showVideo = !reducedMotion && !useGifFallback

  return (
    <div className="sulyap-splash-mount" role="presentation" aria-hidden="true">
      <div className="splash-layer">
        <div className="splash-container">
          <div className="icon-wrapper icon-wrapper--animated">
            {reducedMotion ? (
              <img className="sulyap-splash-logo" src={SPLASH_POSTER} alt="" width={228} height={228} decoding="async" />
            ) : showVideo ? (
              <video
                ref={videoRef}
                className="sulyap-splash-logo sulyap-splash-logo--video"
                width={228}
                height={228}
                autoPlay
                loop
                muted
                playsInline
                preload="auto"
                poster={SPLASH_POSTER}
                onError={() => setUseGifFallback(true)}
              >
                <source src={SPLASH_WEBM} type="video/webm" />
                <source src={SPLASH_MP4} type="video/mp4" />
              </video>
            ) : (
              <img
                className="sulyap-splash-logo"
                src={SPLASH_GIF}
                alt=""
                width={228}
                height={228}
                decoding="async"
                fetchPriority="high"
              />
            )}
          </div>

          <div className="loading-bar" aria-hidden>
            <div className="loading-progress" />
          </div>
        </div>
      </div>
    </div>
  )
}

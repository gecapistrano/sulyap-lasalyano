/**
 * ARCamera.jsx — full-screen camera UI: `getUserMedia` preview, permission prompts, link to browse mode.
 * AR / detection wiring is not in this file yet; video is for live preview only.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import './ARCamera.css'

export default function ARCamera({ onBrowse }) {
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  /** UI state machine for permission + device errors. */
  const [cameraState, setCameraState] = useState('idle') // idle | requesting | granted | denied | unsupported | error
  const [cameraMessage, setCameraMessage] = useState('')

  const stopStream = useCallback(() => {
    if (!streamRef.current) return
    streamRef.current.getTracks().forEach((t) => t.stop())
    streamRef.current = null

    // Clear the video element when we stop scanning.
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }
  }, [])

  useEffect(() => {
    return () => {
      stopStream()
    }
  }, [stopStream])

  /** Binds a MediaStream to the background `<video>` and attempts autoplay (required on many mobile browsers). */
  const attachStreamToVideo = useCallback((stream) => {
    const video = videoRef.current
    if (!video) return

    try {
      video.srcObject = stream
      // Some browsers require play() to be called after setting srcObject.
      video.play().catch(() => {})
    } catch {
      // No-op: attaching stream can fail in sandboxed contexts.
    }
  }, [])

  /** Requests rear-facing camera only; maps DOM errors to user-facing copy. */
  const requestCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('unsupported')
      setCameraMessage('Camera is not supported in this browser.')
      return
    }

    setCameraState('requesting')
    setCameraMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })

      stopStream()
      streamRef.current = stream
      attachStreamToVideo(stream)
      setCameraState('granted')
      setCameraMessage('')
    } catch (err) {
      stopStream()
      const name = err?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCameraState('denied')
        setCameraMessage('Please allow camera access to scan artifacts.')
      } else {
        setCameraState('error')
        setCameraMessage('Camera access failed. Try again.')
      }
    }
  }, [attachStreamToVideo, stopStream])

  // Best-effort auto-start so users who already granted permission
  // see the live camera feed immediately.
  useEffect(() => {
    const id = window.setTimeout(() => {
      requestCamera()
    }, 0)
    return () => window.clearTimeout(id)
  }, [requestCamera])

  return (
    <div className="ar-camera">
      <div className="ar-camera__bg" aria-hidden />
      <video
        ref={videoRef}
        className="ar-camera__video-bg"
        playsInline
        muted
        autoPlay
        aria-hidden
      />

      <header className="ar-camera__top">
        <div className="ar-camera__brand">
          <div className="ar-camera__logo-wrap">
            <img className="ar-camera__logo" src="/LOGO.svg" alt="" />
          </div>
          <div>
            <div className="ar-camera__wordmark">
              <span className="ar-camera__ar">AR</span>
              <span className="ar-camera__chive">chive</span>
            </div>
            <p className="ar-camera__sub">DLSU Presidents Memoribilia</p>
          </div>
        </div>
        <button type="button" className="ar-camera__browse" onClick={onBrowse}>
          Browse All
        </button>
      </header>

      <div className="ar-camera__viewport">
        <div className="ar-camera__viewport-grad" aria-hidden />
        <div className="ar-camera__viewport-inner">
          <div className="ar-camera__scan" aria-hidden />
          <div className="ar-camera__frame" aria-hidden>
            <span className="ar-camera__corner ar-camera__corner--tl" />
            <span className="ar-camera__corner ar-camera__corner--tr" />
            <span className="ar-camera__corner ar-camera__corner--bl" />
            <span className="ar-camera__corner ar-camera__corner--br" />
          </div>

          {(cameraState !== 'granted' || cameraState === 'requesting') && (
            <div className="ar-camera__permission" role="status" aria-live="polite">
              <div className="ar-camera__permission-title">
                {cameraState === 'requesting'
                  ? 'Requesting camera access...'
                  : cameraState === 'denied'
                    ? 'Camera access needed'
                    : cameraState === 'unsupported'
                      ? 'Camera unavailable'
                      : 'Enable camera to scan'}
              </div>
              <div className="ar-camera__permission-sub">
                {cameraMessage ||
                  'Tap “Enable Camera” to let your browser access the camera for scanning.'}
              </div>
              <button
                type="button"
                className="ar-camera__permission-btn"
                onClick={requestCamera}
                disabled={cameraState === 'requesting'}
              >
                Enable Camera
              </button>
            </div>
          )}
        </div>
        <p className="ar-camera__frame-hint">Point at an artifact</p>
      </div>

      <footer className="ar-camera__bottom">
        <div className="ar-camera__status">
          <p className="ar-camera__status-title">
            {cameraState === 'granted'
              ? 'No artifact detected yet'
              : cameraState === 'denied'
                ? 'Camera permission required'
                : cameraState === 'unsupported'
                  ? 'Camera not supported'
                  : 'Camera access required'}
          </p>
          <p className="ar-camera__status-sub">
            {cameraState === 'granted'
              ? 'Move closer or improve lighting'
              : cameraMessage || 'Tap “Enable Camera” to continue.'}
          </p>
        </div>
      </footer>
    </div>
  )
}

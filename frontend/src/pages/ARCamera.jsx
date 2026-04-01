/**
 * ARCamera.jsx — full-screen camera UI: `getUserMedia` preview, permission prompts, link to browse mode.
 * Includes local simulation flow: SCANNING -> VIEWING_3D -> INFO_OPEN.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import InfoSheet from '../components/ar/InfoSheet'
import ModelViewer from '../components/ar/ModelViewer'
import './ARCamera.css'

const MOCK_ARTIFACT = {
  label: 'Presidential Trophy',
  confidence: 0.94,
  artifactInfo: {
    name: 'Presidential Achievement Trophy',
    president: 'Dr. Emilio Aguinaldo',
    year: '1998',
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
    historical_context:
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.',
  },
}

export default function ARCamera({ onBrowse }) {
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  /** UI state machine for permission + device errors. */
  const [cameraState, setCameraState] = useState('idle') // idle | requesting | granted | denied | unsupported | error
  const [cameraMessage, setCameraMessage] = useState('')
  const [mode, setMode] = useState('SCANNING') // SCANNING | VIEWING_3D | INFO_OPEN
  const [artifact, setArtifact] = useState(null)

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

  // Temporary dev trigger: replace with real detector callback once model inference is integrated.
  const handleTemporaryDetection = useCallback(() => {
    setArtifact(MOCK_ARTIFACT)
    setMode('VIEWING_3D')
  }, [])

  const handleOpenInfo = useCallback(() => {
    if (!artifact) return
    setMode('INFO_OPEN')
  }, [artifact])

  const handleCloseInfo = useCallback(() => {
    setMode('VIEWING_3D')
  }, [])

  const handleExit = useCallback(() => {
    if (mode === 'INFO_OPEN') {
      handleCloseInfo()
      return
    }
    setArtifact(null)
    setMode('SCANNING')
  }, [handleCloseInfo, mode])

  const show3D = mode === 'VIEWING_3D' || mode === 'INFO_OPEN'
  const showInfo = mode === 'INFO_OPEN'

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
      {/* Single uniform dim over the feed (replaces viewport-only gradient so footer matches). */}
      <div className="ar-camera__feed-overlay" aria-hidden />

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
        <div className="flex items-center gap-2">
          <button type="button" className="ar-camera__browse" onClick={onBrowse}>
            Browse All
          </button>
        </div>
      </header>

      <div className="ar-camera__viewport">
        {show3D ? (
          <div className="ar-camera__viewer-stage">
            <ModelViewer
              artifactLabel={artifact?.label ?? 'Artifact'}
              dimmed={showInfo}
              onTap={showInfo ? handleCloseInfo : handleOpenInfo}
            />
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {!show3D && (
        <footer className="ar-camera__bottom">
          {cameraState === 'granted' && mode === 'SCANNING' && (
            <div className="ar-camera__simulate-wrap">
              <button type="button" className="ar-camera__simulate" onClick={handleTemporaryDetection}>
                Simulate Detection
              </button>
            </div>
          )}
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
      )}

      {showInfo && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={handleCloseInfo} />
          <InfoSheet artifact={artifact} onClose={handleCloseInfo} />
        </>
      )}

      {(show3D || showInfo) && (
        <button type="button" onClick={handleExit} className="ar-camera__exit" aria-label="Exit">
          ✕
        </button>
      )}
    </div>
  )
}

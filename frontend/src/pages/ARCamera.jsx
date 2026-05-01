/**
 * ARCamera.jsx — full-screen camera UI: `getUserMedia` preview, permission prompts, link to browse mode.
 * Includes local simulation flow: SCANNING -> VIEWING_3D -> INFO_OPEN.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import InfoSheet from '../components/ar/InfoSheet'
import ModelViewer from '../components/ar/ModelViewer'
import { env } from '../config/env'
import { analyzeFrameSignals, classifyRdItemsFrame, getRdModelClasses } from '../lib/rdClassifier'
import { fetchRecognitionCandidates } from '../lib/recognitionApi'
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

// Gates use probability-calibrated scores (YOLO logits → sigmoid + anchor fusion + EMA in this page).
const MIN_DETECTION_CONFIDENCE = 0.62
const MIN_CONFIDENCE_MARGIN = 0.17
const MIN_STABLE_HITS = 3
const INFERENCE_EVERY_MS = 480
/** Higher = smoother / fewer flips between similar classes (e.g. RD336 vs RD374). */
const PROB_EMA_ALPHA = 0.4
/** Only suppress obvious hand close-ups while confidence is still weak (wooden/warm relics skew “skin”). */
const HAND_REJECT_MAX_CONFIDENCE = 0.72
const HANDLIKE_SKIN_RATIO = 0.38
const HANDLIKE_EDGE_DENSITY = 0.1

export default function ARCamera({ onBrowse }) {
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const frameCanvasRef = useRef(null)
  const detectIntervalRef = useRef(null)
  const detectionLockRef = useRef(false)
  const stableMatchRef = useRef({ className: null, hits: 0 })
  const hybridAvailableRef = useRef(env.recognitionHybridEnabled)
  const labelsOrderedRef = useRef([])
  const probEmaRef = useRef(null)
  /** UI state machine for permission + device errors. */
  const [cameraState, setCameraState] = useState('idle') // idle | requesting | granted | denied | unsupported | error
  const [cameraMessage, setCameraMessage] = useState('')
  const [mode, setMode] = useState('SCANNING') // SCANNING | VIEWING_3D | INFO_OPEN
  const [artifact, setArtifact] = useState(null)
  const [livePrediction, setLivePrediction] = useState(null)
  const [supportedClassSet, setSupportedClassSet] = useState(() => new Set())

  useEffect(() => {
    let cancelled = false
    const loadClasses = async () => {
      const labels = await getRdModelClasses()
      if (!cancelled) {
        labelsOrderedRef.current = labels
        setSupportedClassSet(new Set(labels))
      }
    }
    void loadClasses()
    return () => {
      cancelled = true
    }
  }, [])

  const captureFrameDataUrl = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < 2) return null
    let canvas = frameCanvasRef.current
    if (!canvas) {
      canvas = document.createElement('canvas')
      frameCanvasRef.current = canvas
    }
    const side = 320
    canvas.width = side
    canvas.height = side
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, side, side)
    return canvas.toDataURL('image/jpeg', 0.72)
  }, [])

  const classifyFrameHybridOrLocal = useCallback(async () => {
    const video = videoRef.current
    if (!video) return null

    if (hybridAvailableRef.current) {
      try {
        const frameDataUrl = captureFrameDataUrl()
        if (!frameDataUrl) return null
        const response = await fetchRecognitionCandidates({
          frameDataUrl,
          topK: 5,
          minScore: MIN_DETECTION_CONFIDENCE,
        })
        const best = response?.candidates?.[0]
        if (!best || response?.supported === false) return null
        // Ignore backend scaffold placeholders (non-frame-aware mock candidates).
        // This prevents false triggers (e.g., faces/hands) until real retrieval is wired.
        if (typeof best.source === 'string' && best.source.startsWith('mock-')) {
          throw new Error('Hybrid scaffold candidate ignored; fallback to local classifier')
        }
        return {
          className: best.label,
          confidence: Number(best.score ?? 0),
          classIndex: -1,
          probabilities: [],
          source: 'hybrid',
        }
      } catch {
        // If hybrid route is unavailable (e.g., auth/session not ready), stay functional with local ONNX.
        hybridAvailableRef.current = false
      }
    }

    const local = await classifyRdItemsFrame(video)
    if (!local) return null
    return { ...local, source: 'local' }
  }, [captureFrameDataUrl])

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

  const clearDetectionWatchers = useCallback(() => {
    detectionLockRef.current = false
    stableMatchRef.current = { className: null, hits: 0 }
    probEmaRef.current = null
    if (detectIntervalRef.current) {
      window.clearInterval(detectIntervalRef.current)
      detectIntervalRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      clearDetectionWatchers()
      stopStream()
    }
  }, [clearDetectionWatchers, stopStream])

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

  // Temporary mock popup (3D + info) now triggered by classifier match.
  const handleTemporaryDetection = useCallback((detectedClass, confidence) => {
    const prettyConf = typeof confidence === 'number' ? Math.round(confidence * 100) / 100 : MOCK_ARTIFACT.confidence
    setArtifact({
      ...MOCK_ARTIFACT,
      label: detectedClass || MOCK_ARTIFACT.label,
      confidence: prettyConf,
    })
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
    setLivePrediction(null)
  }, [handleCloseInfo, mode])

  useEffect(() => {
    clearDetectionWatchers()
    if (cameraState !== 'granted' || mode !== 'SCANNING') return

    setLivePrediction(null)
    detectionLockRef.current = false

    const runInference = async () => {
      if (detectionLockRef.current) return
      const video = videoRef.current
      if (!video) return
      try {
        const pred = await classifyFrameHybridOrLocal()
        if (!pred) return
        const frameSignals = analyzeFrameSignals(video)
        const looksHandLike =
          frameSignals &&
          frameSignals.skinRatio >= HANDLIKE_SKIN_RATIO &&
          frameSignals.edgeDensity <= HANDLIKE_EDGE_DENSITY

        let gated = pred
        const rawProbs = pred.probabilities
        if (Array.isArray(rawProbs) && rawProbs.length > 0) {
          const n = rawProbs.length
          let ema = probEmaRef.current
          if (!ema || ema.length !== n) {
            probEmaRef.current = Float32Array.from(rawProbs)
            ema = probEmaRef.current
          } else {
            const a = PROB_EMA_ALPHA
            for (let i = 0; i < n; i += 1) {
              ema[i] = (1 - a) * ema[i] + a * rawProbs[i]
            }
          }
          let norm = 0
          for (let i = 0; i < n; i += 1) norm += ema[i]
          if (norm > 0) {
            for (let i = 0; i < n; i += 1) ema[i] /= norm
          }
          let bestIdx = 0
          let best = ema[0] ?? 0
          let second = 0
          for (let i = 0; i < n; i += 1) {
            const p = ema[i] ?? 0
            if (p > best) {
              second = best
              best = p
              bestIdx = i
            } else if (p > second) {
              second = p
            }
          }
          const labels = labelsOrderedRef.current
          const smoothedName = labels[bestIdx] ?? pred.className
          const marginSmoothed = Math.max(0, best - second)
          gated = {
            ...pred,
            classIndex: bestIdx,
            className: smoothedName,
            confidence: Number(best.toFixed(4)),
            margin: Number(marginSmoothed.toFixed(4)),
            probabilities: Array.from(ema),
          }
        }

        const probs = gated.probabilities ?? []
        let secondBest = 0
        for (let i = 0; i < probs.length; i += 1) {
          if (i === gated.classIndex) continue
          if (probs[i] > secondBest) secondBest = probs[i]
        }
        const margin = gated.margin ?? Math.max(0, gated.confidence - secondBest)
        setLivePrediction({ ...gated, margin: Number(margin.toFixed(4)) })
        const hasSupportedLabels = supportedClassSet.size > 0
        const isKnown = hasSupportedLabels && supportedClassSet.has(gated.className)
        const strongOpenSetMatch =
          gated.confidence >= MIN_DETECTION_CONFIDENCE && margin >= MIN_CONFIDENCE_MARGIN
        const handBlocks =
          looksHandLike &&
          HAND_REJECT_MAX_CONFIDENCE > 0 &&
          gated.confidence < HAND_REJECT_MAX_CONFIDENCE
        if (!isKnown || !strongOpenSetMatch || handBlocks) {
          stableMatchRef.current = { className: null, hits: 0 }
          return
        }

        if (stableMatchRef.current.className === gated.className) {
          stableMatchRef.current.hits += 1
        } else {
          stableMatchRef.current = { className: gated.className, hits: 1 }
        }
        if (stableMatchRef.current.hits < MIN_STABLE_HITS) return

        detectionLockRef.current = true
        clearDetectionWatchers()
        handleTemporaryDetection(gated.className, gated.confidence)
      } catch {
        // Keep scanning if one frame fails.
      }
    }

    detectIntervalRef.current = window.setInterval(() => {
      void runInference()
    }, INFERENCE_EVERY_MS)
    void runInference()

    return () => {
      clearDetectionWatchers()
    }
  }, [
    cameraState,
    classifyFrameHybridOrLocal,
    clearDetectionWatchers,
    handleTemporaryDetection,
    mode,
    supportedClassSet,
  ])

  const show3D = mode === 'VIEWING_3D' || mode === 'INFO_OPEN'
  const showInfo = mode === 'INFO_OPEN'
  const liveClass = livePrediction?.className ?? 'scanning...'
  const liveConfidence = livePrediction?.confidence ?? 0
  const liveKnownClass = livePrediction ? supportedClassSet.has(livePrediction.className) : false

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
              <div
                className={`ar-camera__live-box ${
                  livePrediction
                    ? liveKnownClass
                      ? 'ar-camera__live-box--known'
                      : 'ar-camera__live-box--unknown'
                    : ''
                }`}
                style={{
                  transform: `scale(${0.88 + Math.min(0.12, liveConfidence * 0.12)})`,
                  opacity: 0.55 + Math.min(0.4, liveConfidence * 0.4),
                }}
                aria-hidden
              >
                <div className="ar-camera__live-box-line ar-camera__live-box-line--h" />
                <div className="ar-camera__live-box-line ar-camera__live-box-line--v" />
                <div className="ar-camera__live-box-sweep" />
              </div>
              <div className="ar-camera__live-pill" aria-live="polite">
                <span>{liveClass}</span>
                <span>{Math.round(liveConfidence * 100)}%</span>
              </div>
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
              <button type="button" className="ar-camera__simulate" onClick={() => handleTemporaryDetection()}>
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

/**
 * ARCamera.jsx — full-screen camera UI: `getUserMedia` preview, permission prompts, link to browse mode.
 * Includes local simulation flow: SCANNING -> VIEWING_3D -> INFO_OPEN.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import InfoSheet from '../components/ar/InfoSheet'
import ModelViewer from '../components/ar/ModelViewer'
import { env } from '../config/env'
import {
  analyzeFrameSignals,
  classifyRdItemsFrame,
  getRdModelClasses,
  getRdScannerReadyPromise,
  preloadRdScanner,
} from '../lib/rdClassifier'
import { fetchRecognitionCandidates } from '../lib/recognitionApi'
import './ARCamera.css'

const MOCK_ARTIFACT = {
  label: 'Presidential Trophy',
  confidence: 0.94,
  artifactInfo: {
    name: 'Presidential Achievement Trophy',
    president: 'Dr. Emilio Aguinaldo',
    year: '1998',
    origin: 'Japan',
    category: 'Trophy',
    tags: ['Award', 'Brass', 'Ceremonial'],
    description:
      'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Curabitur pretium tincidunt lacus, nec dignissim erat posuere sit amet. Maecenas vel nisl at urna vestibulum pharetra.',
    historical_context:
      'Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur. Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur.',
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

const SCAN_TIPS = [
  'Center the artifact within the scanner frame.',
  'Ensure good lighting for better detection.',
  'Try a different angle if not recognized.',
]

export default function ARCamera({ onBrowse, onHome, darkMode }) {
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const frameCanvasRef = useRef(null)
  const detectIntervalRef = useRef(null)
  const detectionLockRef = useRef(false)
  const stableMatchRef = useRef({ className: null, hits: 0 })
  const hybridAvailableRef = useRef(env.recognitionHybridEnabled)
  const labelsOrderedRef = useRef([])
  const probEmaRef = useRef(null)
  const dragProgressRef = useRef(0)
  /** UI state machine for permission + device errors. */
  const [cameraState, setCameraState] = useState('requesting') // idle | requesting | granted | denied | unsupported | error
  const [cameraMessage, setCameraMessage] = useState('')
  const [mode, setMode] = useState('SCANNING') // SCANNING | VIEWING_3D | INFO_OPEN
  const [artifact, setArtifact] = useState(null)
  const [livePrediction, setLivePrediction] = useState(null)
  const [supportedClassSet, setSupportedClassSet] = useState(() => new Set())
  const [scannerModelReady, setScannerModelReady] = useState(false)
  const [tipIndex, setTipIndex] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % SCAN_TIPS.length)
    }, 3500)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    void preloadRdScanner()
    let cancelled = false
    void getRdScannerReadyPromise().finally(() => {
      if (!cancelled) setScannerModelReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        setCameraState('idle')
        setCameraMessage('Camera may be in use by another tab. Close other tabs and try again.')
      } else {
        setCameraState('error')
        setCameraMessage('Camera access failed. Try again.')
      }
    }
  }, [attachStreamToVideo, stopStream])

  // Auto-start camera immediately — initial state is 'requesting' so
  // no permission prompt flashes for users who already granted access.
  useEffect(() => {
    requestCamera()
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
    dragProgressRef.current = 0
    setMode('INFO_OPEN')
  }, [artifact])

  const handleCloseInfo = useCallback(() => {
    dragProgressRef.current = 0
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
  const scanningUiLoadingModel = cameraState === 'granted' && !scannerModelReady
  const livePillLabel = scanningUiLoadingModel ? 'Loading model...' : liveClass
  const livePillPercent = scanningUiLoadingModel ? '--' : `${Math.round(liveConfidence * 100)}%`

  return (
    <div className={`ar-camera ${darkMode ? 'ar-dark' : ''}`}>
      <video
        ref={videoRef}
        className="ar-camera__video-bg"
        playsInline
        muted
        autoPlay
        aria-hidden
      />
      <header className="ar-camera__top">
        <button type="button" className="ar-camera__nav-btn" onClick={onHome} aria-label="Back to Home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ar-camera__nav-icon"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="ar-camera__page-title">Scan Artifact</h1>
        <button type="button" className="ar-camera__nav-btn" onClick={onBrowse} aria-label="Browse Artifacts">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ar-camera__nav-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><path d="M8 3h8" /><path d="M6 1h12" /></svg>
        </button>
      </header>

      <div className="ar-camera__viewport">
        {show3D ? (
          <div className="ar-camera__viewer-stage">
            <ModelViewer
              artifactLabel={artifact?.label ?? 'Artifact'}
              showArtifactLabel={false}
              dimmed={showInfo}
              dragProgressRef={dragProgressRef}
              onTap={showInfo ? handleCloseInfo : handleOpenInfo}
            />
          </div>
        ) : cameraState === 'granted' ? (
          <>
            <div className="ar-camera__live-pill" aria-live="polite">
              <span>{livePillLabel}</span>
              <span>{livePillPercent}</span>
            </div>
            <div className="ar-camera__viewport-inner">
              <div className="ar-camera__scan" aria-hidden />
              <div className="ar-camera__crosshair" aria-hidden />
              <div className="ar-camera__frame" aria-hidden>
                <span className="ar-camera__corner ar-camera__corner--tl" />
                <span className="ar-camera__corner ar-camera__corner--tr" />
                <span className="ar-camera__corner ar-camera__corner--bl" />
                <span className="ar-camera__corner ar-camera__corner--br" />
              </div>
            </div>
            <p className="ar-camera__frame-hint">Point at an artifact</p>
            {mode === 'SCANNING' && (
              <button type="button" className="ar-camera__simulate" onClick={() => handleTemporaryDetection()}>
                Simulate Detection
              </button>
            )}
          </>
        ) : cameraState === 'requesting' ? null : (
          <div className="ar-camera__permission" role="status" aria-live="polite">
            <div className="ar-camera__permission-title">
              {cameraState === 'denied'
                  ? 'Camera access needed'
                  : cameraState === 'unsupported'
                    ? 'Camera unavailable'
                    : 'Enable camera to scan'}
            </div>
            <div className="ar-camera__permission-sub">
              {cameraMessage ||
                'Tap “Enable Camera” to let your browser access the camera for scanning.'}
            </div>
            <div className="ar-camera__permission-actions">
              <button
                type="button"
                className="ar-camera__permission-btn"
                onClick={requestCamera}
                disabled={cameraState === 'requesting'}
              >
                Grant Camera Access
              </button>
            </div>
          </div>
        )}
      </div>

      {!show3D && cameraState === 'granted' && (
        <footer className="ar-camera__bottom">
          <div className="ar-camera__status">
            <p className="ar-camera__status-sub ar-camera__tip" key={tipIndex}>Tip: {SCAN_TIPS[tipIndex]}</p>
          </div>
        </footer>
      )}

      {showInfo && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={handleCloseInfo} />
          <InfoSheet artifact={artifact} darkMode={darkMode} onClose={handleCloseInfo} onDragProgress={(p) => { dragProgressRef.current = p }} />
        </>
      )}

      {(show3D || showInfo) && (
        <div className="ar-camera__detect-bar">
          <span className="ar-camera__detect-label">{artifact?.label ?? 'Artifact'}</span>
          <button type="button" onClick={handleExit} className="ar-camera__exit" aria-label="Exit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      )}
    </div>
  )
}

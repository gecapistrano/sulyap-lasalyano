/**
 * ARCamera.jsx — live museum scan: multi-item YOLO outlines on the camera feed.
 * Info opens only when the visitor taps an outlined detection (never auto-popup).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import DetectionOverlay from '../components/ar/DetectionOverlay'
import InfoSheet from '../components/ar/InfoSheet'
import { env } from '../config/env'
import {
  analyzeFrameSignals,
  clampPreviewZoom,
  classifyRdItemsFrame,
  getRdModelClasses,
  PREVIEW_ZOOM_MAX,
  preloadRdScanner,
} from '../lib/rdClassifier'
import { PLACEHOLDER_ARTIFACT_DESCRIPTION } from '../data/artifactBrowseMocks'
import {
  getCatalogArtifactByIdCode,
  isBackendConfigured,
  listCatalogArtifacts,
  mapCatalogArtifact,
} from '../lib/archiveApi'
import { t } from '../i18n'
import './ARCamera.css'

/** Accept into tracker (not shown until locked). */
const MIN_CANDIDATE_CONFIDENCE = 0.32
/** Show outline only after a stable lock — higher bars favor accuracy over speed. */
const MIN_LOCK_CONFIDENCE = 0.55
const MIN_LOCK_MARGIN = 0.12
const LOCK_HITS = 3
/** Strong short-burst confirm. */
const FAST_LOCK_CONFIDENCE = 0.7
const FAST_LOCK_MARGIN = 0.18
const FAST_LOCK_HITS = 2
/** Minimum gap after each ONNX run before the next (inference is chained, not stacked). */
const INFERENCE_GAP_MS = 48
/** Only suppress obvious hand close-ups while confidence is still weak. */
const HAND_REJECT_MAX_CONFIDENCE = 0.5
const HANDLIKE_SKIN_RATIO = 0.42
const HANDLIKE_EDGE_DENSITY = 0.08
/** Keep a candidate briefly; locked outlines drop quickly once off-frame. */
const TRACK_MISS_TOLERANCE = 4
const LOCKED_MISS_TOLERANCE = 2

const SCAN_TIP_KEYS = ['scan.tip1', 'scan.tip2', 'scan.tip3', 'scan.tip4']

function boxIoU(a, b) {
  if (!a || !b) return 0
  const ax1 = a.cx - a.w / 2
  const ay1 = a.cy - a.h / 2
  const ax2 = a.cx + a.w / 2
  const ay2 = a.cy + a.h / 2
  const bx1 = b.cx - b.w / 2
  const by1 = b.cy - b.h / 2
  const bx2 = b.cx + b.w / 2
  const by2 = b.cy + b.h / 2
  const ix1 = Math.max(ax1, bx1)
  const iy1 = Math.max(ay1, by1)
  const ix2 = Math.min(ax2, bx2)
  const iy2 = Math.min(ay2, by2)
  const iw = Math.max(0, ix2 - ix1)
  const ih = Math.max(0, iy2 - iy1)
  const inter = iw * ih
  const union = a.w * a.h + b.w * b.h - inter
  return union > 0 ? inter / union : 0
}

function isKnownClass(knownSet, className) {
  // Empty set = labels still loading; do not drop candidates.
  if (!knownSet || knownSet.size === 0) return true
  return knownSet.has(className)
}

function computeLocked(track) {
  const conf = Number(track.confidence ?? 0)
  const margin = Number(track.margin ?? 0)
  const hits = Number(track.hits ?? 0)
  if (track.locked) {
    // Hysteresis: stay locked with slightly softer requirements.
    return conf >= MIN_LOCK_CONFIDENCE * 0.85 && hits >= LOCK_HITS - 1
  }
  const fast =
    conf >= FAST_LOCK_CONFIDENCE && margin >= FAST_LOCK_MARGIN && hits >= FAST_LOCK_HITS
  const steady = conf >= MIN_LOCK_CONFIDENCE && margin >= MIN_LOCK_MARGIN && hits >= LOCK_HITS
  return fast || steady
}

/**
 * Track YOLO boxes across frames. Keeps candidate + locked tracks in memory;
 * callers should display only `locked` tracks.
 */
function smoothDetectionTracks(prevTracks, rawDetections, knownSet) {
  const incoming = (rawDetections || []).filter(
    (d) =>
      d?.box &&
      isKnownClass(knownSet, d.className) &&
      Number(d.confidence ?? 0) >= MIN_CANDIDATE_CONFIDENCE,
  )
  const matchedPrev = new Set()
  const next = []
  let nextId = prevTracks.reduce((m, t) => Math.max(m, t.trackNum || 0), 0) + 1

  for (const det of incoming) {
    let bestIdx = -1
    let bestIoU = 0.28
    // Same-class first. Cross-class only for unlocked tracks (locked never change class).
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < prevTracks.length; i += 1) {
        if (matchedPrev.has(i)) continue
        const prev = prevTracks[i]
        if (pass === 0 && prev.className !== det.className) continue
        if (pass === 1 && prev.locked) continue
        const iou = boxIoU(prev.box, det.box)
        const minIou = pass === 0 ? 0.28 : 0.45
        if (iou >= minIou && iou > bestIoU) {
          bestIoU = iou
          bestIdx = i
        }
      }
      if (bestIdx >= 0) break
    }

    if (bestIdx >= 0) {
      matchedPrev.add(bestIdx)
      const prev = prevTracks[bestIdx]
      const sameClass = prev.className === det.className
      // Locked tracks follow the camera more tightly; candidates stay smoother.
      const follow = prev.locked ? 0.22 : 0.55
      const lead = 1 - follow
      const blended = {
        ...det,
        box: {
          cx: prev.box.cx * follow + det.box.cx * lead,
          cy: prev.box.cy * follow + det.box.cy * lead,
          w: prev.box.w * follow + det.box.w * lead,
          h: prev.box.h * follow + det.box.h * lead,
        },
        confidence: Math.max(Number(det.confidence ?? 0), Number(prev.confidence ?? 0) * 0.85),
        margin: Math.max(Number(det.margin ?? 0), Number(prev.margin ?? 0) * 0.8),
        trackId: prev.trackId,
        trackNum: prev.trackNum,
        hits: sameClass ? prev.hits + 1 : 1,
        miss: 0,
        locked: Boolean(prev.locked) && sameClass,
      }
      blended.locked = computeLocked(blended)
      next.push(blended)
    } else {
      const created = {
        ...det,
        trackId: `t-${nextId}`,
        trackNum: nextId,
        hits: 1,
        miss: 0,
        locked: false,
      }
      created.locked = computeLocked(created)
      next.push(created)
      nextId += 1
    }
  }

  for (let i = 0; i < prevTracks.length; i += 1) {
    if (matchedPrev.has(i)) continue
    const prev = prevTracks[i]
    const miss = (prev.miss || 0) + 1
    const maxMiss = prev.locked ? LOCKED_MISS_TOLERANCE : TRACK_MISS_TOLERANCE
    if (miss <= maxMiss) {
      next.push({
        ...prev,
        miss,
        hits: prev.hits,
        locked: prev.locked && miss <= LOCKED_MISS_TOLERANCE,
      })
    }
  }

  return next
}

export default function ARCamera({ language = 'English', onBrowse, onHome, darkMode }) {
  const streamRef = useRef(null)
  const videoRef = useRef(null)
  const frameCanvasRef = useRef(null)
  const detectTimerRef = useRef(null)
  const inferenceBusyRef = useRef(false)
  const hybridAvailableRef = useRef(env.recognitionHybridEnabled)
  const tracksRef = useRef([])
  const dragProgressRef = useRef(0)
  const viewportRef = useRef(null)
  const previewZoomRef = useRef(1)
  const pinchGestureRef = useRef(null)
  const hardwareZoomRef = useRef(false)
  /** Prefetched public catalog keyed by RD code (uppercase). */
  const catalogByRdRef = useRef(new Map())
  const openRequestIdRef = useRef(0)
  /** UI state machine for permission + device errors. */
  const [cameraState, setCameraState] = useState('requesting') // idle | requesting | granted | denied | unsupported | error
  const [cameraMessage, setCameraMessage] = useState('')
  const [mode, setMode] = useState('SCANNING') // SCANNING | INFO_OPEN
  const [artifact, setArtifact] = useState(null)
  const [infoLoading, setInfoLoading] = useState(false)
  const [liveDetections, setLiveDetections] = useState([])
  const [supportedClassSet, setSupportedClassSet] = useState(() => new Set())
  const [tipIndex, setTipIndex] = useState(0)
  const [previewZoom, setPreviewZoom] = useState(1)
  const [useHardwareZoom, setUseHardwareZoom] = useState(false)

  const setPreviewZoomLevel = useCallback((nextZoom) => {
    const clamped = clampPreviewZoom(nextZoom)
    previewZoomRef.current = clamped
    setPreviewZoom(clamped)
    if (!hardwareZoomRef.current) return
    const stream = streamRef.current
    const track = stream?.getVideoTracks?.()?.[0]
    const caps = track?.getCapabilities?.()
    if (!track || !caps?.zoom) return
    const { min, max } = caps.zoom
    const span = PREVIEW_ZOOM_MAX - 1
    const t = span > 0 ? (clamped - 1) / span : 0
    const deviceZoom = min + t * (max - min)
    track.applyConstraints({ advanced: [{ zoom: deviceZoom }] }).catch(() => {})
  }, [])

  const resetPreviewZoom = useCallback(() => {
    setPreviewZoomLevel(1)
  }, [setPreviewZoomLevel])

  const pinchSpan = useCallback((touches) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % SCAN_TIP_KEYS.length)
    }, 3500)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    void preloadRdScanner()
  }, [])

  useEffect(() => {
    let cancelled = false
    const loadClasses = async () => {
      const labels = await getRdModelClasses()
      if (!cancelled) setSupportedClassSet(new Set(labels))
    }
    void loadClasses()
    return () => {
      cancelled = true
    }
  }, [])

  /** Warm catalog cache so taps resolve from the database without waiting on every outline. */
  useEffect(() => {
    if (cameraState !== 'granted' || !isBackendConfigured()) return undefined
    let cancelled = false
    const warm = async () => {
      try {
        const rows = await listCatalogArtifacts()
        if (cancelled || !Array.isArray(rows)) return
        const map = new Map()
        for (const row of rows) {
          const mapped = mapCatalogArtifact(row)
          const code = String(mapped?.rdCode || '')
            .trim()
            .toUpperCase()
          if (code && mapped) map.set(code, mapped)
        }
        catalogByRdRef.current = map
      } catch {
        // Tap path still fetches by RD code.
      }
    }
    void warm()
    return () => {
      cancelled = true
    }
  }, [cameraState])

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
    const zoom = hardwareZoomRef.current ? 1 : previewZoomRef.current
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) return null
    const z = clampPreviewZoom(zoom)
    if (z <= 1.001) {
      ctx.drawImage(video, 0, 0, side, side)
    } else {
      const sw = vw / z
      const sh = vh / z
      const sx = (vw - sw) / 2
      const sy = (vh - sh) / 2
      ctx.drawImage(video, sx, sy, sw, sh, 0, 0, side, side)
    }
    return canvas.toDataURL('image/jpeg', 0.72)
  }, [])

  /** Local YOLO first — needed for multi-item boxes / AR outlines on the feed. */
  const classifyFrameForLiveScan = useCallback(async () => {
    const video = videoRef.current
    if (!video) return null

    const local = await classifyRdItemsFrame(video, {
      zoom: hardwareZoomRef.current ? 1 : previewZoomRef.current,
    })
    if (local) return { ...local, source: 'local' }

    // Optional hybrid fallback (no boxes) if local model is unavailable.
    if (!hybridAvailableRef.current) return null
    try {
      const frameDataUrl = captureFrameDataUrl()
      if (!frameDataUrl) return null
      const { fetchRecognitionCandidates } = await import('../lib/recognitionApi')
      const response = await fetchRecognitionCandidates({
        frameDataUrl,
        topK: 5,
        minScore: MIN_CANDIDATE_CONFIDENCE,
      })
      const best = response?.candidates?.[0]
      if (!best || response?.supported === false) return null
      if (typeof best.source === 'string' && best.source.startsWith('mock-')) return null
      return {
        className: best.label,
        confidence: Number(best.score ?? 0),
        classIndex: -1,
        probabilities: [],
        detections: [],
        source: 'hybrid',
      }
    } catch {
      hybridAvailableRef.current = false
      return null
    }
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
    inferenceBusyRef.current = false
    tracksRef.current = []
    if (detectTimerRef.current) {
      window.clearTimeout(detectTimerRef.current)
      detectTimerRef.current = null
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
      setCameraMessage(t(language, 'scan.unsupported'))
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
      const track = stream.getVideoTracks?.()?.[0]
      const caps = track?.getCapabilities?.()
      const hasHardwareZoom = Boolean(caps?.zoom && caps.zoom.max > caps.zoom.min)
      hardwareZoomRef.current = hasHardwareZoom
      setUseHardwareZoom(hasHardwareZoom)
      if (!hasHardwareZoom) {
        resetPreviewZoom()
      }
      attachStreamToVideo(stream)
      setCameraState('granted')
      setCameraMessage('')
    } catch (err) {
      stopStream()
      const name = err?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setCameraState('denied')
        setCameraMessage(t(language, 'scan.denied'))
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        setCameraState('idle')
        setCameraMessage(t(language, 'scan.inUse'))
      } else {
        setCameraState('error')
        setCameraMessage(t(language, 'scan.failed'))
      }
    }
  }, [attachStreamToVideo, language, resetPreviewZoom, stopStream])

  // Auto-start camera immediately — initial state is 'requesting' so
  // no permission prompt flashes for users who already granted access.
  useEffect(() => {
    requestCamera()
  }, [requestCamera])

  /** Build info payload from a catalog row (or a clear missing-record message). */
  const applyDetectionRecord = useCallback((record, prettyConf, rdCode) => {
    if (record) {
      const body = record.description || PLACEHOLDER_ARTIFACT_DESCRIPTION
      setArtifact({
        label: record.rdCode || rdCode,
        confidence: prettyConf,
        artifactInfo: {
          name: record.name,
          president: record.owner,
          year: record.year,
          origin: record.subtitle ?? '',
          category: record.rdCode || rdCode,
          tags: [record.rdCode || rdCode, record.subtitle].filter(Boolean),
          description: body,
          historical_context: body,
        },
      })
    } else {
      setArtifact({
        label: rdCode || '—',
        confidence: prettyConf,
        artifactInfo: {
          name: rdCode ? `${rdCode}` : 'Unknown item',
          president: '',
          year: '',
          origin: '',
          category: rdCode || '',
          tags: rdCode ? [rdCode] : [],
          description: rdCode
            ? `No published catalog record found for ${rdCode}. A curator can add it in Curator Desk.`
            : 'No catalog record found for this detection.',
          historical_context: '',
        },
      })
    }
    dragProgressRef.current = 0
    setMode('INFO_OPEN')
  }, [])

  const openArtifactFromDetection = useCallback(
    async (detectedClass, confidence) => {
      const prettyConf =
        typeof confidence === 'number' ? Math.round(confidence * 100) / 100 : 0
      const rdCode = typeof detectedClass === 'string' ? detectedClass.trim().toUpperCase() : ''
      const reqId = (openRequestIdRef.current += 1)

      setInfoLoading(true)
      setArtifact({
        label: rdCode || '—',
        confidence: prettyConf,
        artifactInfo: {
          name: rdCode || '…',
          president: '',
          year: '',
          origin: '',
          category: rdCode,
          tags: rdCode ? [rdCode] : [],
          description: 'Loading catalog details…',
          historical_context: '',
        },
      })
      dragProgressRef.current = 0
      setMode('INFO_OPEN')

      try {
        let mapped = rdCode ? catalogByRdRef.current.get(rdCode) || null : null
        if (!mapped && rdCode && isBackendConfigured()) {
          const row = await getCatalogArtifactByIdCode(rdCode)
          mapped = mapCatalogArtifact(row)
          if (mapped) catalogByRdRef.current.set(rdCode, mapped)
        }
        if (reqId !== openRequestIdRef.current) return
        applyDetectionRecord(mapped, prettyConf, rdCode)
      } catch {
        if (reqId !== openRequestIdRef.current) return
        applyDetectionRecord(null, prettyConf, rdCode)
      } finally {
        if (reqId === openRequestIdRef.current) setInfoLoading(false)
      }
    },
    [applyDetectionRecord],
  )

  const handleSelectOutline = useCallback(
    (det) => {
      if (!det?.className || mode !== 'SCANNING' || infoLoading) return
      void openArtifactFromDetection(det.className, det.confidence)
    },
    [infoLoading, mode, openArtifactFromDetection],
  )

  const handleCloseInfo = useCallback(() => {
    openRequestIdRef.current += 1
    dragProgressRef.current = 0
    setInfoLoading(false)
    setArtifact(null)
    setMode('SCANNING')
  }, [])

  const handleExit = useCallback(() => {
    openRequestIdRef.current += 1
    dragProgressRef.current = 0
    setInfoLoading(false)
    setArtifact(null)
    setMode('SCANNING')
    setLiveDetections([])
    tracksRef.current = []
  }, [])

  const canAdjustPreviewZoom = cameraState === 'granted' && mode === 'SCANNING'

  useEffect(() => {
    if (!canAdjustPreviewZoom) resetPreviewZoom()
  }, [canAdjustPreviewZoom, resetPreviewZoom])

  useEffect(() => {
    const el = viewportRef.current
    if (!el || !canAdjustPreviewZoom) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const factor = 1 - event.deltaY * 0.0015
      setPreviewZoomLevel(previewZoomRef.current * factor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [canAdjustPreviewZoom, setPreviewZoomLevel])

  const onZoomTouchStart = useCallback(
    (event) => {
      if (!canAdjustPreviewZoom || event.touches.length < 2) return
      pinchGestureRef.current = {
        startSpan: pinchSpan(event.touches),
        startZoom: previewZoomRef.current,
      }
      event.preventDefault()
    },
    [canAdjustPreviewZoom, pinchSpan],
  )

  const onZoomTouchMove = useCallback(
    (event) => {
      const pinch = pinchGestureRef.current
      if (!pinch || event.touches.length < 2) return
      const span = pinchSpan(event.touches)
      if (!pinch.startSpan || span <= 0) return
      setPreviewZoomLevel(pinch.startZoom * (span / pinch.startSpan))
      event.preventDefault()
    },
    [pinchSpan, setPreviewZoomLevel],
  )

  const onZoomTouchEnd = useCallback((event) => {
    if (event.touches.length < 2) pinchGestureRef.current = null
  }, [])

  useEffect(() => {
    clearDetectionWatchers()
    setLiveDetections([])
    if (cameraState !== 'granted' || mode !== 'SCANNING') return

    tracksRef.current = []

    let loopCancelled = false

    const scheduleNextInference = (delayMs = INFERENCE_GAP_MS) => {
      if (loopCancelled) return
      if (detectTimerRef.current) window.clearTimeout(detectTimerRef.current)
      detectTimerRef.current = window.setTimeout(() => {
        detectTimerRef.current = null
        void runInference()
      }, delayMs)
    }

    const runInference = async () => {
      if (inferenceBusyRef.current) return
      const video = videoRef.current
      if (!video) {
        scheduleNextInference()
        return
      }
      inferenceBusyRef.current = true
      try {
        const pred = await classifyFrameForLiveScan()
        if (!pred) {
          tracksRef.current = smoothDetectionTracks(tracksRef.current, [], supportedClassSet)
          setLiveDetections(tracksRef.current.filter((t) => t.locked))
          return
        }

        const yoloDetScores = pred.scoreKind === 'yolo-det'
        const topConf = Number(pred.confidence ?? 0)
        // Soft hand gate: never wipe a strong YOLO hit (museum wood/skin tones confuse this).
        const needsHandCheck = !yoloDetScores || topConf < HAND_REJECT_MAX_CONFIDENCE
        const frameSignals = needsHandCheck
          ? analyzeFrameSignals(video, hardwareZoomRef.current ? 1 : previewZoomRef.current)
          : null
        const looksHandLike =
          frameSignals &&
          frameSignals.skinRatio >= HANDLIKE_SKIN_RATIO &&
          frameSignals.edgeDensity <= HANDLIKE_EDGE_DENSITY
        const handBlocks = Boolean(looksHandLike && topConf < HAND_REJECT_MAX_CONFIDENCE)

        const rawBoxes = handBlocks ? [] : pred.detections || []
        tracksRef.current = smoothDetectionTracks(tracksRef.current, rawBoxes, supportedClassSet)
        setLiveDetections(tracksRef.current.filter((t) => t.locked))
      } catch {
        // Keep scanning if one frame fails.
      } finally {
        inferenceBusyRef.current = false
        scheduleNextInference()
      }
    }

    void runInference()

    return () => {
      loopCancelled = true
      clearDetectionWatchers()
    }
  }, [
    cameraState,
    classifyFrameForLiveScan,
    clearDetectionWatchers,
    mode,
    supportedClassSet,
  ])

  const showInfo = mode === 'INFO_OPEN'
  const showZoomIndicator = canAdjustPreviewZoom && previewZoom > 1.02
  const scanZoom = hardwareZoomRef.current ? 1 : previewZoom

  return (
    <div
      className={`ar-camera ${darkMode ? 'ar-dark' : ''}`}
      style={
        !useHardwareZoom && canAdjustPreviewZoom
          ? { '--ar-camera-zoom': String(previewZoom) }
          : undefined
      }
    >
      <video
        ref={videoRef}
        className="ar-camera__video-bg"
        playsInline
        muted
        autoPlay
        aria-hidden
      />
      {cameraState === 'granted' && mode === 'SCANNING' && (
            <DetectionOverlay
              detections={liveDetections}
              videoRef={videoRef}
              zoom={scanZoom}
              onSelect={handleSelectOutline}
              detectedLabelTemplate={t(language, 'scan.detectedLabel')}
              tapHint={t(language, 'scan.tapOutline')}
            />
      )}
      <header className="ar-camera__top">
        <button type="button" className="ar-camera__nav-btn" onClick={onHome} aria-label={t(language, 'nav.home')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ar-camera__nav-icon"><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></svg>
        </button>
        <h1 className="ar-camera__page-title">{t(language, 'scan.title')}</h1>
        <button type="button" className="ar-camera__nav-btn" onClick={onBrowse} aria-label={t(language, 'nav.browseArtifacts')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ar-camera__nav-icon"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><path d="M8 3h8" /><path d="M6 1h12" /></svg>
        </button>
      </header>

      <div ref={viewportRef} className="ar-camera__viewport">
        {canAdjustPreviewZoom && (
          <div
            className="ar-camera__zoom-layer"
            aria-hidden
            onTouchStart={onZoomTouchStart}
            onTouchMove={onZoomTouchMove}
            onTouchEnd={onZoomTouchEnd}
            onTouchCancel={onZoomTouchEnd}
          />
        )}
        {showZoomIndicator && (
          <span className="ar-camera__zoom-indicator" aria-live="polite">
            {previewZoom.toFixed(1)}×
          </span>
        )}
        {cameraState === 'granted' && mode === 'SCANNING' ? (
          <p className="ar-camera__frame-hint">{t(language, 'scan.point')}</p>
        ) : cameraState === 'granted' && showInfo ? null : cameraState === 'requesting' ? null : (
          <div className="ar-camera__permission" role="status" aria-live="polite">
            <div className="ar-camera__permission-title">
              {cameraState === 'denied'
                  ? t(language, 'scan.needAccess')
                  : cameraState === 'unsupported'
                    ? t(language, 'scan.unavailable')
                    : t(language, 'scan.enableTitle')}
            </div>
            <div className="ar-camera__permission-sub">
              {cameraMessage || t(language, 'scan.enableHint')}
            </div>
            <div className="ar-camera__permission-actions">
              <button
                type="button"
                className="ar-camera__permission-btn"
                onClick={requestCamera}
                disabled={cameraState === 'requesting'}
              >
                {t(language, 'scan.enableBtn')}
              </button>
            </div>
          </div>
        )}
      </div>

      {mode === 'SCANNING' && cameraState === 'granted' && (
        <footer className="ar-camera__bottom">
          <div className="ar-camera__status">
            <p className="ar-camera__status-sub ar-camera__tip" key={tipIndex}>
              {t(language, 'scan.tipPrefix')} {t(language, SCAN_TIP_KEYS[tipIndex])}
            </p>
          </div>
        </footer>
      )}

      {showInfo && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={handleCloseInfo} />
          <InfoSheet
            artifact={artifact}
            language={language}
            darkMode={darkMode}
            onClose={handleCloseInfo}
            onDragProgress={(p) => { dragProgressRef.current = p }}
          />
          <div className="ar-camera__detect-bar">
            <span className="ar-camera__detect-label">
              {infoLoading
                ? t(language, 'scan.loadingCatalog')
                : (artifact?.label ?? t(language, 'detail.artifact'))}
            </span>
            <button type="button" onClick={handleExit} className="ar-camera__exit" aria-label={t(language, 'nav.exit')}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

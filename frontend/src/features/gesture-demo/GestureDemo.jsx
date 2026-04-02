import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import GestureCamera from './GestureCamera'
import GestureHUD from './GestureHUD'
import GestureInfoSheet from './GestureInfoSheet'
import GestureNav from './GestureNav'
import ModelStage from './ModelStage'
import { playGestureSound } from './gestureSounds'
import {
  createDetectorModeSmoother,
  getDetectorMode,
  DETECTOR_MODE_STABLE_FRAMES,
  NULL_MODE_ENTER_STABLE_FRAMES,
} from './handPointing'
import { mockArtifacts } from './mockArtifacts'
import { normalizeGestureArtifact } from './gestureArtifactAdapter'
import { useGestureDetector } from './useGestureDetector'

function cloneHandLandmarks(data) {
  if (!data) return null
  return data.map((p) => ({ x: p.x, y: p.y, z: p.z }))
}

/**
 * @param {object[]} [artifactsProp] — browse/API-shaped rows; omitted on `/gesture-demo` uses {@link mockArtifacts}.
 * @param {number} [initialIndex]
 * @param {() => void} [onExit] — if set, top-left control calls this instead of linking home.
 * @param {string} [exitLabel]
 */
export default function GestureDemo({
  artifacts: artifactsProp,
  initialIndex = 0,
  onExit,
  exitLabel = '← Exit Demo',
}) {
  const artifacts = useMemo(() => {
    const source = artifactsProp?.length ? artifactsProp : mockArtifacts
    return source.map((row, i) => normalizeGestureArtifact(row, i))
  }, [artifactsProp])

  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.min(Math.max(0, initialIndex), Math.max(0, (artifactsProp?.length ? artifactsProp : mockArtifacts).length - 1)),
  )
  const [mode, setMode] = useState('VIEWING')
  const [landmarks, setLandmarks] = useState(null)
  const [detectorMode, setDetectorMode] = useState('NONE')
  const landmarksRef = useRef(null)
  const detectorModeRef = useRef('NONE')
  const [hasHand, setHasHand] = useState(false)
  const [zoomSignal, setZoomSignal] = useState(0)
  const [navDirection, setNavDirection] = useState(1)

  const prevModeRef = useRef(mode)
  const prevIndexTipRef = useRef(null)
  /** Last dominant drag quadrant — sound plays when this changes (new direction). */
  const lastDragDirRef = useRef(null)
  const skipFirstIndexSoundRef = useRef(true)
  const infoPanelOpenRef = useRef(false)
  const modeRef = useRef(mode)

  const modeSmoothRef = useRef(null)
  if (!modeSmoothRef.current) {
    modeSmoothRef.current = createDetectorModeSmoother(DETECTOR_MODE_STABLE_FRAMES, {
      enterFramesByMode: { NULL: NULL_MODE_ENTER_STABLE_FRAMES },
    })
  }

  useEffect(() => {
    modeRef.current = mode
    infoPanelOpenRef.current = mode === 'INFO_OPEN'
  }, [mode])

  const { gesture } = useGestureDetector(landmarks, detectorModeRef, infoPanelOpenRef)
  const artifact = useMemo(() => artifacts[currentIndex], [artifacts, currentIndex])
  const preloadUrls = useMemo(() => artifacts.map((item) => item.modelUrl), [artifacts])
  const showArtifactNav = artifacts.length > 1

  useEffect(() => {
    const p = prevModeRef.current
    if (p === 'VIEWING' && mode === 'INFO_OPEN') {
      void playGestureSound('infoOpen')
    }
    if (p === 'INFO_OPEN' && mode === 'VIEWING') {
      void playGestureSound('infoClose')
    }
    prevModeRef.current = mode
  }, [mode])

  useEffect(() => {
    if (skipFirstIndexSoundRef.current) {
      skipFirstIndexSoundRef.current = false
      return
    }
    void playGestureSound('switchItem')
  }, [currentIndex])

  useEffect(() => {
    if (!gesture) return undefined
    if (gesture === 'ZOOM_IN') void playGestureSound('zoomIn')
    if (gesture === 'ZOOM_OUT') void playGestureSound('zoomOut')
    return undefined
  }, [gesture])

  useEffect(() => {
    if (detectorMode !== 'DRAG' || !landmarks || landmarks.length < 21) {
      prevIndexTipRef.current = null
      lastDragDirRef.current = null
      return
    }
    const t = landmarks[8]
    const prev = prevIndexTipRef.current
    prevIndexTipRef.current = { x: t.x, y: t.y }
    if (!prev) return
    const dx = t.x - prev.x
    const dy = t.y - prev.y
    const moved = Math.hypot(dx, dy)
    if (moved < 0.0075) return

    let dir
    if (Math.abs(dx) >= Math.abs(dy)) {
      dir = dx >= 0 ? 'E' : 'W'
    } else {
      dir = dy >= 0 ? 'S' : 'N'
    }
    if (lastDragDirRef.current === dir) return
    lastDragDirRef.current = dir
    void playGestureSound('drag')
  }, [landmarks, detectorMode])

  useEffect(() => {
    if (!gesture) return
    const total = artifacts.length
    const viewing = modeRef.current === 'VIEWING'
    if (gesture === 'NAV_NEXT' && viewing) {
      setNavDirection(1)
      setCurrentIndex((idx) => (idx + 1) % total)
    } else if (gesture === 'NAV_PREV' && viewing) {
      setNavDirection(-1)
      setCurrentIndex((idx) => (idx - 1 + total) % total)
    } else if (gesture === 'INFO_TOGGLE') {
      setMode((m) => {
        const next = m === 'VIEWING' ? 'INFO_OPEN' : 'VIEWING'
        infoPanelOpenRef.current = next === 'INFO_OPEN'
        return next
      })
    } else if (gesture === 'ZOOM_IN') {
      setZoomSignal((v) => (v >= 0 ? v + 1.05 : 1.05))
    } else if (gesture === 'ZOOM_OUT') {
      setZoomSignal((v) => (v <= 0 ? v - 1.05 : -1.05))
    }
  }, [gesture, artifacts.length])

  const goNext = () => {
    setNavDirection(1)
    setCurrentIndex((idx) => (idx + 1) % artifacts.length)
    setMode('VIEWING')
  }

  const goPrev = () => {
    setNavDirection(-1)
    setCurrentIndex((idx) => (idx - 1 + artifacts.length) % artifacts.length)
    setMode('VIEWING')
  }

  const handleLandmarks = useCallback((data, meta) => {
    const snapshot = cloneHandLandmarks(data)
    landmarksRef.current = snapshot

    if (!snapshot || snapshot.length < 21) {
      modeSmoothRef.current?.reset()
      detectorModeRef.current = 'NONE'
      setLandmarks(null)
      setDetectorMode('NONE')
      return
    }

    const rawMode = meta?.detectorMode ?? getDetectorMode(snapshot)
    const stableMode = modeSmoothRef.current(rawMode)
    detectorModeRef.current = stableMode
    setLandmarks(snapshot)
    setDetectorMode(stableMode)
  }, [])

  const handleHasHand = useCallback((value) => {
    setHasHand(value)
  }, [])

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black">
      <GestureCamera
        onLandmarks={handleLandmarks}
        onHasHandChange={handleHasHand}
        captureMode="fast"
      />

      <ModelStage
        modelUrl={artifact.modelUrl}
        modelScale={artifact.modelScale}
        accentColor={artifact.accentColor}
        dimmed={mode === 'INFO_OPEN'}
        zoomSignal={zoomSignal}
        navDirection={navDirection}
        preloadUrls={preloadUrls}
        landmarksRef={landmarksRef}
        detectorModeRef={detectorModeRef}
      />

      <GestureHUD
        currentIndex={currentIndex}
        totalCount={artifacts.length}
        artifactName={artifact.name}
        hasHand={hasHand}
        detectorMode={detectorMode}
      />

      <GestureInfoSheet
        open={mode === 'INFO_OPEN'}
        artifact={artifact}
        onClose={() => setMode('VIEWING')}
      />

      <GestureNav
        onPrev={goPrev}
        onNext={goNext}
        infoOpen={mode === 'INFO_OPEN'}
        showNav={showArtifactNav}
      />

      {onExit ? (
        <button
          type="button"
          onClick={onExit}
          className="fixed left-4 top-4 z-50 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm transition-colors hover:bg-black/75"
        >
          {exitLabel}
        </button>
      ) : (
        <a
          href="/"
          className="fixed left-4 top-4 z-50 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm"
        >
          {exitLabel}
        </a>
      )}
    </div>
  )
}

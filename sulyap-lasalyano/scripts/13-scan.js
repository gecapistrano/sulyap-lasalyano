/**
 * Live Scan page controller — camera + YOLOv8 lock outlines + info sheet.
 * Ported from frontend ARCamera / DetectionOverlay / InfoSheet into vanilla JS for the static site.
 */
import {
  analyzeFrameSignals,
  clampPreviewZoom,
  classifyRdItemsFrame,
  getRdModelClasses,
  mapModelBoxToOverlayPercent,
  PREVIEW_ZOOM_MAX,
  preloadRdScanner,
} from './scan/rd-classifier.js'

const MIN_CANDIDATE_CONFIDENCE = 0.32
const MIN_LOCK_CONFIDENCE = 0.55
const MIN_LOCK_MARGIN = 0.12
const LOCK_HITS = 3
const FAST_LOCK_CONFIDENCE = 0.7
const FAST_LOCK_MARGIN = 0.18
const FAST_LOCK_HITS = 2
const INFERENCE_GAP_MS = 48
const HAND_REJECT_MAX_CONFIDENCE = 0.5
const HANDLIKE_SKIN_RATIO = 0.42
const HANDLIKE_EDGE_DENSITY = 0.08
const TRACK_MISS_TOLERANCE = 4
const LOCKED_MISS_TOLERANCE = 2
const SCAN_TIP_KEYS = ['scan.tip1', 'scan.tip2', 'scan.tip3', 'scan.tip4']

/** English fallbacks for camera overlay copy (resolved via t() on every render / langchange). */
const CAMERA_MSG_FALLBACKS = {
  'scan.denied': 'Please allow camera access to scan artifacts.',
  'scan.notFound': 'No camera was found on this device.',
  'scan.inUse': 'Camera may be in use by another tab. Close other tabs and try again.',
  'scan.failed': 'Camera access failed. Try again.',
  'scan.unsupported': 'Camera is not supported in this browser.',
}

function cameraMsg(key) {
  return t(key, CAMERA_MSG_FALLBACKS[key] || '')
}

function t(key, fallback) {
  if (typeof window.pmLookup === 'function') {
    const looked = window.pmLookup(key)
    if (looked != null) return String(looked)
  }
  const lang = (typeof window.pmLang === 'function' && window.pmLang()) || 'en'
  const dict = (window.T && (window.T[lang] || window.T.en)) || {}
  const v = dict[key] ?? (window.T && window.T.en && window.T.en[key])
  return v != null ? String(v) : (fallback != null ? String(fallback) : key)
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ))
}

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
  if (!knownSet || knownSet.size === 0) return true
  return knownSet.has(className)
}

function computeLocked(track) {
  const conf = Number(track.confidence ?? 0)
  const margin = Number(track.margin ?? 0)
  const hits = Number(track.hits ?? 0)
  if (track.locked) {
    return conf >= MIN_LOCK_CONFIDENCE * 0.85 && hits >= LOCK_HITS - 1
  }
  const fast =
    conf >= FAST_LOCK_CONFIDENCE && margin >= FAST_LOCK_MARGIN && hits >= FAST_LOCK_HITS
  const steady = conf >= MIN_LOCK_CONFIDENCE && margin >= MIN_LOCK_MARGIN && hits >= LOCK_HITS
  return fast || steady
}

function smoothDetectionTracks(prevTracks, rawDetections, knownSet) {
  const incoming = (rawDetections || []).filter(
    (d) =>
      d?.box &&
      isKnownClass(knownSet, d.className) &&
      Number(d.confidence ?? 0) >= MIN_CANDIDATE_CONFIDENCE,
  )
  const matchedPrev = new Set()
  const next = []
  let nextId = prevTracks.reduce((m, tr) => Math.max(m, tr.trackNum || 0), 0) + 1

  for (const det of incoming) {
    let bestIdx = -1
    let bestIoU = 0.28
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

function isMostlyOnScreen(mapped) {
  if (!mapped) return false
  const right = mapped.left + mapped.width
  const bottom = mapped.top + mapped.height
  if (right < 4 || bottom < 4 || mapped.left > 96 || mapped.top > 96) return false
  if (mapped.width < 2 || mapped.height < 2) return false
  return true
}

function apiBaseConfigured() {
  const cfg = window.SL_SCAN_CONFIG || {}
  const base = String(cfg.apiBaseUrl || '').trim().replace(/\/+$/, '')
  if (!base || base.includes('api.example.com')) return ''
  try {
    const u = new URL(base)
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return ''
    }
    return base
  } catch {
    return ''
  }
}

function mapCatalogRow(row) {
  if (!row || typeof row !== 'object') return null
  const idCode = row.id_code || row.rd_code || ''
  return {
    rdCode: idCode,
    name: row.title || idCode,
    owner: row.owner_name || '',
    year: row.year_acquired || row.year || '',
    subtitle: row.subtitle || '',
    description: row.description || '',
  }
}

async function fetchCatalogByCode(rdCode) {
  const base = apiBaseConfigured()
  if (!base || !rdCode) return null
  const url = `${base}/catalog/artifacts/id/${encodeURIComponent(rdCode)}`
  const res = await fetch(url, { credentials: 'omit', mode: 'cors' })
  if (!res.ok) return null
  return mapCatalogRow(await res.json())
}

async function warmCatalogMap(map) {
  const base = apiBaseConfigured()
  if (!base) return
  try {
    const res = await fetch(`${base}/catalog/artifacts`, { credentials: 'omit', mode: 'cors' })
    if (!res.ok) return
    const rows = await res.json()
    if (!Array.isArray(rows)) return
    for (const row of rows) {
      const mapped = mapCatalogRow(row)
      const code = String(mapped?.rdCode || '').trim().toUpperCase()
      if (code && mapped) map.set(code, mapped)
    }
  } catch {
    /* Tap path still tries by id. */
  }
}

function qs(sel, root) {
  return (root || document).querySelector(sel)
}

function setText(el, value) {
  if (el) el.textContent = value == null ? '' : String(value)
}

/** Sparse digital dust stars over the camera (KG atmosphere vibe; pointer-events none). */
function initScanDust(root) {
  const canvas = qs('#scanDust', root)
  if (!canvas) return () => {}
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return () => {}

  const reducedMQ = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced = reducedMQ.matches
  let dpr = 1
  let w = 0
  let h = 0
  let particles = []
  let raf = 0
  let running = false

  function countForSize() {
    const area = w * h
    return Math.max(18, Math.min(48, Math.round(area / 22000)))
  }

  function spawnParticle() {
    const depth = 0.3 + Math.random() * 0.7
    return {
      x: Math.random(),
      y: Math.random(),
      z: depth,
      r: (0.35 + Math.random() * 1.2) * depth,
      a: 0.1 + Math.random() * 0.32 * depth,
      tw: 0.35 + Math.random() * 1.1,
      ph: Math.random() * Math.PI * 2,
      drift: (Math.random() - 0.5) * 0.0001,
      rise: -0.00003 - Math.random() * 0.00006,
    }
  }

  function resize() {
    const rect = root.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    w = Math.max(1, Math.floor(rect.width))
    h = Math.max(1, Math.floor(rect.height))
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const n = reduced ? Math.min(12, countForSize()) : countForSize()
    particles = []
    for (let i = 0; i < n; i += 1) particles.push(spawnParticle())
  }

  function drawFrame(t) {
    ctx.clearRect(0, 0, w, h)
    for (let i = 0; i < particles.length; i += 1) {
      const p = particles[i]
      if (!reduced) {
        p.x += p.drift
        p.y += p.rise
        if (p.y < -0.02) {
          p.y = 1.02
          p.x = Math.random()
        }
        if (p.x < -0.02) p.x = 1.02
        if (p.x > 1.02) p.x = -0.02
      }
      const pulse = 0.55 + 0.45 * Math.sin(t * 0.001 * p.tw + p.ph)
      const alpha = p.a * pulse
      ctx.beginPath()
      ctx.fillStyle = `rgba(232,244,236,${alpha})`
      ctx.arc(p.x * w, p.y * h, p.r, 0, Math.PI * 2)
      ctx.fill()
    }
    /* Static distant pinpoints */
    ctx.fillStyle = 'rgba(201,184,164,0.1)'
    for (let i = 0; i < 10; i += 1) {
      const sx = ((i * 97) % 100) / 100
      const sy = ((i * 53) % 70) / 100
      ctx.fillRect(sx * w, sy * h, 1.1, 1.1)
    }
  }

  function loop(t) {
    if (!running) return
    drawFrame(t || 0)
    raf = requestAnimationFrame(loop)
  }

  function start() {
    if (running) return
    running = true
    raf = requestAnimationFrame(loop)
  }

  function stop() {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
  }

  function onReducedChange() {
    reduced = reducedMQ.matches
    resize()
    if (reduced) {
      drawFrame(performance.now())
      stop()
    } else {
      start()
    }
  }

  function onVis() {
    if (document.hidden) stop()
    else if (!reduced) start()
  }

  resize()
  if (reduced) drawFrame(0)
  else start()

  window.addEventListener('resize', resize, { passive: true })
  reducedMQ.addEventListener('change', onReducedChange)
  document.addEventListener('visibilitychange', onVis)

  return () => {
    stop()
    window.removeEventListener('resize', resize)
    reducedMQ.removeEventListener('change', onReducedChange)
    document.removeEventListener('visibilitychange', onVis)
  }
}

function initScanPage() {
  const root = qs('#liveScan')
  if (!root) return
  initScanDust(root)

  const video = qs('#scanVideo', root)
  const overlay = qs('#scanOverlay', root)
  const viewport = qs('#scanViewport', root)
  const zoomLayer = qs('#scanZoomLayer', root)
  const zoomIndicator = qs('#scanZoomIndicator', root)
  const frameHint = qs('#scanFrameHint', root)
  const tipEl = qs('#scanTip', root)
  const permPanel = qs('#scanPermission', root)
  const permTitle = qs('#scanPermTitle', root)
  const permSub = qs('#scanPermSub', root)
  const permBtn = qs('#scanPermBtn', root)
  const modelStatus = qs('#scanModelStatus', root)
  const infoSheet = qs('#scanInfoSheet', root)
  const infoBackdrop = qs('#scanInfoBackdrop', root)
  const detectBar = qs('#scanDetectBar', root)
  const detectLabel = qs('#scanDetectLabel', root)
  const exitBtn = qs('#scanExitBtn', root)
  const infoPresident = qs('#scanInfoPresident', root)
  const infoName = qs('#scanInfoName', root)
  const infoYear = qs('#scanInfoYear', root)
  const infoDesc = qs('#scanInfoDesc', root)
  const infoHistory = qs('#scanInfoHistory', root)
  const sheetInner = qs('.scan-sheet', infoSheet)

  const state = {
    cameraState: 'requesting',
    /** i18n key for overlay body (re-resolved on langchange); not a frozen string. */
    cameraMessageKey: '',
    mode: 'SCANNING',
    stream: null,
    tracks: [],
    liveDetections: [],
    knownClasses: new Set(),
    catalogByRd: new Map(),
    tipIndex: 0,
    previewZoom: 1,
    useHardwareZoom: false,
    inferenceBusy: false,
    detectTimer: null,
    loopCancelled: false,
    openRequestId: 0,
    cameraRequestId: 0,
    infoLoading: false,
    artifact: null,
    pinch: null,
    modelReady: false,
  }

  /** Soft → softer getUserMedia attempts (rear camera preferred, never exact deviceId). */
  const CAMERA_CONSTRAINTS = [
    { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: { facingMode: { ideal: 'environment' } }, audio: false },
    { video: true, audio: false },
  ]

  const previewZoomRef = { current: 1 }
  const hardwareZoomRef = { current: false }

  function setPreviewZoomLevel(nextZoom) {
    const clamped = clampPreviewZoom(nextZoom)
    previewZoomRef.current = clamped
    state.previewZoom = clamped
    if (!hardwareZoomRef.current) {
      root.style.setProperty('--scan-camera-zoom', String(clamped))
    }
    if (zoomIndicator) {
      const show = state.cameraState === 'granted' && state.mode === 'SCANNING' && clamped > 1.02
      zoomIndicator.hidden = !show
      if (show) zoomIndicator.textContent = `${clamped.toFixed(1)}×`
    }
    if (!hardwareZoomRef.current) return
    const track = state.stream?.getVideoTracks?.()?.[0]
    const caps = track?.getCapabilities?.()
    if (!track || !caps?.zoom) return
    const { min, max } = caps.zoom
    const span = PREVIEW_ZOOM_MAX - 1
    const tZoom = span > 0 ? (clamped - 1) / span : 0
    const deviceZoom = min + tZoom * (max - min)
    track.applyConstraints({ advanced: [{ zoom: deviceZoom }] }).catch(() => {})
  }

  function stopStream() {
    if (state.stream) {
      state.stream.getTracks().forEach((tr) => {
        try { tr.stop() } catch { /* already ended */ }
      })
      state.stream = null
    }
    if (video) {
      try { video.pause() } catch { /* ignore */ }
      video.srcObject = null
    }
  }

  /** Fully release hardware before a new getUserMedia (avoids false NotReadableError). */
  async function releaseCamera() {
    stopInferenceLoop()
    stopStream()
    await new Promise((resolve) => window.setTimeout(resolve, 60))
  }

  async function openCameraWithFallback() {
    let lastErr
    for (let i = 0; i < CAMERA_CONSTRAINTS.length; i += 1) {
      try {
        return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS[i])
      } catch (err) {
        lastErr = err
        const name = err?.name
        if (name === 'NotAllowedError' || name === 'SecurityError') throw err
        /* Soften constraints; brief pause after NotReadable so the driver can settle. */
        if (i < CAMERA_CONSTRAINTS.length - 1) {
          const pauseMs = (name === 'NotReadableError' || name === 'AbortError') ? 120 : 0
          if (pauseMs) await new Promise((resolve) => window.setTimeout(resolve, pauseMs))
        }
      }
    }
    throw lastErr
  }

  function classifyCameraError(err) {
    const name = err?.name || ''
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return { cameraState: 'denied', cameraMessageKey: 'scan.denied' }
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return { cameraState: 'unsupported', cameraMessageKey: 'scan.notFound' }
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return { cameraState: 'idle', cameraMessageKey: 'scan.inUse' }
    }
    /* AbortError is often a superseded/aborted request — not "in use". */
    if (name === 'OverconstrainedError' || name === 'ConstraintNotSatisfiedError') {
      return { cameraState: 'error', cameraMessageKey: 'scan.failed' }
    }
    return { cameraState: 'error', cameraMessageKey: 'scan.failed' }
  }

  function clearDetectionWatchers() {
    state.inferenceBusy = false
    state.tracks = []
    if (state.detectTimer) {
      window.clearTimeout(state.detectTimer)
      state.detectTimer = null
    }
  }

  function renderPermission() {
    const granted = state.cameraState === 'granted'
    if (permPanel) permPanel.hidden = granted
    if (frameHint) frameHint.hidden = !(granted && state.mode === 'SCANNING')
    if (!granted && permTitle && permSub) {
      const msg = state.cameraMessageKey ? cameraMsg(state.cameraMessageKey) : ''
      if (state.cameraState === 'denied') {
        setText(permTitle, t('scan.needAccess', 'Camera access needed'))
        setText(permSub, msg || cameraMsg('scan.denied'))
      } else if (state.cameraState === 'unsupported') {
        setText(permTitle, t('scan.unavailable', 'Camera unavailable'))
        setText(permSub, msg || cameraMsg('scan.unsupported'))
      } else if (state.cameraState === 'requesting') {
        setText(permTitle, t('scan.enableTitle', 'Enable camera to scan'))
        setText(permSub, t('scan.enableHint', 'Tap “Enable Camera” to let your browser access the camera for Live Scan.'))
      } else {
        setText(permTitle, t('scan.enableTitle', 'Enable camera to scan'))
        setText(
          permSub,
          msg || t('scan.enableHint', 'Tap “Enable Camera” to let your browser access the camera for Live Scan.'),
        )
      }
    }
    if (permBtn) {
      const retryStates = state.cameraState === 'idle'
        || state.cameraState === 'error'
        || state.cameraState === 'denied'
      setText(
        permBtn,
        retryStates
          ? t('scan.retryBtn', 'Retry Camera')
          : t('scan.enableBtn', 'Enable Camera'),
      )
      permBtn.disabled = state.cameraState === 'requesting'
    }
  }

  function renderOverlay() {
    if (!overlay || !video) return
    const zoom = hardwareZoomRef.current ? 1 : previewZoomRef.current
    const template = t('scan.detectedLabel', '{code} DETECTED!')
    const hint = t('scan.tapOutline', 'Tap to view')
    const html = state.liveDetections.map((det) => {
      const mapped = mapModelBoxToOverlayPercent(det.box, video, overlay, zoom)
      if (!isMostlyOnScreen(mapped)) return ''
      const code = det.className || 'Item'
      const detectedLine = template.replaceAll('{code}', code)
      const aria = `${detectedLine} ${hint}`
      const key = escapeHtml(det.trackId || det.id || code)
      return (
        `<button type="button" class="scan-outline" data-track="${key}" ` +
        `style="left:${mapped.left}%;top:${mapped.top}%;width:${mapped.width}%;height:${mapped.height}%" ` +
        `aria-label="${escapeHtml(aria)}">` +
        `<span class="scan-outline__ring" aria-hidden="true"></span>` +
        `<span class="scan-outline__corners" aria-hidden="true"><i class="c c-tl"></i><i class="c c-tr"></i><i class="c c-bl"></i><i class="c c-br"></i></span>` +
        `<span class="scan-outline__banner"><span class="scan-outline__code">${escapeHtml(detectedLine)}</span>` +
        `<span class="scan-outline__hint">${escapeHtml(hint)}</span></span></button>`
      )
    }).join('')
    overlay.innerHTML = html
    overlay.querySelectorAll('.scan-outline').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const id = btn.getAttribute('data-track')
        const det = state.liveDetections.find((d) => (d.trackId || d.id) === id)
        if (det) openArtifactFromDetection(det.className, det.confidence)
      })
    })
  }

  function showInfoSheet(artifact, loading) {
    state.artifact = artifact
    state.infoLoading = loading
    state.mode = 'INFO_OPEN'
    if (infoSheet) infoSheet.hidden = false
    if (infoBackdrop) infoBackdrop.hidden = false
    if (detectBar) detectBar.hidden = false
    if (frameHint) frameHint.hidden = true
    if (overlay) overlay.innerHTML = ''
    state.liveDetections = []
    const info = artifact?.artifactInfo || {}
    setText(detectLabel, loading
      ? t('scan.loadingCatalog', 'Loading from catalog…')
      : (artifact?.label || t('scan.title', 'Live Scan')))
    setText(infoPresident, info.president || '')
    setText(infoName, info.name || '')
    setText(infoYear, info.year || '')
    setText(infoDesc, info.description || '')
    setText(infoHistory, info.historical_context || '')
    const histSection = qs('#scanHistorySection', root)
    if (histSection) histSection.hidden = !info.historical_context
    if (sheetInner) {
      sheetInner.style.transition = 'none'
      sheetInner.style.transform = 'translateY(0)'
      void sheetInner.offsetHeight
      sheetInner.style.transition = ''
    }
  }

  function closeInfoSheet() {
    state.openRequestId += 1
    state.infoLoading = false
    state.artifact = null
    state.mode = 'SCANNING'
    if (infoSheet) infoSheet.hidden = true
    if (infoBackdrop) infoBackdrop.hidden = true
    if (detectBar) detectBar.hidden = true
    if (frameHint && state.cameraState === 'granted') frameHint.hidden = false
    startInferenceLoop()
  }

  function applyDetectionRecord(record, prettyConf, rdCode) {
    if (record) {
      const body = record.description || t('scan.noCatalog', 'No published catalog record for this item yet.')
      showInfoSheet({
        label: record.rdCode || rdCode,
        confidence: prettyConf,
        artifactInfo: {
          name: record.name,
          president: record.owner,
          year: record.year,
          description: body,
          historical_context: body,
        },
      }, false)
    } else {
      showInfoSheet({
        label: rdCode || '—',
        confidence: prettyConf,
        artifactInfo: {
          name: rdCode || t('scan.unknownItem', 'Unknown item'),
          president: '',
          year: '',
          description: rdCode
            ? t('scan.noCatalogFor', `No published catalog record for ${rdCode} yet.`).replace('{code}', rdCode)
            : t('scan.noCatalog', 'No published catalog record for this item yet.'),
          historical_context: '',
        },
      }, false)
    }
  }

  async function openArtifactFromDetection(detectedClass, confidence) {
    if (state.mode !== 'SCANNING' || state.infoLoading) return
    const prettyConf = typeof confidence === 'number' ? Math.round(confidence * 100) / 100 : 0
    const rdCode = typeof detectedClass === 'string' ? detectedClass.trim().toUpperCase() : ''
    const reqId = (state.openRequestId += 1)
    stopInferenceLoop()
    showInfoSheet({
      label: rdCode || '—',
      confidence: prettyConf,
      artifactInfo: {
        name: rdCode || '…',
        president: '',
        year: '',
        description: t('scan.loadingCatalogDetails', 'Loading catalog details…'),
        historical_context: '',
      },
    }, true)

    try {
      let mapped = rdCode ? state.catalogByRd.get(rdCode) || null : null
      if (!mapped && rdCode) {
        mapped = await fetchCatalogByCode(rdCode)
        if (mapped) state.catalogByRd.set(rdCode, mapped)
      }
      if (reqId !== state.openRequestId) return
      applyDetectionRecord(mapped, prettyConf, rdCode)
    } catch {
      if (reqId !== state.openRequestId) return
      applyDetectionRecord(null, prettyConf, rdCode)
    }
  }

  async function requestCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      state.cameraState = 'unsupported'
      state.cameraMessageKey = 'scan.unsupported'
      renderPermission()
      return
    }

    const reqId = (state.cameraRequestId += 1)
    state.cameraState = 'requesting'
    state.cameraMessageKey = ''
    renderPermission()

    try {
      await releaseCamera()
      if (reqId !== state.cameraRequestId) return

      const stream = await openCameraWithFallback()
      if (reqId !== state.cameraRequestId) {
        stream.getTracks().forEach((tr) => {
          try { tr.stop() } catch { /* ignore */ }
        })
        return
      }

      state.stream = stream
      const track = stream.getVideoTracks?.()?.[0]
      const caps = track?.getCapabilities?.()
      const hasHardwareZoom = Boolean(caps?.zoom && caps.zoom.max > caps.zoom.min)
      hardwareZoomRef.current = hasHardwareZoom
      state.useHardwareZoom = hasHardwareZoom
      if (!hasHardwareZoom) setPreviewZoomLevel(1)
      if (video) {
        video.srcObject = stream
        video.play().catch(() => {})
      }
      state.cameraState = 'granted'
      state.cameraMessageKey = ''
      renderPermission()
      void warmCatalogMap(state.catalogByRd)
      startInferenceLoop()
    } catch (err) {
      if (reqId !== state.cameraRequestId) return
      stopStream()
      const mapped = classifyCameraError(err)
      state.cameraState = mapped.cameraState
      state.cameraMessageKey = mapped.cameraMessageKey
      renderPermission()
    }
  }

  function stopInferenceLoop() {
    state.loopCancelled = true
    clearDetectionWatchers()
  }

  function startInferenceLoop() {
    stopInferenceLoop()
    state.loopCancelled = false
    state.tracks = []
    state.liveDetections = []
    if (state.cameraState !== 'granted' || state.mode !== 'SCANNING') return

    const scheduleNext = (delayMs = INFERENCE_GAP_MS) => {
      if (state.loopCancelled) return
      if (state.detectTimer) window.clearTimeout(state.detectTimer)
      state.detectTimer = window.setTimeout(() => {
        state.detectTimer = null
        void runInference()
      }, delayMs)
    }

    const runInference = async () => {
      if (state.inferenceBusy || state.loopCancelled) return
      if (!video) {
        scheduleNext()
        return
      }
      state.inferenceBusy = true
      try {
        if (!state.modelReady) {
          scheduleNext(120)
          return
        }
        const pred = await classifyRdItemsFrame(video, {
          zoom: hardwareZoomRef.current ? 1 : previewZoomRef.current,
        })
        if (!pred) {
          state.tracks = smoothDetectionTracks(state.tracks, [], state.knownClasses)
          state.liveDetections = state.tracks.filter((tr) => tr.locked)
          renderOverlay()
          return
        }
        const yoloDetScores = pred.scoreKind === 'yolo-det'
        const topConf = Number(pred.confidence ?? 0)
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
        state.tracks = smoothDetectionTracks(state.tracks, rawBoxes, state.knownClasses)
        state.liveDetections = state.tracks.filter((tr) => tr.locked)
        renderOverlay()
      } catch {
        /* Keep scanning if one frame fails. */
      } finally {
        state.inferenceBusy = false
        scheduleNext()
      }
    }

    void runInference()
  }

  function pinchSpan(touches) {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.hypot(dx, dy)
  }

  /* Bind UI — Retry fully releases then restarts via requestCamera. */
  if (permBtn) {
    permBtn.addEventListener('click', () => {
      void requestCamera()
    })
  }
  if (infoBackdrop) infoBackdrop.addEventListener('click', closeInfoSheet)
  if (exitBtn) exitBtn.addEventListener('click', closeInfoSheet)

  if (zoomLayer) {
    zoomLayer.addEventListener('touchstart', (event) => {
      if (state.cameraState !== 'granted' || state.mode !== 'SCANNING' || event.touches.length < 2) return
      state.pinch = { startSpan: pinchSpan(event.touches), startZoom: previewZoomRef.current }
      event.preventDefault()
    }, { passive: false })
    zoomLayer.addEventListener('touchmove', (event) => {
      const pinch = state.pinch
      if (!pinch || event.touches.length < 2) return
      const span = pinchSpan(event.touches)
      if (!pinch.startSpan || span <= 0) return
      setPreviewZoomLevel(pinch.startZoom * (span / pinch.startSpan))
      event.preventDefault()
    }, { passive: false })
    zoomLayer.addEventListener('touchend', (event) => {
      if (event.touches.length < 2) state.pinch = null
    })
    zoomLayer.addEventListener('wheel', (event) => {
      if (state.cameraState !== 'granted' || state.mode !== 'SCANNING') return
      event.preventDefault()
      setPreviewZoomLevel(previewZoomRef.current * (1 - event.deltaY * 0.0015))
    }, { passive: false })
  }

  /* Drag-to-dismiss sheet */
  if (sheetInner) {
    let drag = null
    const onStart = (clientY) => {
      drag = { startY: clientY, lastDy: 0 }
      sheetInner.style.transition = 'none'
    }
    const onMove = (clientY) => {
      if (!drag) return
      const dy = Math.max(0, clientY - drag.startY)
      drag.lastDy = dy
      sheetInner.style.transform = `translateY(${dy}px)`
    }
    const onEnd = () => {
      if (!drag) return
      const sheetH = sheetInner.getBoundingClientRect().height || 320
      const closeThreshold = Math.max(80, sheetH * 0.25)
      sheetInner.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
      if (drag.lastDy >= closeThreshold) {
        sheetInner.style.transform = 'translateY(100%)'
        window.setTimeout(closeInfoSheet, 320)
      } else {
        sheetInner.style.transform = 'translateY(0)'
      }
      drag = null
    }
    const handle = qs('.scan-sheet__handle', sheetInner)
    const header = qs('.scan-sheet__header', sheetInner)
    ;[handle, header].forEach((el) => {
      if (!el) return
      el.addEventListener('touchstart', (e) => { if (e.touches[0]) onStart(e.touches[0].clientY) }, { passive: true })
      el.addEventListener('touchmove', (e) => { if (e.touches[0]) onMove(e.touches[0].clientY) }, { passive: true })
      el.addEventListener('touchend', onEnd)
      el.addEventListener('mousedown', (e) => {
        onStart(e.clientY)
        const move = (ev) => onMove(ev.clientY)
        const up = () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
          onEnd()
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      })
    })
  }

  window.setInterval(() => {
    if (state.mode !== 'SCANNING' || state.cameraState !== 'granted' || !tipEl) return
    state.tipIndex = (state.tipIndex + 1) % SCAN_TIP_KEYS.length
    const prefix = t('scan.tipPrefix', 'Tip:')
    const tip = t(SCAN_TIP_KEYS[state.tipIndex], '')
    tipEl.textContent = `${prefix} ${tip}`
  }, 3500)

  document.addEventListener('langchange', () => {
    /* Re-resolve permission / camera-error overlay from i18n keys (not frozen strings). */
    renderPermission()
    if (frameHint) setText(frameHint, t('scan.point', 'Point at memorabilia — tap an outline for details'))
    if (tipEl) {
      const prefix = t('scan.tipPrefix', 'Tip:')
      tipEl.textContent = `${prefix} ${t(SCAN_TIP_KEYS[state.tipIndex], '')}`
    }
    renderOverlay()
  })

  if (frameHint) setText(frameHint, t('scan.point', 'Point at memorabilia — tap an outline for details'))
  if (tipEl) tipEl.textContent = `${t('scan.tipPrefix', 'Tip:')} ${t('scan.tip1', '')}`
  if (modelStatus) setText(modelStatus, t('scan.loadingModel', 'Loading model…'))

  void (async () => {
    try {
      await preloadRdScanner()
      const labels = await getRdModelClasses()
      state.knownClasses = new Set(labels)
      state.modelReady = true
      if (modelStatus) {
        modelStatus.hidden = true
        setText(modelStatus, '')
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err || 'unknown error')
      console.error('[Live Scan] model load failed', err)
      if (modelStatus) {
        modelStatus.hidden = false
        const base = t(
          'scan.modelFailed',
          'Could not load the recognition model. Check your connection and reload.',
        )
        // Keep UI short; full reason stays in the console for diagnosis.
        const hint =
          /MIME|text\/plain|serve\.mjs|http\.server/i.test(detail)
            ? ' Wrong server MIME for ORT (.mjs) — run node serve.mjs, not Python http.server.'
            : /HTTP 404|too small|sync-scan-assets/i.test(detail)
              ? ' Model or WASM assets missing — sync with node scripts/sync-scan-assets.mjs.'
              : /global missing|ort\.wasm/i.test(detail)
                ? ' ONNX Runtime script failed to load.'
                : ''
        setText(modelStatus, `${base}${hint}`)
        modelStatus.title = detail
      }
    }
  })()

  renderPermission()
  void requestCamera()

  function teardownCamera() {
    state.cameraRequestId += 1
    stopInferenceLoop()
    stopStream()
  }

  window.addEventListener('pagehide', teardownCamera)
  window.addEventListener('beforeunload', teardownCamera)
  window.addEventListener('pageshow', (event) => {
    /* bfcache restore: tracks were stopped on pagehide — fully release then restart. */
    if (event.persisted) {
      state.cameraState = 'requesting'
      state.cameraMessageKey = ''
      renderPermission()
      void requestCamera()
    }
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScanPage)
} else {
  initScanPage()
}

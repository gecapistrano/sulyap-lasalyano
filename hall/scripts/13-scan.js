/**
 * Live Scan page controller — camera + YOLOv8 lock outlines + info sheet.
 * Ported from frontend ARCamera / DetectionOverlay / InfoSheet into vanilla JS for the static site.
 */
import {
  analyzeModelBoxSignals,
  clampPreviewZoom,
  classifyRdItemsFrame,
  getRdModelClasses,
  mapModelBoxToOverlayPercent,
  MODEL_INPUT_SIZE,
  PREVIEW_ZOOM_MAX,
  preloadRdScanner,
} from './scan/rd-classifier.js?v=4'
import { createModelStage } from './scan/model-stage.js?v=16'
import { catalogModelSrc } from './catalog-models.js?v=2'

const MIN_CANDIDATE_CONFIDENCE = 0.32
const MIN_LOCK_CONFIDENCE = 0.55
const MIN_LOCK_MARGIN = 0.12
const LOCK_HITS = 3
const FAST_LOCK_CONFIDENCE = 0.7
const FAST_LOCK_MARGIN = 0.18
const FAST_LOCK_HITS = 2
const INFERENCE_GAP_MS = 48
const IDLE_GAP_MS = 140
const TRACKING_GAP_MS = 16
const SCENE_CHANGE = 12
const HAND_REJECT_MAX_CONFIDENCE = 0.5
const HANDLIKE_SKIN_RATIO = 0.42
const HANDLIKE_EDGE_DENSITY = 0.08
const TRACK_MISS_TOLERANCE = 3
const LOCKED_MISS_TOLERANCE = 1
const LOCK_HOLD_CONFIDENCE = MIN_LOCK_CONFIDENCE * 0.8
const LOCKED_MATCH_IOU = 0.2
const CANDIDATE_MATCH_IOU = 0.26
const LOCKED_AREA_MIN = 0.28
const LOCKED_AREA_MAX = 2.6
const LOCKED_MAX_CENTER_JUMP = 1.25
const TRACK_TAU_LOCKED_MS = 12
const TRACK_TAU_FREE_MS = 26
const PREDICT_MAX_MS = 240
const VEL_SMOOTH = 0.62
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

const TRANSLATE_LANG = {
  en: 'en',
  fil: 'tl',
  es: 'es',
  fr: 'fr',
  zh: 'zh-CN',
  ko: 'ko',
  ja: 'ja',
}

function currentLang() {
  return (typeof window.pmLang === 'function' && window.pmLang()) || 'en'
}

function hashText(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

function translateCacheKey(target, text) {
  return `sl_tr_${target}_${hashText(text)}`
}

function cachedCatalogTranslation(text) {
  const source = String(text ?? '').trim()
  if (!source) return ''
  const target = TRANSLATE_LANG[currentLang()] || 'en'
  if (target === 'en') return source
  try {
    return sessionStorage.getItem(translateCacheKey(target, source))
  } catch {
    return null
  }
}

async function translateCatalogText(text) {
  const source = String(text ?? '').trim()
  if (!source) return ''
  const target = TRANSLATE_LANG[currentLang()] || 'en'
  if (target === 'en') return source
  const cached = cachedCatalogTranslation(source)
  if (cached) return cached
  const chunk = source.slice(0, 900)
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|${encodeURIComponent(target)}`
  try {
    const res = await fetch(url, { credentials: 'omit' })
    if (!res.ok) return source
    const data = await res.json()
    const translated = data?.responseData?.translatedText
    if (typeof translated !== 'string' || !translated.trim()) return source
    const out = source.length > 900 ? `${translated}…` : translated
    try {
      sessionStorage.setItem(translateCacheKey(target, source), out)
    } catch {
      /* quota */
    }
    return out
  } catch {
    return source
  }
}

async function translateCatalogFields(fields) {
  const unique = [...new Set(fields.filter((s) => typeof s === 'string' && s.trim()))]
  const map = new Map()
  await Promise.all(unique.map(async (s) => {
    map.set(s, await translateCatalogText(s))
  }))
  return fields.map((s) => (s ? (map.get(s) || s) : ''))
}

function localizePresidentName(name) {
  const s = String(name || '').trim()
  if (!s) return s
  const lang = currentLang()
  const rules = {
    es: [[/^Br\.\s+/i, 'Hno. '], [/^Brother\s+/i, 'Hermano ']],
    fr: [[/^Br\.\s+/i, 'F. '], [/^Brother\s+/i, 'Frère ']],
    fil: [[/^Brother\s+/i, 'Kapatid na ']],
    zh: [[/^Br\.\s+/i, '修士 '], [/^Brother\s+/i, '修士 '], [/^Dr\.\s+/i, '博士 ']],
    ko: [[/^Br\.\s+/i, '수사 '], [/^Brother\s+/i, '수사 '], [/^Dr\.\s+/i, '박사 ']],
    ja: [[/^Br\.\s+/i, 'ブラザー '], [/^Brother\s+/i, 'ブラザー '], [/^Dr\.\s+/i, '博士 ']],
  }[lang]
  if (!rules) return s
  for (const [re, rep] of rules) {
    if (re.test(s)) return s.replace(re, rep)
  }
  return s
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

function copyBox(box) {
  return { cx: box.cx, cy: box.cy, w: box.w, h: box.h }
}

function lerpBox(from, to, t) {
  return {
    cx: from.cx + (to.cx - from.cx) * t,
    cy: from.cy + (to.cy - from.cy) * t,
    w: from.w + (to.w - from.w) * t,
    h: from.h + (to.h - from.h) * t,
  }
}

function predictBox(track, now) {
  const age = Math.max(0, Math.min(PREDICT_MAX_MS, now - (track.updatedAt || now)))
  return {
    cx: track.box.cx + (track.vx || 0) * age,
    cy: track.box.cy + (track.vy || 0) * age,
    w: Math.max(4, track.box.w + (track.vw || 0) * age),
    h: Math.max(4, track.box.h + (track.vh || 0) * age),
  }
}

function velocityFromBoxes(prev, next, dt, prevVx, prevVy, prevVw, prevVh) {
  if (!(dt > 8 && dt < 420)) {
    return {
      vx: (prevVx || 0) * 0.82,
      vy: (prevVy || 0) * 0.82,
      vw: (prevVw || 0) * 0.82,
      vh: (prevVh || 0) * 0.82,
    }
  }
  const mix = VEL_SMOOTH
  const keep = 1 - mix
  return {
    vx: (prevVx || 0) * keep + ((next.cx - prev.cx) / dt) * mix,
    vy: (prevVy || 0) * keep + ((next.cy - prev.cy) / dt) * mix,
    vw: (prevVw || 0) * keep + ((next.w - prev.w) / dt) * mix,
    vh: (prevVh || 0) * keep + ((next.h - prev.h) / dt) * mix,
  }
}

function isKnownClass(knownSet, className) {
  if (!knownSet || knownSet.size === 0) return true
  return knownSet.has(className)
}

function computeLocked(track) {
  const conf = Number(track.confidence ?? 0)
  const margin = Number(track.margin ?? 0)
  const hits = Number(track.hits ?? 0)
  if ((track.miss || 0) > 0) return false
  if (track.locked) {
    return conf >= LOCK_HOLD_CONFIDENCE && hits >= LOCK_HITS - 1
  }
  const fast =
    conf >= FAST_LOCK_CONFIDENCE && margin >= FAST_LOCK_MARGIN && hits >= FAST_LOCK_HITS
  const steady = conf >= MIN_LOCK_CONFIDENCE && margin >= MIN_LOCK_MARGIN && hits >= LOCK_HITS
  return fast || steady
}

function boxArea(box) {
  return Math.max(0, Number(box?.w || 0) * Number(box?.h || 0))
}

function boxesFollowSameObject(prev, next, locked) {
  if (!prev || !next) return false
  const a0 = boxArea(prev)
  const a1 = boxArea(next)
  if (!(a0 > 0 && a1 > 0)) return false
  if (locked) {
    const ratio = a1 / a0
    if (ratio < LOCKED_AREA_MIN || ratio > LOCKED_AREA_MAX) return false
    const jump = Math.hypot(prev.cx - next.cx, prev.cy - next.cy)
    const span = Math.max(prev.w, prev.h, next.w, next.h, 8)
    if (jump > span * LOCKED_MAX_CENTER_JUMP) return false
  }
  return true
}

function smoothDetectionTracks(prevTracks, rawDetections, knownSet, now = performance.now()) {
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
    let bestIoU = 0.18
    for (let pass = 0; pass < 2; pass += 1) {
      for (let i = 0; i < prevTracks.length; i += 1) {
        if (matchedPrev.has(i)) continue
        const prev = prevTracks[i]
        if (pass === 0 && prev.className !== det.className) continue
        if (pass === 1 && prev.locked) continue
        const expected = prev.locked ? predictBox(prev, now) : prev.box
        const iou = boxIoU(expected, det.box)
        const minIou = pass === 0
          ? (prev.locked ? LOCKED_MATCH_IOU : CANDIDATE_MATCH_IOU)
          : 0.42
        if (
          iou >= minIou &&
          iou > bestIoU &&
          boxesFollowSameObject(expected, det.box, Boolean(prev.locked) && pass === 0)
        ) {
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
      const follow = prev.locked ? 0.03 : 0.22
      const lead = 1 - follow
      const box = {
        cx: prev.box.cx * follow + det.box.cx * lead,
        cy: prev.box.cy * follow + det.box.cy * lead,
        w: prev.box.w * follow + det.box.w * lead,
        h: prev.box.h * follow + det.box.h * lead,
      }
      const dt = now - (prev.updatedAt || now)
      const vel = velocityFromBoxes(prev.box, box, dt, prev.vx, prev.vy, prev.vw, prev.vh)
      const detConf = Number(det.confidence ?? 0)
      const prevConf = Number(prev.confidence ?? 0)
      const blended = {
        ...det,
        box,
        confidence: sameClass ? detConf * 0.78 + prevConf * 0.22 : detConf,
        margin: sameClass
          ? Number(det.margin ?? 0) * 0.7 + Number(prev.margin ?? 0) * 0.3
          : Number(det.margin ?? 0),
        trackId: prev.trackId,
        trackNum: prev.trackNum,
        hits: sameClass ? prev.hits + 1 : 1,
        miss: 0,
        locked: Boolean(prev.locked) && sameClass,
        display: prev.display || copyBox(box),
        updatedAt: now,
        vx: vel.vx,
        vy: vel.vy,
        vw: vel.vw,
        vh: vel.vh,
      }
      blended.locked = computeLocked(blended)
      const pred = predictBox(blended, performance.now())
      blended.display = prev.display
        ? lerpBox(prev.display, pred, blended.locked ? 0.72 : 0.45)
        : copyBox(pred)
      next.push(blended)
    } else {
      const created = {
        ...det,
        trackId: `t-${nextId}`,
        trackNum: nextId,
        hits: 1,
        miss: 0,
        locked: false,
        display: copyBox(det.box),
        updatedAt: now,
        vx: 0,
        vy: 0,
        vw: 0,
        vh: 0,
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
        vx: (prev.vx || 0) * 0.88,
        vy: (prev.vy || 0) * 0.88,
        vw: (prev.vw || 0) * 0.88,
        vh: (prev.vh || 0) * 0.88,
      })
    }
  }
  return next
}

function visibleOverlayFraction(mapped) {
  if (!mapped) return 0
  const x1 = Math.max(0, mapped.left)
  const y1 = Math.max(0, mapped.top)
  const x2 = Math.min(100, mapped.left + mapped.width)
  const y2 = Math.min(100, mapped.top + mapped.height)
  const vis = Math.max(0, x2 - x1) * Math.max(0, y2 - y1)
  const area = Math.max(1e-6, mapped.width * mapped.height)
  return vis / area
}

function isMostlyOnScreen(mapped) {
  if (!mapped) return false
  if (mapped.width < 2 || mapped.height < 2) return false
  const cx = mapped.left + mapped.width / 2
  const cy = mapped.top + mapped.height / 2
  if (cx < 0 || cx > 100 || cy < 0 || cy > 100) return false
  return visibleOverlayFraction(mapped) >= 0.22
}

function isBoxOnModelScreen(box) {
  if (!box) return false
  const visW = Math.max(0, Math.min(MODEL_INPUT_SIZE, box.cx + box.w / 2) - Math.max(0, box.cx - box.w / 2))
  const visH = Math.max(0, Math.min(MODEL_INPUT_SIZE, box.cy + box.h / 2) - Math.max(0, box.cy - box.h / 2))
  return (visW * visH) / Math.max(1, boxArea(box)) >= 0.22
}

function lockedForOverlay(tracks) {
  return (tracks || []).filter((tr) => tr.locked && !(tr.miss > 0) && isBoxOnModelScreen(tr.display || tr.box))
}

/** Empty prefix = same-origin `/catalog` (serve.mjs proxy or production rewrite). */
function apiPrefix() {
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

function catalogPhotoSrc(idCode, imageUrl) {
  const value = typeof imageUrl === 'string' ? imageUrl.trim() : ''
  if (/^https?:\/\//i.test(value)) return value
  const code = String(idCode || '').trim()
  if (!code) return value
  return `${apiPrefix()}/catalog/artifacts/id/${encodeURIComponent(code)}/photo`
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
    imageUrl: catalogPhotoSrc(idCode, row.image_url || ''),
    modelUrl: catalogModelSrc(row.model_url || '', idCode),
  }
}

async function fetchCatalogByCode(rdCode) {
  if (!rdCode) return null
  const url = `${apiPrefix()}/catalog/artifacts/id/${encodeURIComponent(rdCode)}`
  const res = await fetch(url, { credentials: 'omit', mode: 'cors' })
  if (!res.ok) return null
  return mapCatalogRow(await res.json())
}

async function warmCatalogMap(map) {
  try {
    const res = await fetch(`${apiPrefix()}/catalog/artifacts?limit=2000&sort=id`, {
      credentials: 'omit',
      mode: 'cors',
      cache: 'no-store',
    })
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

function reduceMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Fade catalog copy in place so the loading line does not pop. */
function setFadingText(el, value) {
  if (!el) return
  const next = value == null ? '' : String(value)
  if (el.dataset.fadeValue === next && el.textContent === next) return
  const had = (el.textContent || '').length > 0
  el.dataset.fadeValue = next
  if (!had || reduceMotion()) {
    el.style.transition = ''
    el.style.opacity = ''
    el.textContent = next
    return
  }
  el.style.transition = 'none'
  el.style.opacity = '0'
  el.textContent = next
  void el.offsetWidth
  el.style.transition = 'opacity .18s ease-out'
  el.style.opacity = '1'
}

const DUST_IDLE = { pause() {}, resume() {}, destroy() {} }

/** Sparse digital dust stars over the camera (KG atmosphere vibe; pointer-events none). */
function initScanDust(root) {
  const canvas = qs('#scanDust', root)
  if (!canvas) return DUST_IDLE
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return DUST_IDLE

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

  return {
    pause() {
      stop()
    },
    resume() {
      if (!reduced && !document.hidden) start()
    },
    destroy() {
      stop()
      window.removeEventListener('resize', resize)
      reducedMQ.removeEventListener('change', onReducedChange)
      document.removeEventListener('visibilitychange', onVis)
    },
  }
}

function initScanPage() {
  const root = qs('#liveScan')
  if (!root) return
  const dust = initScanDust(root)
  if (document.body.classList.contains('is-booting')) dust.pause()

  const video = qs('#scanVideo', root)
  const overlay = qs('#scanOverlay', root)
  const viewport = qs('#scanViewport', root)
  const zoomLayer = qs('#scanZoomLayer', root)
  const zoomIndicator = qs('#scanZoomIndicator', root)
  const frameHint = qs('#scanFrameHint', root)
  const monitorEl = qs('#scanMonitor', root)
  const monitorLabel = qs('#scanMonitorLabel', root)
  const tipEl = qs('#scanTip', root)
  const permPanel = qs('#scanPermission', root)
  const permTitle = qs('#scanPermTitle', root)
  const permSub = qs('#scanPermSub', root)
  const permBtn = qs('#scanPermBtn', root)
  const modelStatus = qs('#scanModelStatus', root)
  const bootEl = qs('#scanBoot', root)
  const bootLabel = qs('#scanBootLabel', root)
  const resultEl = qs('#scanResult', root)
  const modelHost = qs('#scanModelStage', root)
  const stageHint = qs('#scanStageHint', root)
  const infoSheet = qs('#scanInfoSheet', root)
  const backHomeBtn = qs('#scanBackHome')
  const titleRest = qs('.scan-title-rest', root)
  const titleCode = qs('.scan-title-code', root)
  const sheetToggle = qs('#scanSheetToggle', root)
  const infoCode = qs('#scanInfoCode', root)
  const infoPresident = qs('#scanInfoPresident', root)
  const infoPhoto = qs('#scanInfoPhoto', root)
  const infoName = qs('#scanInfoName', root)
  const infoYear = qs('#scanInfoYear', root)
  const infoDesc = qs('#scanInfoDesc', root)
  const infoHistory = qs('#scanInfoHistory', root)
  const sheetInner = qs('.scan-sheet', infoSheet)
  const outlineNodes = new Map()
  const overlaySize = { w: 0, h: 0 }
  let modelStage = null
  let presentedKey = ''
  let presentGen = 0
  let leavingResult = false
  let leaveResultT = 0
  let lastTitleCode = ''
  let lastInferAt = 0
  let lastMonitorPaint = 0
  const RESULT_FADE_MS = 320
  const MONITOR_LIVE_MS = 520

  function refreshOverlaySize() {
    if (!overlay) return
    overlaySize.w = overlay.clientWidth
    overlaySize.h = overlay.clientHeight
  }
  refreshOverlaySize()
  if (overlay && typeof ResizeObserver !== 'undefined') {
    const overlayRo = new ResizeObserver(() => refreshOverlaySize())
    overlayRo.observe(overlay)
  }

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
    catalogMiss: new Set(),
    catalogPrefetch: new Set(),
    tipIndex: 0,
    previewZoom: 1,
    useHardwareZoom: false,
    inferenceBusy: false,
    detectTimer: null,
    overlayRaf: null,
    lastOverlayTs: 0,
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

  function stopOverlayLoop() {
    if (state.overlayRaf) {
      window.cancelAnimationFrame(state.overlayRaf)
      state.overlayRaf = null
    }
    state.lastOverlayTs = 0
  }

  function clearDetectionWatchers() {
    state.inferenceBusy = false
    state.tracks = []
    state.liveDetections = []
    stopOverlayLoop()
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
    paintScanMonitor()
  }

  function clearOutlines() {
    outlineNodes.forEach((btn) => {
      window.clearTimeout(btn._leaveT)
      btn.remove()
    })
    outlineNodes.clear()
    if (overlay) overlay.replaceChildren()
  }

  const bootShownAt = performance.now()
  let bootHiding = false
  function hideScanBoot() {
    if (bootHiding) return
    bootHiding = true
    const wait = Math.max(0, 1200 - (performance.now() - bootShownAt))
    window.setTimeout(() => {
      if (typeof window.slFinishLoadbar === 'function') window.slFinishLoadbar(bootEl)
      document.body.classList.remove('is-booting')
      dust.resume()
      if (state.cameraState === 'granted' && state.mode === 'SCANNING') startInferenceLoop()
      if (!bootEl || bootEl.classList.contains('is-done')) return
      bootEl.classList.add('is-done')
      window.setTimeout(() => {
        bootEl.hidden = true
      }, reduceMotion() ? 0 : 560)
    }, reduceMotion() ? 0 : wait)
  }

  function advanceDisplayBoxes(now) {
    const prevTs = state.lastOverlayTs || now
    const dt = Math.min(50, Math.max(0, now - prevTs))
    state.lastOverlayTs = now
    const reduced = reduceMotion()
    for (const tr of state.tracks) {
      if (!tr.box || tr.miss > 0) continue
      const pred = predictBox(tr, now)
      if (!tr.display) {
        tr.display = copyBox(pred)
        continue
      }
      const tau = reduced ? 1 : (tr.locked ? TRACK_TAU_LOCKED_MS : TRACK_TAU_FREE_MS)
      const alpha = 1 - Math.exp(-dt / Math.max(1, tau))
      const jump = Math.hypot(tr.display.cx - pred.cx, tr.display.cy - pred.cy)
      const span = Math.max(pred.w, pred.h, 8)
      tr.display = jump > span * 0.4 ? copyBox(pred) : lerpBox(tr.display, pred, alpha)
    }
  }

  function paintOutlineBox(btn, mapped, hostW, hostH) {
    const x = (mapped.left / 100) * hostW
    const y = (mapped.top / 100) * hostH
    const w = (mapped.width / 100) * hostW
    const h = (mapped.height / 100) * hostH
    btn.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`
    btn.style.width = `${w.toFixed(2)}px`
    btn.style.height = `${h.toFixed(2)}px`
  }

  function renderOverlay() {
    if (!overlay || !video) return
    if (!(overlaySize.w > 0 && overlaySize.h > 0)) refreshOverlaySize()
    const hostW = overlaySize.w
    const hostH = overlaySize.h
    if (!(hostW > 0 && hostH > 0)) return
    const zoom = hardwareZoomRef.current ? 1 : previewZoomRef.current
    const template = t('scan.detectedLabel', '{code} DETECTED!')
    const hint = t('scan.tapOutline', 'Tap to view')
    const seen = new Set()
    const reduce = reduceMotion()
    const sizeHint = { w: hostW, h: hostH }

    for (const det of state.liveDetections) {
      const mapped = mapModelBoxToOverlayPercent(det.display || det.box, video, overlay, zoom, sizeHint)
      const id = String(det.trackId || det.id || '')
      if (!id || !isMostlyOnScreen(mapped)) continue
      seen.add(id)
      let btn = outlineNodes.get(id)
      if (!btn || !btn.isConnected) {
        btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'scan-outline'
        btn.dataset.track = id
        btn.innerHTML = (
          '<span class="scan-outline__ring" aria-hidden="true"></span>' +
          '<span class="scan-outline__corners" aria-hidden="true"><i class="c c-tl"></i><i class="c c-tr"></i><i class="c c-bl"></i><i class="c c-br"></i></span>' +
          '<span class="scan-outline__banner"><span class="scan-outline__code"></span>' +
          '<span class="scan-outline__hint"></span></span>'
        )
        btn.addEventListener('click', (ev) => {
          ev.stopPropagation()
          const track = btn.dataset.track
          const found = state.liveDetections.find((d) => String(d.trackId || d.id) === track)
          if (found) openArtifactFromDetection(found.className, found.confidence)
        })
        overlay.appendChild(btn)
        outlineNodes.set(id, btn)
      }
      if (btn.classList.contains('is-leaving')) {
        window.clearTimeout(btn._leaveT)
        btn._leaveT = 0
        btn.classList.remove('is-leaving')
      }
      paintOutlineBox(btn, mapped, hostW, hostH)
      const code = det.className || 'Item'
      const detectedLine = template.replaceAll('{code}', code)
      btn.setAttribute('aria-label', `${detectedLine} ${hint}`)
      const codeEl = btn.querySelector('.scan-outline__code')
      const hintEl = btn.querySelector('.scan-outline__hint')
      if (codeEl && codeEl.textContent !== detectedLine) codeEl.textContent = detectedLine
      if (hintEl && hintEl.textContent !== hint) hintEl.textContent = hint
    }

    for (const [id, btn] of outlineNodes) {
      if (seen.has(id)) continue
      if (reduce) {
        window.clearTimeout(btn._leaveT)
        btn.remove()
        outlineNodes.delete(id)
        continue
      }
      if (btn.classList.contains('is-leaving')) continue
      btn.classList.add('is-leaving')
      const remove = (e) => {
        if (e && e.target !== btn) return
        if (!btn.classList.contains('is-leaving')) return
        btn.removeEventListener('transitionend', remove)
        window.clearTimeout(btn._leaveT)
        btn._leaveT = 0
        btn.remove()
        if (outlineNodes.get(id) === btn) outlineNodes.delete(id)
      }
      btn.addEventListener('transitionend', remove)
      btn._leaveT = window.setTimeout(remove, 200)
    }
  }

  function peekHeight() {
    if (!sheetInner) return 102
    const raw = getComputedStyle(sheetInner).getPropertyValue('--sheet-peek')
    const parsed = parseFloat(raw)
    return Number.isFinite(parsed) ? parsed * (raw.includes('rem') ? 16 : 1) : 102
  }

  function openHeight() {
    if (!sheetInner) return Math.round(window.innerHeight * 0.72)
    const raw = getComputedStyle(sheetInner).getPropertyValue('--sheet-open').trim()
    const probe = document.createElement('div')
    probe.style.cssText = `position:absolute;visibility:hidden;height:${raw || '72dvh'}`
    document.body.appendChild(probe)
    const h = probe.getBoundingClientRect().height
    probe.remove()
    return h || Math.round(window.innerHeight * 0.72)
  }

  function setSheetHeight(px, dragging) {
    if (!sheetInner) return
    if (dragging) sheetInner.classList.add('is-dragging')
    else sheetInner.classList.remove('is-dragging')
    if (px == null) {
      sheetInner.style.removeProperty('--sheet-h')
      return
    }
    sheetInner.style.setProperty('--sheet-h', `${Math.round(px)}px`)
  }

  function syncSheetToggle(expanded) {
    if (!sheetToggle) return
    sheetToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false')
    sheetToggle.setAttribute(
      'aria-label',
      expanded
        ? t('scan.collapseDetails', 'Hide details')
        : t('scan.expandDetails', 'Show details'),
    )
    sheetToggle.setAttribute(
      'data-i-label',
      expanded ? 'scan.collapseDetails' : 'scan.expandDetails',
    )
  }

  let copyGen = 0
  function isUiCopy(value, code) {
    const s = String(value || '').trim()
    if (!s) return true
    const samples = [
      t('scan.loadingCatalogDetails', 'Loading catalog details…'),
      t('scan.unknownItem', 'Unknown item'),
      t('scan.noCatalog', 'No published catalog record for this item yet.'),
      t('scan.translating', 'Translating…'),
    ]
    if (samples.includes(s)) return true
    const forTpl = t('scan.noCatalogFor', 'No published catalog record for {code} yet.')
    if (forTpl.includes('{code}') && s === forTpl.replaceAll('{code}', code || '')) return true
    return false
  }

  async function fillResultCopy(artifact, loading) {
    const gen = (copyGen += 1)
    const info = artifact?.artifactInfo || {}
    const code = artifact?.label || info.code || ''
    const rawTitle = loading
      ? t('scan.loadingCatalogDetails', 'Loading catalog details…')
      : (info.name || info.subtitle || code || t('scan.unknownItem', 'Unknown item'))
    const rawPres = loading ? '' : (info.president || '')
    const rawDesc = loading ? '' : (info.description || '')
    const rawHist = loading ? '' : (info.historical_context || '')
    const lang = currentLang()
    const canTranslate = lang !== 'en' && !loading
    const wait = t('scan.translating', 'Translating…')

    const paint = (title, president, desc, hist) => {
      if (gen !== copyGen) return
      setText(infoCode, code)
      setText(infoName, title)
      setText(infoPresident, localizePresidentName(president))
      setText(infoYear, info.year || '')
      if (infoPhoto) {
        const photo = typeof info.image_url === 'string' ? info.image_url.trim() : ''
        if (photo) {
          infoPhoto.hidden = false
          infoPhoto.alt = title || info.name || ''
          infoPhoto.src = photo
        } else {
          infoPhoto.hidden = true
          infoPhoto.removeAttribute('src')
        }
      }
      setFadingText(infoDesc, desc)
      setFadingText(infoHistory, hist)
      const histSection = qs('#scanHistorySection', root)
      if (histSection) histSection.hidden = !hist
    }

    if (!canTranslate) {
      paint(rawTitle, rawPres, rawDesc, rawHist)
      return
    }

    const fields = [rawTitle, rawPres, rawDesc, rawHist]
    const cached = fields.map((s) => {
      if (!s || isUiCopy(s, code)) return s
      return cachedCatalogTranslation(s)
    })
    const missing = fields.some((s, i) => s && !isUiCopy(s, code) && !cached[i])
    paint(
      missing && !isUiCopy(rawTitle, code) && !cached[0] ? wait : (cached[0] || rawTitle),
      missing && rawPres && !cached[1] ? wait : (cached[1] || rawPres),
      missing && rawDesc && !cached[2] ? wait : (cached[2] || rawDesc),
      missing && rawHist && !cached[3] ? wait : (cached[3] || rawHist),
    )
    if (!missing) return

    const toFetch = fields.map((s) => (s && !isUiCopy(s, code) ? s : ''))
    const translated = await translateCatalogFields(toFetch)
    if (gen !== copyGen) return
    paint(
      translated[0] || rawTitle,
      translated[1] || rawPres,
      translated[2] || rawDesc,
      translated[3] || rawHist,
    )
  }

  function itemCode() {
    const info = state.artifact?.artifactInfo || {}
    return String(state.artifact?.label || info.code || '').trim()
  }

  function syncResultChrome() {
    const viewing = state.mode === 'VIEWING' || state.mode === 'INFO_OPEN' || leavingResult
    const liveCode = itemCode()
    if (liveCode) lastTitleCode = liveCode
    const code = liveCode || (leavingResult ? lastTitleCode : '')
    if (backHomeBtn) {
      backHomeBtn.setAttribute(
        'aria-label',
        viewing
          ? t('scan.exit', 'Back to live scan')
          : t('scan.backHome', 'Back to home'),
      )
      backHomeBtn.setAttribute('data-i-label', viewing ? 'scan.exit' : 'scan.backHome')
    }
    if (titleRest) titleRest.setAttribute('aria-hidden', viewing ? 'true' : 'false')
    if (titleCode) {
      titleCode.textContent = code ? `- ${code}` : ''
      titleCode.setAttribute('aria-hidden', viewing ? 'false' : 'true')
    }
  }

  function ensureModelStage() {
    if (modelStage || !modelHost) return modelStage
    modelStage = createModelStage(modelHost)
    return modelStage
  }

  function setStageHint(text) {
    if (!stageHint) return
    const next = text == null ? '' : String(text)
    if (!next) {
      stageHint.hidden = true
      setText(stageHint, '')
      return
    }
    setText(stageHint, next)
    stageHint.hidden = false
  }

  async function presentModel(info) {
    const stage = ensureModelStage()
    if (!stage) return
    const modelUrl = typeof info?.model_url === 'string' ? info.model_url.trim() : ''
    const key = modelUrl
    if (key && key === presentedKey) return
    const gen = (presentGen += 1)
    presentedKey = key
    if (!modelUrl) {
      await stage.show({})
      if (gen !== presentGen) return
      setStageHint(state.infoLoading ? t('scan.loadingModel', 'Loading model…') : '')
      return
    }
    setStageHint(t('scan.loadingModel', 'Loading model…'))
    await stage.show({
      modelUrl,
      onProgress(frac) {
        if (gen !== presentGen) return
        const pct = Math.round(Math.max(0, Math.min(1, Number(frac) || 0)) * 100)
        setStageHint(`${t('scan.loadingModel', 'Loading model…')} ${pct}%`)
      },
    })
    if (gen !== presentGen) return
    setStageHint('')
  }

  function expandSheet() {
    if (state.mode !== 'VIEWING' && state.mode !== 'INFO_OPEN') return
    state.mode = 'INFO_OPEN'
    if (root) root.classList.add('is-sheet-open')
    setSheetHeight(openHeight(), false)
    syncSheetToggle(true)
    if (modelStage) modelStage.setExpanded(true)
  }

  function collapseSheet() {
    if (state.mode !== 'INFO_OPEN' && state.mode !== 'VIEWING') return
    state.mode = 'VIEWING'
    if (root) root.classList.remove('is-sheet-open')
    setSheetHeight(null, false)
    syncSheetToggle(false)
    if (modelStage) modelStage.setExpanded(false)
  }

  function showResultView(artifact, loading) {
    const opening = state.mode === 'SCANNING' || leavingResult
    if (leaveResultT) {
      window.clearTimeout(leaveResultT)
      leaveResultT = 0
    }
    leavingResult = false
    state.artifact = artifact
    state.infoLoading = loading
    state.mode = 'VIEWING'
    if (root) {
      root.classList.remove('is-leaving-result')
      root.classList.remove('is-sheet-open')
    }
    if (resultEl) resultEl.hidden = false
    if (infoSheet) infoSheet.hidden = false
    if (frameHint) frameHint.hidden = true
    if (video) video.pause()
    clearOutlines()
    state.liveDetections = []
    fillResultCopy(artifact, loading)
    syncResultChrome()
    paintScanMonitor()
    setSheetHeight(null, false)
    syncSheetToggle(false)
    const reveal = () => {
      if (root) root.classList.add('is-result')
    }
    if (reduceMotion() || !opening) reveal()
    else {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(reveal)
      })
    }
    const stage = ensureModelStage()
    if (opening && stage) {
      presentModel(artifact?.artifactInfo || {})
      stage.setExpanded(false)
      stage.resize()
    } else if (stage && !loading) {
      presentModel(artifact?.artifactInfo || {})
    }
  }

  function finishLeaveResult() {
    leaveResultT = 0
    leavingResult = false
    if (root) {
      root.classList.remove('is-result')
      root.classList.remove('is-sheet-open')
      root.classList.remove('is-leaving-result')
    }
    syncResultChrome()
    paintScanMonitor()
    if (resultEl) resultEl.hidden = true
    if (infoSheet) infoSheet.hidden = true
    if (modelStage) {
      modelStage.dispose()
      modelStage = null
    }
    startInferenceLoop()
  }

  function closeResult() {
    if (state.mode === 'SCANNING' || leavingResult) return
    leavingResult = true
    state.openRequestId += 1
    state.infoLoading = false
    if (!lastTitleCode) lastTitleCode = itemCode()
    state.artifact = null
    state.mode = 'SCANNING'
    syncResultChrome()
    presentedKey = ''
    presentGen += 1
    setStageHint('')
    if (frameHint && state.cameraState === 'granted') frameHint.hidden = false
    setSheetHeight(null, false)
    syncSheetToggle(false)
    if (video && state.stream) video.play().catch(() => {})
    if (reduceMotion() || !root) {
      finishLeaveResult()
      return
    }
    root.classList.add('is-leaving-result')
    root.classList.remove('is-result')
    root.classList.remove('is-sheet-open')
    leaveResultT = window.setTimeout(finishLeaveResult, RESULT_FADE_MS)
  }

  function applyDetectionRecord(record, prettyConf, rdCode) {
    const payload = record
      ? {
          label: record.rdCode || rdCode,
          confidence: prettyConf,
          artifactInfo: {
            name: record.name,
            subtitle: record.subtitle || '',
            president: record.owner,
            year: record.year,
            description: record.description || t('scan.noCatalog', 'No published catalog record for this item yet.'),
            historical_context: record.description || '',
            image_url: record.imageUrl || '',
            model_url: record.modelUrl || '',
          },
        }
      : {
          label: rdCode || '—',
          confidence: prettyConf,
          artifactInfo: {
            name: rdCode || t('scan.unknownItem', 'Unknown item'),
            subtitle: '',
            president: '',
            year: '',
            description: rdCode
              ? t('scan.noCatalogFor', `No published catalog record for ${rdCode} yet.`).replace('{code}', rdCode)
              : t('scan.noCatalog', 'No published catalog record for this item yet.'),
            historical_context: '',
            image_url: '',
            model_url: '',
          },
        }
    state.artifact = payload
    state.infoLoading = false
    fillResultCopy(payload, false)
    presentModel(payload.artifactInfo || {})
  }

  async function openArtifactFromDetection(detectedClass, confidence) {
    if (state.mode !== 'SCANNING' || state.infoLoading) return
    const prettyConf = typeof confidence === 'number' ? Math.round(confidence * 100) / 100 : 0
    const rdCode = typeof detectedClass === 'string' ? detectedClass.trim().toUpperCase() : ''
    const reqId = (state.openRequestId += 1)
    const cached = rdCode ? state.catalogByRd.get(rdCode) || null : null
    stopInferenceLoop()
    showResultView({
      label: rdCode || '—',
      confidence: prettyConf,
      artifactInfo: {
        name: cached?.name || rdCode || '…',
        subtitle: cached?.subtitle || '',
        president: cached?.owner || '',
        year: cached?.year || '',
        description: cached
          ? (cached.description || '')
          : t('scan.loadingCatalogDetails', 'Loading catalog details…'),
        historical_context: cached?.description || '',
        image_url: cached?.imageUrl || '',
        model_url: cached?.modelUrl || '',
      },
    }, !cached)

    try {
      let mapped = cached
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
    paintScanMonitor()
  }

  function scanMonitorPhase() {
    if (state.mode !== 'SCANNING' || state.cameraState !== 'granted') return 'off'
    if (modelStatus && !modelStatus.hidden && modelStatus.textContent) return 'off'
    if (!state.modelReady) return 'warming'
    const tracks = state.tracks || []
    const locked = tracks.find((tr) => tr.locked && !(tr.miss > 0))
    if (locked) return 'found'
    if (tracks.some((tr) => (tr.hits || 0) > 0 && !(tr.miss > 1))) return 'checking'
    return 'scanning'
  }

  function paintScanMonitor() {
    if (!monitorEl || !monitorLabel) return
    const phase = scanMonitorPhase()
    if (phase === 'off') {
      if (!monitorEl.hidden) monitorEl.hidden = true
      monitorEl.classList.remove('is-live', 'is-found')
      return
    }
    if (monitorEl.hidden) monitorEl.hidden = false
    const locked = (state.tracks || []).find((tr) => tr.locked && !(tr.miss > 0))
    const code = String(locked?.className || '').trim().toUpperCase()
    let next = t('scan.scanning', 'scanning…')
    if (phase === 'warming') next = t('scan.monitor.warming', 'starting…')
    else if (phase === 'checking') next = t('scan.monitor.checking', 'checking…')
    else if (phase === 'found') {
      next = t('scan.monitor.found', 'found {code}').replace('{code}', code || '—')
    }
    if (monitorLabel.textContent !== next) monitorLabel.textContent = next
    const live = state.inferenceBusy || (performance.now() - lastInferAt < MONITOR_LIVE_MS)
    monitorEl.classList.toggle('is-live', live && phase !== 'found')
    monitorEl.classList.toggle('is-found', phase === 'found')
  }

  const motionCanvas = document.createElement('canvas')
  motionCanvas.width = 32
  motionCanvas.height = 24
  let lastMotionSample = null

  function sceneMotion(videoEl) {
    if (!videoEl || videoEl.readyState < 2) return 255
    const ctx = motionCanvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return 255
    ctx.drawImage(videoEl, 0, 0, 32, 24)
    const data = ctx.getImageData(0, 0, 32, 24).data
    const luma = new Uint8Array(32 * 24)
    for (let i = 0; i < luma.length; i += 1) {
      const j = i * 4
      luma[i] = (data[j] + data[j + 1] + data[j + 2]) / 3
    }
    if (!lastMotionSample) {
      lastMotionSample = luma
      return 255
    }
    let acc = 0
    for (let i = 0; i < luma.length; i += 1) acc += Math.abs(luma[i] - lastMotionSample[i])
    lastMotionSample = luma
    return acc / luma.length
  }

  function nextInferenceGap(videoEl, locked) {
    if (locked) return TRACKING_GAP_MS
    const motion = sceneMotion(videoEl)
    if (motion > SCENE_CHANGE) return INFERENCE_GAP_MS
    return IDLE_GAP_MS
  }

  function boxLooksLikeHand(det) {
    if (!det?.box || Number(det.confidence ?? 0) >= HAND_REJECT_MAX_CONFIDENCE) return false
    const signals = analyzeModelBoxSignals(det.box)
    return Boolean(
      signals &&
      signals.skinRatio >= HANDLIKE_SKIN_RATIO &&
      signals.edgeDensity <= HANDLIKE_EDGE_DENSITY,
    )
  }

  /** Close-up face or upper body. Busy backgrounds still count if the face window is skin. */
  function boxLooksLikeViewer(det) {
    const box = det?.box
    if (!box) return false
    const side = MODEL_INPUT_SIZE
    const areaFrac = (box.w * box.h) / (side * side)
    const large = areaFrac >= 0.22 || (box.w > side * 0.55 && box.h > side * 0.45)
    if (!large) return false
    const face = analyzeModelBoxSignals(box, 'upper-center')
    return Boolean(face && face.skinRatio >= 0.36)
  }

  function prefetchLockedCatalog() {
    for (const tr of state.tracks) {
      if (!tr.locked) continue
      const code = String(tr.className || '').trim().toUpperCase()
      if (!code || state.catalogByRd.has(code) || state.catalogMiss.has(code) || state.catalogPrefetch.has(code)) continue
      state.catalogPrefetch.add(code)
      fetchCatalogByCode(code).then((mapped) => {
        if (mapped) state.catalogByRd.set(code, mapped)
        else state.catalogMiss.add(code)
      }).catch(() => {
        /* Tap still looks the code up. A down API should not retry every frame. */
        state.catalogMiss.add(code)
      }).finally(() => {
        state.catalogPrefetch.delete(code)
      })
    }
  }

  function startInferenceLoop() {
    if (document.body.classList.contains('is-booting')) return
    stopInferenceLoop()
    state.loopCancelled = false
    state.tracks = []
    state.liveDetections = []
    lastMotionSample = null
    if (state.cameraState !== 'granted' || state.mode !== 'SCANNING') return

    const scheduleNext = (delayMs = INFERENCE_GAP_MS) => {
      if (state.loopCancelled) return
      if (state.detectTimer) window.clearTimeout(state.detectTimer)
      state.detectTimer = window.setTimeout(() => {
        state.detectTimer = null
        void runInference()
      }, delayMs)
    }

    const tickOverlay = (now) => {
      if (state.loopCancelled) {
        state.overlayRaf = null
        return
      }
      state.overlayRaf = window.requestAnimationFrame(tickOverlay)
      if (state.mode !== 'SCANNING') return
      advanceDisplayBoxes(now)
      renderOverlay()
      if (now - lastMonitorPaint > 160) {
        lastMonitorPaint = now
        paintScanMonitor()
      }
    }
    state.overlayRaf = window.requestAnimationFrame(tickOverlay)

    const runInference = async () => {
      if (state.inferenceBusy || state.loopCancelled) return
      if (!video) {
        scheduleNext()
        return
      }
      state.inferenceBusy = true
      let nextDelay = INFERENCE_GAP_MS
      let pausedDust = false
      try {
        if (!state.modelReady) {
          nextDelay = 120
          return
        }
        dust.pause()
        pausedDust = true
        const capturedAt = performance.now()
        const pred = await classifyRdItemsFrame(video, {
          zoom: hardwareZoomRef.current ? 1 : previewZoomRef.current,
        })
        if (!pred) {
          state.tracks = smoothDetectionTracks(state.tracks, [], state.knownClasses, capturedAt)
          state.liveDetections = lockedForOverlay(state.tracks)
          nextDelay = nextInferenceGap(video, state.liveDetections.length > 0)
          return
        }
        const rawBoxes = (pred.detections || []).filter((det) => !boxLooksLikeHand(det) && !boxLooksLikeViewer(det))
        state.tracks = smoothDetectionTracks(state.tracks, rawBoxes, state.knownClasses, capturedAt)
        state.liveDetections = lockedForOverlay(state.tracks)
        prefetchLockedCatalog()
        nextDelay = nextInferenceGap(video, state.liveDetections.length > 0)
      } catch {
        /* Keep scanning if one frame fails. */
      } finally {
        if (pausedDust) dust.resume()
        state.inferenceBusy = false
        lastInferAt = performance.now()
        paintScanMonitor()
        scheduleNext(nextDelay)
      }
    }

    lastInferAt = performance.now()
    void runInference()
    paintScanMonitor()
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
  if (backHomeBtn) {
    backHomeBtn.addEventListener('click', (e) => {
      if (state.mode !== 'VIEWING' && state.mode !== 'INFO_OPEN') return
      e.preventDefault()
      e.stopImmediatePropagation()
      closeResult()
    }, true)
  }
  if (sheetToggle) {
    sheetToggle.addEventListener('click', (e) => {
      if (e.detail) return
      if (state.mode === 'INFO_OPEN') collapseSheet()
      else if (state.mode === 'VIEWING') expandSheet()
    })
  }

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

  /* Pull the peek bar up to open details; pull down to return to the 3D view. */
  if (sheetInner) {
    let drag = null
    const peekEl = qs('.scan-sheet__peek', sheetInner)
    const onStart = (clientY) => {
      if (state.mode !== 'VIEWING' && state.mode !== 'INFO_OPEN') return
      drag = {
        startY: clientY,
        lastY: clientY,
        fromOpen: state.mode === 'INFO_OPEN',
        peek: peekHeight(),
        open: openHeight(),
        moved: 0,
      }
      const current = drag.fromOpen ? drag.open : drag.peek
      setSheetHeight(current, true)
    }
    const onMove = (clientY) => {
      if (!drag) return
      const dy = clientY - drag.startY
      drag.moved = Math.max(drag.moved, Math.abs(dy))
      drag.lastY = clientY
      const minH = drag.peek
      const maxH = drag.open
      const base = drag.fromOpen ? maxH : minH
      const next = Math.min(maxH, Math.max(minH, base - dy))
      setSheetHeight(next, true)
    }
    const onEnd = () => {
      if (!drag) return
      const info = drag
      drag = null
      const current = parseFloat(sheetInner.style.getPropertyValue('--sheet-h')) || (info.fromOpen ? info.open : info.peek)
      const span = Math.max(80, info.open - info.peek)
      const progress = (current - info.peek) / span
      const tap = info.moved < 12
      if (tap) {
        setSheetHeight(null, false)
        if (info.fromOpen) collapseSheet()
        else expandSheet()
        return
      }
      if (progress >= 0.42) expandSheet()
      else collapseSheet()
    }
    ;[sheetToggle, peekEl].forEach((el) => {
      if (!el) return
      el.addEventListener('touchstart', (e) => { if (e.touches[0]) onStart(e.touches[0].clientY) }, { passive: true })
      el.addEventListener('touchmove', (e) => { if (e.touches[0]) onMove(e.touches[0].clientY) }, { passive: true })
      el.addEventListener('touchend', (e) => { e.preventDefault(); onEnd() })
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

  function paintTip(index) {
    if (!tipEl) return
    const prefix = t('scan.tipPrefix', 'Tip:')
    const next = `${prefix} ${t(SCAN_TIP_KEYS[index] || 'scan.tip1', '')}`
    const changed = tipEl.textContent !== next
    tipEl.textContent = next
    if (!changed || reduceMotion()) return
    tipEl.style.animation = 'none'
    void tipEl.offsetWidth
    tipEl.style.animation = ''
  }

  window.setInterval(() => {
    if (state.mode !== 'SCANNING' || state.cameraState !== 'granted' || !tipEl) return
    state.tipIndex = (state.tipIndex + 1) % SCAN_TIP_KEYS.length
    paintTip(state.tipIndex)
  }, 3500)

  document.addEventListener('langchange', () => {
    /* Re-resolve permission / camera-error overlay from i18n keys (not frozen strings). */
    renderPermission()
    if (frameHint) setText(frameHint, t('scan.point', 'Point at memorabilia — tap an outline for details'))
    if (bootLabel) setText(bootLabel, t('scan.loadingScanner', 'Loading live scanner'))
    if (modelHost) {
      modelHost.setAttribute('aria-label', t('scan.viewer', 'Artifact 3D view. Drag to rotate, pinch to zoom.'))
    }
    syncResultChrome()
    if (state.mode === 'VIEWING' || state.mode === 'INFO_OPEN') {
      fillResultCopy(state.artifact, state.infoLoading)
    }
    syncSheetToggle(state.mode === 'INFO_OPEN')
    paintTip(state.tipIndex)
    paintScanMonitor()
    renderOverlay()
  })

  if (frameHint) setText(frameHint, t('scan.point', 'Point at memorabilia — tap an outline for details'))
  if (bootLabel) setText(bootLabel, t('scan.loadingScanner', 'Loading live scanner'))
  paintTip(state.tipIndex)

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
      hideScanBoot()
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err || 'unknown error')
      console.error('[Live Scan] model load failed', err)
      hideScanBoot()
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
  document.addEventListener('sl-scan-preview', (event) => {
    const code = event?.detail?.code
    if (code) void openArtifactFromDetection(String(code), 0.99)
  })

  function teardownCamera() {
    state.cameraRequestId += 1
    if (leaveResultT) {
      window.clearTimeout(leaveResultT)
      leaveResultT = 0
    }
    leavingResult = false
    stopInferenceLoop()
    stopStream()
    if (modelStage) {
      modelStage.dispose()
      modelStage = null
    }
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

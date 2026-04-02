/**
 * Plays optional MP3s from /sounds/gesture-demo/ when present; otherwise Web Audio synth fallbacks.
 * See public/sounds/gesture-demo/README.md for Pixabay sources.
 */

const BASE = '/sounds/gesture-demo'

const URLS = {
  /** Brighter swish while orbiting / dragging (same lighter asset as before if you only add one file). */
  drag: `${BASE}/zoom-in-swoosh.mp3`,
  /** Deeper-pitched swoosh — optional MP3s; missing files use synth fallbacks below. */
  zoomIn: `${BASE}/zoom-in-deep-swoosh.mp3`,
  zoomOut: `${BASE}/zoom-out-deep-swoosh.mp3`,
  switchItem: `${BASE}/switch-item-transition.mp3`,
  infoOpen: `${BASE}/info-open-confirm.mp3`,
  infoClose: `${BASE}/info-close-error.mp3`,
}

/**
 * HTMLAudioElement volume by kind (0–1). Values are ~50% louder than prior mix; capped at 1.
 * Info toggles stay a bit quieter than zoom/swish so they don’t overpower.
 */
const MP3_VOLUME = {
  zoomIn: 1,
  zoomOut: 1,
  drag: 1,
  switchItem: 1,
  infoOpen: 0.57,
  infoClose: 0.57,
}

/** Multiply synth output vs previous baseline (~+50% perceived). */
const SYNTH_GAIN_MULT = 1.5

let audioCtx

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return null
    audioCtx = new Ctx()
  }
  return audioCtx
}

function resumeCtx() {
  const ctx = getCtx()
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }
}

function playMp3(url, volume) {
  return new Promise((resolve, reject) => {
    const a = new Audio(url)
    a.volume = volume
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      resolve()
    }
    a.addEventListener('ended', finish, { once: true })
    a.addEventListener(
      'error',
      () => {
        if (settled) return
        settled = true
        reject(new Error('mp3 load failed'))
      },
      { once: true },
    )
    a.play().catch(() => {
      if (settled) return
      settled = true
      reject(new Error('play blocked'))
    })
  })
}

/**
 * Band-passed noise with an exponential frequency sweep — “swoosh” timbre.
 * Lower fStart/fEnd = deeper pitch vs the bright drag variant.
 */
function synthSwooshNoise({
  durationMs,
  fStart,
  fEnd,
  peak = 0.22,
  attackMs = 28,
  q = 1.12,
}) {
  const ctx = getCtx()
  if (!ctx) return
  const sr = ctx.sampleRate
  const n = Math.floor((sr * durationMs) / 1000)
  const buf = ctx.createBuffer(1, n, sr)
  const data = buf.getChannelData(0)
  for (let i = 0; i < n; i++) {
    const t = i / n
    const window = Math.sin(Math.PI * t) ** 1.15
    data[i] = (Math.random() * 2 - 1) * window
  }
  const src = ctx.createBufferSource()
  src.buffer = buf
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = q
  const t0 = ctx.currentTime
  const f0 = Math.max(40, fStart)
  const f1 = Math.max(40, fEnd)
  bp.frequency.setValueAtTime(f0, t0)
  bp.frequency.exponentialRampToValueAtTime(f1, t0 + durationMs / 1000)
  const g = ctx.createGain()
  const p = peak * SYNTH_GAIN_MULT
  g.gain.setValueAtTime(0.0008, t0)
  g.gain.linearRampToValueAtTime(p, t0 + attackMs / 1000)
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + durationMs / 1000)
  src.connect(bp)
  bp.connect(g)
  g.connect(ctx.destination)
  src.start(t0)
  src.stop(t0 + durationMs / 1000)
}

/** Drag / orbit: brighter, quick swipe. */
function synthDragSwish() {
  synthSwooshNoise({
    durationMs: 145,
    fStart: 3400,
    fEnd: 380,
    peak: 0.22,
    q: 1.15,
  })
}

/** Zoom in: deeper-pitched swoosh, filter sweeps upward (in / open). */
function synthZoomInDeepSwoosh() {
  synthSwooshNoise({
    durationMs: 178,
    fStart: 620,
    fEnd: 1980,
    peak: 0.24,
    attackMs: 32,
    q: 1.05,
  })
}

/** Zoom out: deeper-pitched swoosh, filter sweeps downward (out / close). */
function synthZoomOutDeepSwoosh() {
  synthSwooshNoise({
    durationMs: 178,
    fStart: 2050,
    fEnd: 420,
    peak: 0.24,
    attackMs: 32,
    q: 1.05,
  })
}

function synthSwitch() {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const peak = 0.1 * SYNTH_GAIN_MULT
  ;[440, 554].forEach((freq, i) => {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.value = peak
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22 + i * 0.02)
    osc.connect(g)
    g.connect(ctx.destination)
    osc.start(now + i * 0.02)
    osc.stop(now + 0.25)
  })
}

function synthInfo(open) {
  const ctx = getCtx()
  if (!ctx) return
  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  const peakOpen = 0.05 * SYNTH_GAIN_MULT
  const peakClose = 0.048 * SYNTH_GAIN_MULT
  if (open) {
    osc.frequency.setValueAtTime(523, now)
    osc.frequency.exponentialRampToValueAtTime(659, now + 0.09)
    g.gain.value = peakOpen
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.16)
  } else {
    osc.frequency.setValueAtTime(380, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.14)
    g.gain.value = peakClose
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.2)
  }
  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + 0.22)
}

const fallback = {
  drag: synthDragSwish,
  zoomOut: synthZoomOutDeepSwoosh,
  zoomIn: synthZoomInDeepSwoosh,
  switchItem: () => synthSwitch(),
  infoOpen: () => synthInfo(true),
  infoClose: () => synthInfo(false),
}

export async function playGestureSound(kind) {
  if (typeof window === 'undefined') return
  resumeCtx()
  const url = URLS[kind]
  if (!url) return
  const volume = MP3_VOLUME[kind] ?? 1
  try {
    await playMp3(url, volume)
  } catch {
    const fn = fallback[kind]
    if (fn) fn()
  }
}

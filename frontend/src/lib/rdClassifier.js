import { assertSecureHttpUrl } from '../utils/security'
import { env } from '../config/env'

const MODEL_ASSET_BASE_URL = (env.modelAssetBaseUrl || '').trim()
if (MODEL_ASSET_BASE_URL) {
  assertSecureHttpUrl(MODEL_ASSET_BASE_URL)
}
const MODEL_BASE = MODEL_ASSET_BASE_URL.replace(/\/+$/, '')
const MODEL_URL = MODEL_BASE ? `${MODEL_BASE}/model.onnx` : '/models/model.onnx'
const LABELS_URL = MODEL_BASE ? `${MODEL_BASE}/labels.txt` : '/models/labels.txt'
export const MODEL_INPUT_SIZE = 640
const SIGNAL_INPUT_SIZE = 224
/** Discard degenerate frames below this peak class probability on the best anchor. */
const DETECTION_SCORE_FLOOR = 0.04
/** Candidate floor for YOLO boxes (tracking may still require a stronger lock before UI). */
const LIVE_BOX_SCORE_FLOOR = 0.25
const LIVE_NMS_IOU = 0.45
const LIVE_MAX_DETECTIONS = 5
const DEFAULT_CLASS_NAMES = ['RD244', 'RD246']

export const PREVIEW_ZOOM_MIN = 1
export const PREVIEW_ZOOM_MAX = 4

export function clampPreviewZoom(zoom) {
  const z = Number(zoom)
  if (!Number.isFinite(z)) return PREVIEW_ZOOM_MIN
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, z))
}

/** Letterbox layout so YOLO sees undistorted frames (stretch hurts accuracy). */
export function getLetterboxLayout(srcW, srcH, destW, destH) {
  const scale = Math.min(destW / srcW, destH / srcH)
  const drawW = srcW * scale
  const drawH = srcH * scale
  const padX = (destW - drawW) / 2
  const padY = (destH - drawH) / 2
  return { scale, drawW, drawH, padX, padY }
}

function drawVideoToCanvas(ctx, videoEl, destW, destH, zoom = 1) {
  const vw = videoEl.videoWidth
  const vh = videoEl.videoHeight
  if (!vw || !vh) return false
  const z = clampPreviewZoom(zoom)
  const sw = vw / z
  const sh = vh / z
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2
  const { drawW, drawH, padX, padY } = getLetterboxLayout(sw, sh, destW, destH)
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, destW, destH)
  ctx.drawImage(videoEl, sx, sy, sw, sh, padX, padY, drawW, drawH)
  return true
}

let sessionPromise = null
let modelCanvas = null
let signalCanvas = null
let classNamesPromise = null
/** Single flight: ONNX WASM + weights download + labels + optional warmup overlap with splash. */
let preloadPromise = null
let ortPromise = null

async function getOrt() {
  if (!ortPromise) {
    ortPromise = import('onnxruntime-web')
  }
  return ortPromise
}

function ensureCanvas(kind = 'model') {
  if (kind === 'signal') {
    if (signalCanvas) return signalCanvas
    signalCanvas = document.createElement('canvas')
    signalCanvas.width = SIGNAL_INPUT_SIZE
    signalCanvas.height = SIGNAL_INPUT_SIZE
    return signalCanvas
  }
  if (modelCanvas) return modelCanvas
  modelCanvas = document.createElement('canvas')
  modelCanvas.width = MODEL_INPUT_SIZE
  modelCanvas.height = MODEL_INPUT_SIZE
  return modelCanvas
}

async function createInferenceSession(ort) {
  try {
    return await ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['webgpu', 'wasm'],
      graphOptimizationLevel: 'all',
    })
  } catch {
    return ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    })
  }
}

async function getSession() {
  if (sessionPromise) return sessionPromise
  sessionPromise = getOrt().then((ort) => createInferenceSession(ort))
  return sessionPromise
}

async function warmupSession(session) {
  const ort = await getOrt()
  const inputName = session.inputNames[0]
  if (!inputName) return
  const size = MODEL_INPUT_SIZE
  const hw = size * size
  const zeros = new Float32Array(3 * hw)
  const inputTensor = new ort.Tensor('float32', zeros, [1, 3, size, size])
  await session.run({ [inputName]: inputTensor })
}

/**
 * Start loading labels + ONNX session + one dummy inference ASAP (call from App splash phase).
 * Idempotent — safe to call from multiple components.
 */
export function preloadRdScanner() {
  if (!preloadPromise) {
    preloadPromise = (async () => {
      const [session] = await Promise.all([getSession(), getClassNames()])
      try {
        await warmupSession(session)
      } catch {
        // Warmup is best-effort; first real frame may still JIT WASM paths on some browsers.
      }
    })()
  }
  return preloadPromise
}

export function getRdScannerReadyPromise() {
  return preloadRdScanner()
}

async function getClassNames() {
  if (classNamesPromise) return classNamesPromise
  classNamesPromise = fetch(LABELS_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`Unable to load labels (${res.status})`)
      return res.text()
    })
    .then((text) => {
      const names = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
      return names.length ? names : DEFAULT_CLASS_NAMES
    })
    .catch(() => DEFAULT_CLASS_NAMES)
  return classNamesPromise
}

/** YOLOv8 ONNX class channels are logits; apply sigmoid like Ultralytics multiclass heads. */
function sigmoid(x) {
  const z = Number(x)
  if (z >= 36) return 1
  if (z <= -36) return 0
  return 1 / (1 + Math.exp(-z))
}

function softmax(values) {
  let max = -Infinity
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] > max) max = values[i]
  }
  const out = new Float32Array(values.length)
  let sum = 0
  for (let i = 0; i < values.length; i += 1) {
    const exp = Math.exp(values[i] - max)
    out[i] = exp
    sum += exp
  }
  if (!sum) return out
  for (let i = 0; i < out.length; i += 1) out[i] /= sum
  return out
}

function toInputTensorFromVideo(videoEl, zoom = 1) {
  const canvas = ensureCanvas('model')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (!drawVideoToCanvas(ctx, videoEl, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, zoom)) return null
  const { data } = ctx.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
  const hw = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE
  const chw = new Float32Array(3 * hw)
  for (let i = 0; i < hw; i += 1) {
    const j = i * 4
    chw[i] = data[j] / 255
    chw[hw + i] = data[j + 1] / 255
    chw[hw * 2 + i] = data[j + 2] / 255
  }
  return chw
}

function boxIoU(a, b) {
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

function nmsDetections(items, iouThreshold, maxKeep) {
  // Class-agnostic NMS — overlapping boxes of different classes still collapse to one.
  const sorted = [...items].sort((a, b) => b.confidence - a.confidence)
  const kept = []
  for (const cand of sorted) {
    let overlaps = false
    for (const prev of kept) {
      if (boxIoU(prev.box, cand.box) >= iouThreshold) {
        overlaps = true
        break
      }
    }
    if (!overlaps) {
      kept.push(cand)
      if (kept.length >= maxKeep) break
    }
  }
  return kept
}

function classChannelToProb(raw, useSigmoid) {
  return useSigmoid ? sigmoid(raw) : Math.min(1, Math.max(0, Number(raw)))
}

/**
 * YOLOv8 detection ONNX: [1, 4+nc, anchors].
 * Returns NMS'd boxes for tracking, plus a single-best summary.
 */
function parseDetectionOutput(outputTensor, classNames) {
  const values = outputTensor?.data
  const dims = outputTensor?.dims
  if (!values || !dims || dims.length !== 3) return null

  const channels = Number(dims[1] ?? 0)
  const anchors = Number(dims[2] ?? 0)
  const classCount = channels - 4
  if (channels <= 4 || anchors <= 0 || classCount <= 0) return null

  // This project's Ultralytics ONNX export stores class logits — always sigmoid.
  const useSigmoid = true

  // Box coords may be pixels (0–640) or normalized (0–1).
  let boxExtent = 0
  for (let anchor = 0; anchor < Math.min(anchors, 64); anchor += 1) {
    boxExtent = Math.max(
      boxExtent,
      Math.abs(Number(values[0 * anchors + anchor]) || 0),
      Math.abs(Number(values[1 * anchors + anchor]) || 0),
      Math.abs(Number(values[2 * anchors + anchor]) || 0),
      Math.abs(Number(values[3 * anchors + anchor]) || 0),
    )
  }
  const boxScale = boxExtent <= 1.5 ? MODEL_INPUT_SIZE : 1

  const candidates = []
  let bestAnchor = 0
  let bestClassIndex = 0
  let bestConfidence = 0

  for (let anchor = 0; anchor < anchors; anchor += 1) {
    let localBestCls = 0
    let localBestConf = 0
    let localSecond = 0
    for (let cls = 0; cls < classCount; cls += 1) {
      const p = classChannelToProb(values[(4 + cls) * anchors + anchor], useSigmoid)
      if (p > localBestConf) {
        localSecond = localBestConf
        localBestConf = p
        localBestCls = cls
      } else if (p > localSecond) {
        localSecond = p
      }
    }
    if (localBestConf > bestConfidence) {
      bestConfidence = localBestConf
      bestClassIndex = localBestCls
      bestAnchor = anchor
    }
    if (localBestConf < LIVE_BOX_SCORE_FLOOR) continue

    const cx = Number(values[0 * anchors + anchor]) * boxScale
    const cy = Number(values[1 * anchors + anchor]) * boxScale
    const w = Number(values[2 * anchors + anchor]) * boxScale
    const h = Number(values[3 * anchors + anchor]) * boxScale
    if (!(w > 4 && h > 4)) continue
    // Reject degenerate full-frame / tiny noise boxes.
    if (w > MODEL_INPUT_SIZE * 0.98 || h > MODEL_INPUT_SIZE * 0.98) continue
    if (w * h < 20 * 20) continue

    const margin = Math.max(0, localBestConf - localSecond)
    candidates.push({
      id: `${localBestCls}-${anchor}`,
      classIndex: localBestCls,
      className: classNames[localBestCls] ?? `class-${localBestCls}`,
      confidence: Number(localBestConf.toFixed(4)),
      margin: Number(margin.toFixed(4)),
      box: {
        cx: Number(cx.toFixed(2)),
        cy: Number(cy.toFixed(2)),
        w: Number(w.toFixed(2)),
        h: Number(h.toFixed(2)),
      },
    })
  }

  if (bestConfidence < DETECTION_SCORE_FLOOR && candidates.length === 0) return null

  const detections = nmsDetections(candidates, LIVE_NMS_IOU, LIVE_MAX_DETECTIONS)

  const anchorProbs = new Float32Array(classCount)
  for (let cls = 0; cls < classCount; cls += 1) {
    anchorProbs[cls] = classChannelToProb(values[(4 + cls) * anchors + bestAnchor], useSigmoid)
  }

  let secondBest = 0
  for (let cls = 0; cls < classCount; cls += 1) {
    if (cls === bestClassIndex) continue
    const p = anchorProbs[cls]
    if (p > secondBest) secondBest = p
  }

  const top = detections[0]
  return {
    classIndex: top?.classIndex ?? bestClassIndex,
    className: top?.className ?? classNames[bestClassIndex] ?? `class-${bestClassIndex}`,
    confidence: Number((top?.confidence ?? bestConfidence).toFixed(4)),
    probabilities: Array.from(anchorProbs),
    margin: Number((top?.margin ?? Math.max(0, bestConfidence - secondBest)).toFixed(4)),
    scoreKind: 'yolo-det',
    detections,
  }
}

/**
 * Map a YOLO model-space box (pixels in letterboxed 640×640) onto overlay
 * coordinates matching a `object-fit: cover` camera video (+ digital zoom crop).
 * Returns CSS percent values (0–100) relative to the overlay element.
 */
export function mapModelBoxToOverlayPercent(box, videoEl, overlayEl, zoom = 1) {
  if (!box || !videoEl || !overlayEl) return null
  const vw = videoEl.videoWidth
  const vh = videoEl.videoHeight
  if (!vw || !vh) return null

  const elW = overlayEl.clientWidth || overlayEl.getBoundingClientRect().width
  const elH = overlayEl.clientHeight || overlayEl.getBoundingClientRect().height
  if (!(elW > 0 && elH > 0)) return null

  const z = clampPreviewZoom(zoom)
  const sw = vw / z
  const sh = vh / z
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2
  const layout = getLetterboxLayout(sw, sh, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
  if (!(layout.drawW > 1 && layout.drawH > 1)) return null

  const corners = [
    [box.cx - box.w / 2, box.cy - box.h / 2],
    [box.cx + box.w / 2, box.cy - box.h / 2],
    [box.cx + box.w / 2, box.cy + box.h / 2],
    [box.cx - box.w / 2, box.cy + box.h / 2],
  ].map(([mx, my]) => {
    const nx = (mx - layout.padX) / layout.drawW
    const ny = (my - layout.padY) / layout.drawH
    return {
      vx: sx + nx * sw,
      vy: sy + ny * sh,
    }
  })

  const videoAspect = vw / vh
  const elAspect = elW / elH
  let renderW
  let renderH
  let offsetX
  let offsetY
  if (videoAspect > elAspect) {
    renderH = elH
    renderW = elH * videoAspect
    offsetX = (elW - renderW) / 2
    offsetY = 0
  } else {
    renderW = elW
    renderH = elW / videoAspect
    offsetX = 0
    offsetY = (elH - renderH) / 2
  }

  const mapped = corners.map(({ vx, vy }) => ({
    x: offsetX + (vx / vw) * renderW,
    y: offsetY + (vy / vh) * renderH,
  }))

  const xs = mapped.map((p) => p.x)
  const ys = mapped.map((p) => p.y)
  const leftPx = Math.min(...xs)
  const rightPx = Math.max(...xs)
  const topPx = Math.min(...ys)
  const bottomPx = Math.max(...ys)
  return {
    left: (leftPx / elW) * 100,
    top: (topPx / elH) * 100,
    width: (Math.max(0, rightPx - leftPx) / elW) * 100,
    height: (Math.max(0, bottomPx - topPx) / elH) * 100,
  }
}

/**
 * Lightweight frame heuristics for rejecting obvious non-artifact frames (e.g. close-up hand/fist).
 * - `skinRatio`: fraction of pixels that fit broad skin-tone ranges in YCbCr.
 * - `edgeDensity`: fraction of pixels with noticeable local luminance gradients.
 */
export function analyzeFrameSignals(videoEl, zoom = 1) {
  if (!videoEl || videoEl.readyState < 2) return null
  const canvas = ensureCanvas('signal')
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  if (!drawVideoToCanvas(ctx, videoEl, SIGNAL_INPUT_SIZE, SIGNAL_INPUT_SIZE, zoom)) return null
  const { data } = ctx.getImageData(0, 0, SIGNAL_INPUT_SIZE, SIGNAL_INPUT_SIZE)
  const width = SIGNAL_INPUT_SIZE
  const height = SIGNAL_INPUT_SIZE
  const stride = 4
  const luma = new Float32Array(width * height)
  let skinCount = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * stride
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const yv = 0.299 * r + 0.587 * g + 0.114 * b
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
      luma[y * width + x] = yv
      if (cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173) {
        skinCount += 1
      }
    }
  }

  let edgeCount = 0
  // skip border pixels for neighbor gradients
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = y * width + x
      const gx = Math.abs(luma[idx + 1] - luma[idx - 1])
      const gy = Math.abs(luma[idx + width] - luma[idx - width])
      if (gx + gy > 38) edgeCount += 1
    }
  }

  const total = width * height
  const innerTotal = (width - 2) * (height - 2)
  return {
    skinRatio: Number((skinCount / total).toFixed(4)),
    edgeDensity: Number((edgeCount / innerTotal).toFixed(4)),
  }
}

/**
 * Classifies a single camera frame from a <video> element.
 * Returns null if the frame/session is not ready.
 */
export async function classifyRdItemsFrame(videoEl, options = {}) {
  if (!videoEl || videoEl.readyState < 2) return null
  const zoom = options.zoom ?? 1
  const chw = toInputTensorFromVideo(videoEl, zoom)
  if (!chw) return null

  const [ort, classNames, session] = await Promise.all([getOrt(), getClassNames(), getSession()])
  const inputTensor = new ort.Tensor('float32', chw, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE])
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  const feeds = { [inputName]: inputTensor }
  const results = await session.run(feeds)
  const outputTensor = results[outputName]
  if (!outputTensor?.data?.length) return null

  const parsedDetection = parseDetectionOutput(outputTensor, classNames)
  if (parsedDetection) {
    // Drop boxes whose centers sit in letterbox padding (black bars) — not real content.
    const vw = videoEl.videoWidth
    const vh = videoEl.videoHeight
    const z = clampPreviewZoom(zoom)
    const sw = vw / z
    const sh = vh / z
    const layout = getLetterboxLayout(sw, sh, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE)
    const pad = 2
    const detections = (parsedDetection.detections || []).filter((d) => {
      const cx = d?.box?.cx
      const cy = d?.box?.cy
      if (!Number.isFinite(cx) || !Number.isFinite(cy)) return false
      return (
        cx >= layout.padX + pad &&
        cy >= layout.padY + pad &&
        cx <= layout.padX + layout.drawW - pad &&
        cy <= layout.padY + layout.drawH - pad
      )
    })
    if (detections.length === 0) {
      return { ...parsedDetection, detections: [], confidence: 0 }
    }
    const top = detections[0]
    return {
      ...parsedDetection,
      detections,
      classIndex: top.classIndex,
      className: top.className,
      confidence: top.confidence,
      margin: top.margin,
    }
  }

  const logits = outputTensor.data
  const probs = softmax(logits)
  let bestIdx = 0
  let best = Number(probs[0] ?? 0)
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > best) {
      best = Number(probs[i])
      bestIdx = i
    }
  }

  return {
    classIndex: bestIdx,
    className: classNames[bestIdx] ?? `class-${bestIdx}`,
    confidence: Number(best.toFixed(4)),
    probabilities: Array.from(probs),
    detections: [],
  }
}

export async function getRdModelClasses() {
  const classNames = await getClassNames()
  return [...classNames]
}

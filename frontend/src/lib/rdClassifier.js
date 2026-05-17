import { assertSecureHttpUrl } from '../utils/security'

const MODEL_ASSET_BASE_URL = (import.meta.env.VITE_MODEL_ASSET_BASE_URL || '').trim()
if (MODEL_ASSET_BASE_URL) {
  assertSecureHttpUrl(MODEL_ASSET_BASE_URL)
}
const MODEL_BASE = MODEL_ASSET_BASE_URL.replace(/\/+$/, '')
const MODEL_URL = MODEL_BASE ? `${MODEL_BASE}/model.onnx` : '/models/model.onnx'
const LABELS_URL = MODEL_BASE ? `${MODEL_BASE}/labels.txt` : '/models/labels.txt'
const MODEL_INPUT_SIZE = 640
const SIGNAL_INPUT_SIZE = 224
/** Discard degenerate frames below this peak class probability on the best anchor. */
const DETECTION_SCORE_FLOOR = 0.04
const DEFAULT_CLASS_NAMES = ['RD244', 'RD246']

export const PREVIEW_ZOOM_MIN = 1
export const PREVIEW_ZOOM_MAX = 4

export function clampPreviewZoom(zoom) {
  const z = Number(zoom)
  if (!Number.isFinite(z)) return PREVIEW_ZOOM_MIN
  return Math.min(PREVIEW_ZOOM_MAX, Math.max(PREVIEW_ZOOM_MIN, z))
}

function drawVideoToCanvas(ctx, videoEl, destW, destH, zoom = 1) {
  const vw = videoEl.videoWidth
  const vh = videoEl.videoHeight
  if (!vw || !vh) return false
  const z = clampPreviewZoom(zoom)
  if (z <= 1.001) {
    ctx.drawImage(videoEl, 0, 0, destW, destH)
    return true
  }
  const sw = vw / z
  const sh = vh / z
  const sx = (vw - sw) / 2
  const sy = (vh - sh) / 2
  ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, destW, destH)
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

async function getSession() {
  if (sessionPromise) return sessionPromise
  sessionPromise = getOrt().then((ort) =>
    ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    }),
  )
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

/**
 * YOLOv8 detection ONNX: [1, 4+nc, anchors]. Ultralytics uses per-anchor class sigmoids;
 * take the global best (anchor, class) pair, then read that anchor's class vector for EMA.
 */
function parseDetectionOutput(outputTensor, classNames) {
  const values = outputTensor?.data
  const dims = outputTensor?.dims
  if (!values || !dims || dims.length !== 3) return null

  const channels = Number(dims[1] ?? 0)
  const anchors = Number(dims[2] ?? 0)
  const classCount = channels - 4
  if (channels <= 4 || anchors <= 0 || classCount <= 0) return null

  let bestAnchor = 0
  let bestClassIndex = 0
  let bestConfidence = 0

  for (let anchor = 0; anchor < anchors; anchor += 1) {
    for (let cls = 0; cls < classCount; cls += 1) {
      const logit = Number(values[(4 + cls) * anchors + anchor] ?? 0)
      const p = sigmoid(logit)
      if (p > bestConfidence) {
        bestConfidence = p
        bestClassIndex = cls
        bestAnchor = anchor
      }
    }
  }

  if (bestConfidence < DETECTION_SCORE_FLOOR) return null

  const anchorProbs = new Float32Array(classCount)
  for (let cls = 0; cls < classCount; cls += 1) {
    const logit = Number(values[(4 + cls) * anchors + bestAnchor] ?? 0)
    anchorProbs[cls] = sigmoid(logit)
  }

  let secondBest = 0
  for (let cls = 0; cls < classCount; cls += 1) {
    if (cls === bestClassIndex) continue
    const p = anchorProbs[cls]
    if (p > secondBest) secondBest = p
  }

  return {
    classIndex: bestClassIndex,
    className: classNames[bestClassIndex] ?? `class-${bestClassIndex}`,
    confidence: Number(bestConfidence.toFixed(4)),
    probabilities: Array.from(anchorProbs),
    margin: Number(Math.max(0, bestConfidence - secondBest).toFixed(4)),
    scoreKind: 'yolo-det',
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
    return parsedDetection
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
  }
}

export async function getRdModelClasses() {
  const classNames = await getClassNames()
  return [...classNames]
}

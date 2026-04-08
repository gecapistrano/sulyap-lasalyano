import * as ort from 'onnxruntime-web'

const MODEL_URL = '/models/rd_items_cls.onnx'
const CLASS_NAMES = ['RD242-243', 'RD244']
const INPUT_SIZE = 224

let sessionPromise = null
let scratchCanvas = null

function ensureCanvas() {
  if (scratchCanvas) return scratchCanvas
  scratchCanvas = document.createElement('canvas')
  scratchCanvas.width = INPUT_SIZE
  scratchCanvas.height = INPUT_SIZE
  return scratchCanvas
}

async function getSession() {
  if (sessionPromise) return sessionPromise
  sessionPromise = ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['wasm'],
    graphOptimizationLevel: 'all',
  })
  return sessionPromise
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

function toInputTensorFromVideo(videoEl) {
  const canvas = ensureCanvas()
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(videoEl, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const hw = INPUT_SIZE * INPUT_SIZE
  const chw = new Float32Array(3 * hw)
  for (let i = 0; i < hw; i += 1) {
    const j = i * 4
    chw[i] = data[j] / 255
    chw[hw + i] = data[j + 1] / 255
    chw[hw * 2 + i] = data[j + 2] / 255
  }
  return new ort.Tensor('float32', chw, [1, 3, INPUT_SIZE, INPUT_SIZE])
}

/**
 * Lightweight frame heuristics for rejecting obvious non-artifact frames (e.g. close-up hand/fist).
 * - `skinRatio`: fraction of pixels that fit broad skin-tone ranges in YCbCr.
 * - `edgeDensity`: fraction of pixels with noticeable local luminance gradients.
 */
export function analyzeFrameSignals(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null
  const canvas = ensureCanvas()
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(videoEl, 0, 0, INPUT_SIZE, INPUT_SIZE)
  const { data } = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE)
  const width = INPUT_SIZE
  const height = INPUT_SIZE
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
export async function classifyRdItemsFrame(videoEl) {
  if (!videoEl || videoEl.readyState < 2) return null
  const inputTensor = toInputTensorFromVideo(videoEl)
  if (!inputTensor) return null

  const session = await getSession()
  const inputName = session.inputNames[0]
  const outputName = session.outputNames[0]
  const feeds = { [inputName]: inputTensor }
  const results = await session.run(feeds)
  const logits = results[outputName]?.data
  if (!logits || !logits.length) return null

  const probs = softmax(logits)
  let bestIdx = 0
  let best = probs[0]
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > best) {
      best = probs[i]
      bestIdx = i
    }
  }

  return {
    classIndex: bestIdx,
    className: CLASS_NAMES[bestIdx] ?? `class-${bestIdx}`,
    confidence: Number(best.toFixed(4)),
    probabilities: Array.from(probs),
  }
}

export function getRdModelClasses() {
  return [...CLASS_NAMES]
}

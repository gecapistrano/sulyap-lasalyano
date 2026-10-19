/**
 * Fail the static deploy/build if Live Scan model or ORT WASM assets are missing.
 * Root cause of production "Could not load the recognition model" is often a deploy
 * without models/ + vendor/onnxruntime-web/ (they must ship with this folder).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const required = [
  'models/model.onnx',
  'models/labels.txt',
  'vendor/onnxruntime-web/ort.wasm.min.js',
  'vendor/onnxruntime-web/ort-wasm-simd-threaded.mjs',
  'vendor/onnxruntime-web/ort-wasm-simd-threaded.wasm',
]

const missing = required.filter((rel) => !fs.existsSync(path.join(root, rel)))
if (missing.length) {
  console.error('[check-scan-assets] Missing required Live Scan files:')
  for (const rel of missing) console.error('  -', rel)
  console.error('Copy from frontend/public/models and onnxruntime-web dist, or run: node scripts/sync-scan-assets.mjs')
  process.exit(1)
}

const modelPath = path.join(root, 'models/model.onnx')
const modelSize = fs.statSync(modelPath).size
const MIN_MODEL_BYTES = 1_000_000
if (modelSize < MIN_MODEL_BYTES) {
  console.error(
    `[check-scan-assets] models/model.onnx is only ${modelSize} bytes (expected ≥ ${MIN_MODEL_BYTES}). ` +
      'Re-run: node scripts/sync-scan-assets.mjs',
  )
  process.exit(1)
}

const labels = fs
  .readFileSync(path.join(root, 'models/labels.txt'), 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean)
console.log(
  `[check-scan-assets] OK — model.onnx ${(modelSize / (1024 * 1024)).toFixed(1)}MB, ${labels.length} labels`,
)

/**
 * Sync Live Scan ONNX + labels from frontend/public/models, and ORT WASM from
 * frontend/node_modules/onnxruntime-web when available.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const staticRoot = path.resolve(here, '..')
const repoRoot = path.resolve(staticRoot, '..')
const modelsSrc = path.join(repoRoot, 'frontend', 'public', 'models')
const modelsDest = path.join(staticRoot, 'models')
const ortSrcCandidates = [
  path.join(repoRoot, 'frontend', 'node_modules', 'onnxruntime-web', 'dist'),
  path.join(repoRoot, 'node_modules', 'onnxruntime-web', 'dist'),
]
const ortDest = path.join(staticRoot, 'vendor', 'onnxruntime-web')

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  console.log('copied', path.relative(repoRoot, src), '→', path.relative(repoRoot, dest))
}

fs.mkdirSync(modelsDest, { recursive: true })
for (const name of ['model.onnx', 'labels.txt']) {
  const src = path.join(modelsSrc, name)
  if (!fs.existsSync(src)) {
    console.error('Missing source', src)
    process.exit(1)
  }
  copyFile(src, path.join(modelsDest, name))
}

const ortSrc = ortSrcCandidates.find((p) => fs.existsSync(p))
const ortFiles = [
  'ort.wasm.min.js',
  'ort-wasm-simd-threaded.mjs',
  'ort-wasm-simd-threaded.wasm',
]
if (ortSrc) {
  fs.mkdirSync(ortDest, { recursive: true })
  for (const name of ortFiles) {
    const src = path.join(ortSrc, name)
    if (!fs.existsSync(src)) {
      console.warn('skip missing ORT file', src)
      continue
    }
    copyFile(src, path.join(ortDest, name))
  }
} else {
  console.warn('onnxruntime-web dist not found — leaving existing vendor/ files in place')
  for (const name of ortFiles) {
    if (!fs.existsSync(path.join(ortDest, name))) {
      console.error('Missing vendor file', path.join(ortDest, name))
      process.exit(1)
    }
  }
}

console.log('sync-scan-assets done')

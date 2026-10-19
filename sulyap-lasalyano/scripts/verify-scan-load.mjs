/**
 * Headless-ish asset + MIME check for Live Scan (no browser ORT required).
 * Usage: node scripts/verify-scan-load.mjs [baseUrl]
 */
import http from 'node:http'
import https from 'node:https'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const base = (process.argv[2] || 'http://127.0.0.1:8765').replace(/\/+$/, '')
const MIN_MODEL = 1_000_000

const assets = [
  { path: '/models/model.onnx', minBytes: MIN_MODEL, mimeIncludes: null },
  { path: '/models/labels.txt', minBytes: 8, mimeIncludes: 'text/plain' },
  { path: '/vendor/onnxruntime-web/ort.wasm.min.js', minBytes: 1000, mimeIncludes: 'javascript' },
  {
    path: '/vendor/onnxruntime-web/ort-wasm-simd-threaded.mjs',
    minBytes: 1000,
    mimeIncludes: 'javascript',
  },
  {
    path: '/vendor/onnxruntime-web/ort-wasm-simd-threaded.wasm',
    minBytes: 1000,
    mimeIncludes: 'wasm',
  },
]

function fetchHead(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http
    const req = lib.request(url, { method: 'HEAD' }, (res) => {
      res.resume()
      resolve({
        status: res.statusCode || 0,
        type: String(res.headers['content-type'] || ''),
        length: Number(res.headers['content-length'] || 0),
      })
    })
    req.on('error', reject)
    req.end()
  })
}

let failed = false
console.log(`[verify-scan-load] base=${base}`)

for (const a of assets) {
  const local = path.join(root, a.path.replace(/^\//, ''))
  if (!fs.existsSync(local)) {
    console.error(`MISSING on disk: ${a.path}`)
    failed = true
    continue
  }
  const diskSize = fs.statSync(local).size
  if (diskSize < a.minBytes) {
    console.error(`TOO SMALL on disk: ${a.path} (${diskSize} bytes)`)
    failed = true
  } else {
    console.log(`disk OK  ${a.path}  ${diskSize} bytes`)
  }

  try {
    const r = await fetchHead(base + a.path)
    const mimeOk = !a.mimeIncludes || r.type.toLowerCase().includes(a.mimeIncludes)
    const sizeOk = !a.minBytes || r.length >= a.minBytes || r.length === 0
    if (r.status !== 200) {
      console.error(`HTTP ${r.status} ${a.path}`)
      failed = true
    } else if (!mimeOk) {
      console.error(`BAD MIME ${a.path}: ${r.type} (need *${a.mimeIncludes}*)`)
      failed = true
    } else if (!sizeOk) {
      console.error(`HTTP size ${r.length} too small for ${a.path}`)
      failed = true
    } else {
      console.log(`http OK  ${a.path}  ${r.status}  ${r.type}  len=${r.length || '?'}`)
    }
  } catch (err) {
    console.error(`HTTP unreachable ${a.path}: ${err.message}`)
    console.error('  Start the server: node serve.mjs   (or npm run dev:static from repo root)')
    failed = true
  }
}

if (failed) process.exit(1)
console.log('[verify-scan-load] all checks passed')

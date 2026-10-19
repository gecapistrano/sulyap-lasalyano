/**
 * Local static server with correct MIME types for ONNX Runtime Web.
 * Python's `http.server` serves `.mjs` as text/plain, which blocks dynamic import
 * of ort-wasm-simd-threaded.mjs and breaks Live Scan model load.
 *
 * Usage (from this folder):  node serve.mjs [port]
 * Default port: 8765
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname)
const PORT = Number(process.argv[2]) || 8765

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent((reqPath || '/').split('?')[0])
  const rel = decoded.replace(/^\/+/, '')
  const full = path.resolve(root, rel)
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep
  if (full !== root && !full.startsWith(rootWithSep)) return null
  return full
}

function send(res, status, body, type, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
    ...extraHeaders,
  })
  res.end(body)
}

function rewriteUrlPath(urlPath) {
  if (urlPath === '/scan' || urlPath === '/scan/') return '/scan.html'
  if (urlPath === '/knowledge-graph' || urlPath === '/knowledge-graph/') return '/knowledge-graph.html'
  if (urlPath === '/curator' || urlPath === '/curator/') return '/curator.html'
  if (urlPath === '/president' || urlPath === '/president/') return '/president.html'
  if (/^\/presidents\/[^/]+\/?$/.test(urlPath)) return '/president.html'
  return urlPath
}

const server = http.createServer((req, res) => {
  const method = (req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return send(res, 405, 'Method not allowed')
  }

  let urlPath = rewriteUrlPath((req.url || '/').split('?')[0])

  let filePath = safeJoin(ROOT, urlPath === '/' ? '/index.html' : urlPath)
  if (!filePath) return send(res, 403, 'Forbidden')

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
      fs.stat(filePath, (dirErr, dirSt) => {
        if (dirErr || !dirSt.isFile()) return send(res, 404, 'Not found')
        streamFile(res, filePath, dirSt.size, method === 'HEAD')
      })
      return
    }
    if (err || !st.isFile()) return send(res, 404, 'Not found')
    streamFile(res, filePath, st.size, method === 'HEAD')
  })
})

function streamFile(res, filePath, size, headOnly) {
  const ext = path.extname(filePath).toLowerCase()
  const type = TYPES[ext] || 'application/octet-stream'
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': size,
    'Cache-Control': 'no-cache',
  })
  if (headOnly) {
    res.end()
    return
  }
  fs.createReadStream(filePath).on('error', () => {
    if (!res.headersSent) send(res, 500, 'Read error')
    else res.destroy()
  }).pipe(res)
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sulyap static site: http://127.0.0.1:${PORT}/`)
  console.log(`Live Scan:          http://127.0.0.1:${PORT}/scan`)
  console.log(`Curator desk:       http://127.0.0.1:${PORT}/curator  (direct URL only)`)
})

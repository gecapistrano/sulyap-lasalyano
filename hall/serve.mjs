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
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname)
const PORT = Number(process.argv[2]) || 8765
/** Local-only FastAPI proxy so KG/Scan can fetch `/catalog` and `/media` same-origin. */
const API_PROXY = process.env.SULYAP_API_PROXY || 'http://127.0.0.1:8000'

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
  '.glb': 'model/gltf-binary',
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

function catalogProxyOrigin() {
  try {
    const parsed = new URL(API_PROXY)
    if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') return ''
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return ''
    return parsed.origin
  } catch {
    return ''
  }
}

function isApiProxyPath(urlPath) {
  return (
    urlPath === '/catalog' ||
    urlPath.startsWith('/catalog/') ||
    urlPath === '/media' ||
    urlPath.startsWith('/media/')
  )
}

async function proxyApi(req, res, urlPath, query) {
  const origin = catalogProxyOrigin()
  if (!origin) return send(res, 502, 'Catalog proxy unavailable')
  const target = new URL(urlPath, origin)
  if (query) target.search = query
  const ac = new AbortController()
  const onAbort = () => ac.abort()
  req.on('aborted', onAbort)
  try {
    const upstream = await fetch(target, {
      method: req.method || 'GET',
      headers: { Accept: req.headers.accept || '*/*' },
      signal: ac.signal,
    })
    if (res.writableEnded || res.destroyed) return
    const headers = {
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }
    const len = upstream.headers.get('content-length')
    if (len) headers['Content-Length'] = len
    res.writeHead(upstream.status, headers)
    if ((req.method || 'GET').toUpperCase() === 'HEAD' || !upstream.body) {
      res.end()
      return
    }
    await pipeline(Readable.fromWeb(upstream.body), res)
  } catch {
    if (!res.headersSent) send(res, 502, 'Catalog proxy unavailable')
    else if (!res.writableEnded) res.destroy()
  } finally {
    req.off('aborted', onAbort)
  }
}

const server = http.createServer((req, res) => {
  // Aborted client connections (ORT cancels, page reload) must not crash the process.
  res.on('error', () => {})
  req.on('error', () => {})

  const method = (req.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    return send(res, 405, 'Method not allowed')
  }

  let urlPath = rewriteUrlPath((req.url || '/').split('?')[0])
  const query = (req.url || '').includes('?') ? (req.url || '').split('?').slice(1).join('?') : ''

  if (isApiProxyPath(urlPath)) {
    void proxyApi(req, res, urlPath, query)
    return
  }

  let filePath = safeJoin(ROOT, urlPath === '/' ? '/index.html' : urlPath)
  if (!filePath) return send(res, 403, 'Forbidden')

  fs.stat(filePath, (err, st) => {
    if (!err && st.isDirectory()) {
      filePath = path.join(filePath, 'index.html')
      fs.stat(filePath, (dirErr, dirSt) => {
        if (dirErr || !dirSt.isFile()) return send(res, 404, 'Not found')
        streamFile(req, res, filePath, dirSt.size, method === 'HEAD')
      })
      return
    }
    if (err || !st.isFile()) return send(res, 404, 'Not found')
    streamFile(req, res, filePath, st.size, method === 'HEAD')
  })
})

function streamFile(req, res, filePath, size, headOnly) {
  const ext = path.extname(filePath).toLowerCase()
  const type = TYPES[ext] || 'application/octet-stream'
  if (res.writableEnded || res.destroyed) return
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': size,
    'Cache-Control': 'no-cache',
  })
  if (headOnly) {
    res.end()
    return
  }
  const stream = fs.createReadStream(filePath)
  const fail = () => {
    stream.destroy()
    if (!res.writableEnded) res.destroy()
  }
  req.on('aborted', fail)
  stream.on('error', fail)
  res.on('close', () => {
    if (!stream.destroyed) stream.destroy()
  })
  stream.pipe(res)
}

server.on('error', (err) => {
  console.error('[serve] server error:', err.message)
  process.exitCode = 1
})

process.on('uncaughtException', (err) => {
  console.error('[serve] uncaughtException:', err)
})
process.on('unhandledRejection', (err) => {
  console.error('[serve] unhandledRejection:', err)
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Sulyap static site: http://127.0.0.1:${PORT}/`)
  console.log(`Live Scan:          http://127.0.0.1:${PORT}/scan`)
  console.log(`Curator desk:       http://127.0.0.1:${PORT}/curator  (direct URL only)`)
  console.log(`API proxy:          /catalog and /media → ${API_PROXY}`)
})

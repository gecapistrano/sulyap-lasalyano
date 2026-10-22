import { CATALOG_GLB_CODES } from './catalog-glb-ids.js?v=2'

const VENDORED_GLBS = new Set(
  (Array.isArray(CATALOG_GLB_CODES) ? CATALOG_GLB_CODES : []).map(function (code) {
    return String(code || '').trim().toUpperCase()
  }),
)

function configOf() {
  if (typeof window === 'undefined') return {}
  return window.SL_SCAN_CONFIG || window.SL_KG_CONFIG || {}
}

function isLocalHall() {
  if (typeof location === 'undefined') return false
  const host = String(location.hostname || '')
  return host === '127.0.0.1' || host === 'localhost'
}

export function catalogModelSrc(modelUrl, idCode) {
  const value = typeof modelUrl === 'string' ? modelUrl.trim() : ''
  const code = String(idCode || '').trim().toUpperCase()
  if (value.startsWith('/') && !/^https?:\/\//i.test(value)) return value
  if (VENDORED_GLBS.has(code)) return `/models/catalog/${encodeURIComponent(code)}.glb`
  if (code && isLocalHall()) return `/media/models/${encodeURIComponent(code)}.glb`
  if (!value) return ''
  const cfg = configOf()
  const glbBase = String(cfg.glbBaseUrl || '').trim().replace(/\/+$/, '')
  const allowStorage = String(cfg.loadStorageModels || '').trim() === '1'
  if (glbBase) {
    const lower = value.toLowerCase()
    const marker = '/models/'
    const idx = lower.lastIndexOf(marker)
    if (idx >= 0) return glbBase + value.slice(idx)
    if (value.charAt(0) === '/') return glbBase + value
    return `${glbBase}/${value.replace(/^\/+/, '')}`
  }
  if (!allowStorage && /supabase\.(co|net)\/storage\//i.test(value)) return ''
  return value
}

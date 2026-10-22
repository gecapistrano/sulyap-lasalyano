/**
 * Runtime environment for the Next.js browser build.
 * `NEXT_PUBLIC_API_BASE_URL` — optional; when present must be https:// or http://localhost.
 * `NEXT_PUBLIC_STATIC_HOME_URL` — static hall home (Curator Desk Back).
 *
 * Important: Next.js only inlines env vars that are referenced as static
 * `process.env.NEXT_PUBLIC_*` identifiers — dynamic `process.env[name]` stays empty in the client bundle.
 */
import { assertSecureHttpUrl } from '../utils/security'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const MODEL_ASSET_BASE_URL = process.env.NEXT_PUBLIC_MODEL_ASSET_BASE_URL
const STATIC_HOME_URL = process.env.NEXT_PUBLIC_STATIC_HOME_URL
const RECOGNITION_MODE = process.env.NEXT_PUBLIC_RECOGNITION_MODE || 'local'

if (API_BASE_URL) {
  assertSecureHttpUrl(API_BASE_URL)
}

if (MODEL_ASSET_BASE_URL) {
  assertSecureHttpUrl(MODEL_ASSET_BASE_URL)
}

if (STATIC_HOME_URL) {
  assertSecureHttpUrl(STATIC_HOME_URL)
}

const resolvedApiBaseUrl = API_BASE_URL || 'https://api.example.com'
const apiLooksConfigured =
  Boolean(API_BASE_URL) && !resolvedApiBaseUrl.includes('api.example.com')

/** Default static home when Next runs locally (serve.mjs on :8765). */
const LOCAL_STATIC_HOME = 'http://127.0.0.1:8765/'

/**
 * Resolve public static-site home for Curator Desk Back.
 * Priority: `?home=` → `SL_CURATOR_CONFIG.homeUrl` → `NEXT_PUBLIC_STATIC_HOME_URL` →
 * local bridge default (`http://127.0.0.1:8765/`) → `/` on non-local hosts.
 */
export function resolveStaticHomeUrl() {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search || '')
      const fromQuery = (params.get('home') || '').trim()
      if (fromQuery) return fromQuery
    } catch {
      /* ignore */
    }
    try {
      const cfg = window.SL_CURATOR_CONFIG
      const fromCfg = typeof cfg?.homeUrl === 'string' ? cfg.homeUrl.trim() : ''
      if (fromCfg) return fromCfg
    } catch {
      /* ignore */
    }
  }

  const fromEnv = typeof STATIC_HOME_URL === 'string' ? STATIC_HOME_URL.trim() : ''
  if (fromEnv) return fromEnv

  if (typeof window !== 'undefined') {
    const host = window.location.hostname || ''
    if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
      return LOCAL_STATIC_HOME
    }
  }

  return '/'
}

/** Mark home ready (same-origin) so static index skips splash and plays in-anim. */
export function markStaticHomeReady() {
  try {
    sessionStorage.setItem('sl_home_ready', '1')
  } catch {
    /* ignore quota / private mode */
  }
}

export function goToStaticHome() {
  markStaticHomeReady()
  const url = resolveStaticHomeUrl()
  if (typeof window !== 'undefined') {
    window.location.assign(url)
  }
}

export const env = {
  apiBaseUrl: resolvedApiBaseUrl,
  apiConfigured: apiLooksConfigured,
  modelAssetBaseUrl: MODEL_ASSET_BASE_URL || '',
  staticHomeUrl: STATIC_HOME_URL || '',
  recognitionMode: RECOGNITION_MODE,
  recognitionHybridEnabled: RECOGNITION_MODE === 'hybrid' && apiLooksConfigured,
}

/**
 * Runtime environment for the Next.js browser build.
 * `NEXT_PUBLIC_API_BASE_URL` — optional; when present must be https:// or http://localhost.
 *
 * Important: Next.js only inlines env vars that are referenced as static
 * `process.env.NEXT_PUBLIC_*` identifiers — dynamic `process.env[name]` stays empty in the client bundle.
 */
import { assertSecureHttpUrl } from '../utils/security'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL
const MODEL_ASSET_BASE_URL = process.env.NEXT_PUBLIC_MODEL_ASSET_BASE_URL
const RECOGNITION_MODE = process.env.NEXT_PUBLIC_RECOGNITION_MODE || 'local'

if (API_BASE_URL) {
  assertSecureHttpUrl(API_BASE_URL)
}

if (MODEL_ASSET_BASE_URL) {
  assertSecureHttpUrl(MODEL_ASSET_BASE_URL)
}

const resolvedApiBaseUrl = API_BASE_URL || 'https://api.example.com'
const apiLooksConfigured =
  Boolean(API_BASE_URL) && !resolvedApiBaseUrl.includes('api.example.com')

export const env = {
  apiBaseUrl: resolvedApiBaseUrl,
  apiConfigured: apiLooksConfigured,
  modelAssetBaseUrl: MODEL_ASSET_BASE_URL || '',
  recognitionMode: RECOGNITION_MODE,
  recognitionHybridEnabled: RECOGNITION_MODE === 'hybrid' && apiLooksConfigured,
}

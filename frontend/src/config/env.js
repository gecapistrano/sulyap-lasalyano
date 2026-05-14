/**
 * Runtime environment for the browser build.
 * `VITE_API_BASE_URL` — optional; when present must be https:// or http://localhost for dev (see `assertSecureHttpUrl`).
 * Falls back to a placeholder so local UI can run before the real API URL is configured.
 */
import { assertSecureHttpUrl } from '../utils/security'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
const MODEL_ASSET_BASE_URL = import.meta.env.VITE_MODEL_ASSET_BASE_URL

if (API_BASE_URL) {
  assertSecureHttpUrl(API_BASE_URL)
}

if (MODEL_ASSET_BASE_URL) {
  assertSecureHttpUrl(MODEL_ASSET_BASE_URL)
}

export const env = {
  apiBaseUrl: API_BASE_URL || 'https://api.example.com',
  modelAssetBaseUrl: MODEL_ASSET_BASE_URL || '',
  recognitionMode: import.meta.env.VITE_RECOGNITION_MODE || 'local',
  recognitionHybridEnabled:
    (import.meta.env.VITE_RECOGNITION_MODE || 'local') === 'hybrid' && Boolean(API_BASE_URL),
}

/**
 * Low-level HTTP helper: same-origin cookies, JSON bodies, and CSRF header on mutating methods.
 * Keeps security-sensitive behavior in one place for review and for `security_lint.py` checks.
 */
import { assertSecureHttpUrl, sanitizeText } from '../utils/security'

function readCookie(name) {
  if (typeof document === 'undefined') return null
  const escapedName = name.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&')
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

/** Builds an absolute URL under `baseUrl` and appends query params with basic key/value sanitization. */
function buildUrl(baseUrl, path, query) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(normalizedPath, baseUrl)

  if (query && typeof query === 'object') {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      url.searchParams.set(sanitizeText(key), sanitizeText(value))
    })
  }

  return url
}

export function createSecureApiClient({ baseUrl }) {
  const parsedBaseUrl = assertSecureHttpUrl(baseUrl)

  return {
    /** `credentials: 'include'` sends HttpOnly session cookies; CSRF cookie is read for POST/PUT/PATCH/DELETE. */
    async request(path, { method = 'GET', body, query, headers = {} } = {}) {
      const url = buildUrl(parsedBaseUrl, path, query)
      const nextHeaders = {
        'Content-Type': 'application/json',
        ...headers,
      }
      const normalizedMethod = method.toUpperCase()
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
        const csrfToken = readCookie('csrf_token')
        if (csrfToken) {
          nextHeaders['X-CSRF-Token'] = csrfToken
        }
      }

      const response = await fetch(url, {
        method: normalizedMethod,
        headers: nextHeaders,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      })

      if (!response.ok) {
        let detail = ''
        try {
          const errBody = await response.json()
          detail = typeof errBody?.detail === 'string' ? errBody.detail : ''
        } catch {
          /* ignore */
        }
        throw new Error(detail || `API request failed (${response.status})`)
      }

      if (response.status === 204) return null
      return response.json()
    },

    /**
     * Multipart upload (do not set Content-Type — browser adds boundary).
     * Still sends cookies + CSRF for mutating uploads.
     */
    async upload(path, formData, { method = 'POST', query } = {}) {
      const url = buildUrl(parsedBaseUrl, path, query)
      const nextHeaders = {}
      const normalizedMethod = method.toUpperCase()
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
        const csrfToken = readCookie('csrf_token')
        if (csrfToken) {
          nextHeaders['X-CSRF-Token'] = csrfToken
        }
      }

      const response = await fetch(url, {
        method: normalizedMethod,
        headers: nextHeaders,
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        throw new Error(`API upload failed (${response.status})`)
      }
      if (response.status === 204) return null
      return response.json()
    },
  }
}

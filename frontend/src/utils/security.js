/**
 * Small, dependency-free helpers for safe strings and URL validation in the browser.
 * Used by API layer and search inputs — not a full HTML sanitizer for rich text.
 */

const HTML_SPECIALS = /[<>&"'`]/g
const HTML_ESCAPE_MAP = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
}

/** Strips control characters and escapes HTML-special characters for safe plain-text display. */
export function sanitizeText(value) {
  const input = String(value ?? '')
  const withoutControlChars = [...input]
    .filter((char) => {
      const charCode = char.charCodeAt(0)
      return charCode >= 32 && charCode !== 127
    })
    .join('')
  return withoutControlChars.replace(HTML_SPECIALS, (char) => HTML_ESCAPE_MAP[char])
}

/** Bounds browse/search input length and returns a sanitized copy. */
export function validateSearchQuery(value, { maxLength = 80 } = {}) {
  const sanitized = sanitizeText(value).trim()
  return {
    sanitized,
    isValid: sanitized.length <= maxLength,
  }
}

/** Ensures API base URLs are https (or http localhost in dev). Throws before `fetch` if misconfigured. */
export function assertSecureHttpUrl(value, { allowHttpLocalhost = true } = {}) {
  const url = new URL(value)
  const isHttps = url.protocol === 'https:'
  const isAllowedLocalhost =
    allowHttpLocalhost &&
    url.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(url.hostname)

  if (!isHttps && !isAllowedLocalhost) {
    throw new Error(`Insecure URL blocked: ${url.href}`)
  }

  return url
}

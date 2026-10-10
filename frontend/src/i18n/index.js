import { LANGUAGE_OPTIONS, MESSAGES, languageToCode } from './messages'

export { LANGUAGE_OPTIONS, languageToCode }

const STORAGE_KEY = 'sl_language'

export function normalizeLanguage(value) {
  if (typeof value !== 'string') return 'English'
  return MESSAGES[value] ? value : 'English'
}

export function loadStoredLanguage() {
  try {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY) || 'English')
  } catch {
    return 'English'
  }
}

export function persistLanguage(language) {
  try {
    localStorage.setItem(STORAGE_KEY, normalizeLanguage(language))
  } catch {
    // ignore quota / private mode
  }
}

/**
 * Translate a UI key. Supports `{name}` placeholders.
 * @param {string} language
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 */
export function t(language, key, vars = {}) {
  const lang = normalizeLanguage(language)
  const table = MESSAGES[lang] || MESSAGES.English
  let text = table[key] ?? MESSAGES.English[key] ?? key
  Object.entries(vars).forEach(([name, value]) => {
    text = text.replaceAll(`{${name}}`, String(value))
  })
  return text
}

function cacheKey(langCode, text) {
  return `sl_tr_${langCode}_${hashText(text)}`
}

function hashText(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(36)
}

/**
 * Free MyMemory translation for long/dynamic catalog copy.
 * Cached in sessionStorage. Falls back to original text on failure.
 */
export async function translateDynamicText(text, language) {
  const source = String(text ?? '').trim()
  if (!source) return ''
  const lang = normalizeLanguage(language)
  const target = languageToCode(lang)
  if (target === 'en') return source

  const key = cacheKey(target, source)
  try {
    const cached = sessionStorage.getItem(key)
    if (cached) return cached
  } catch {
    // continue
  }

  // MyMemory free tier: ~1000 chars per request
  const chunk = source.slice(0, 900)
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=en|${encodeURIComponent(target)}`
  try {
    const res = await fetch(url)
    if (!res.ok) return source
    const data = await res.json()
    const translated = data?.responseData?.translatedText
    if (typeof translated !== 'string' || !translated.trim()) return source
    const out = source.length > 900 ? `${translated}…` : translated
    try {
      sessionStorage.setItem(key, out)
    } catch {
      // ignore
    }
    return out
  } catch {
    return source
  }
}

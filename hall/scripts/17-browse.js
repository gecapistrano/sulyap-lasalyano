/**
 * Home marquee browse — live catalog presidents (same source as Scan / KG).
 * Falls back to the static HTML portraits when the catalog is unreachable.
 */
import { slugifyPresident, shortPresidentLabel } from './catalog-graph.mjs?v=3'

const PHOTO_V = '3'
/** Hall portraits on disk. Catalog rows without a photo stay off the marquee. */
const HALL_PORTRAITS = new Set([
  'br-inigo',
  'br-andrew',
  'br-armin',
  'br-donato',
  'br-gus',
  'br-mawel',
  'br-rolly',
  'br-sockie',
  'dr-quebengco',
])

function catalogPrefix() {
  const cfg = window.SL_SCAN_CONFIG || window.SL_KG_CONFIG || {}
  const base = String(cfg.apiBaseUrl || '').trim().replace(/\/+$/, '')
  if (!base || base.includes('api.example.com')) return ''
  try {
    const u = new URL(base)
    if (u.protocol !== 'https:' && u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') {
      return ''
    }
    return base
  } catch {
    return ''
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function termStart(service) {
  const match = String(service || '').match(/(\d{4})/)
  return match ? Number(match[1]) : 9999
}

function portraitSrc(row, slug) {
  const url = String(row && row.photo_url ? row.photo_url : '').trim()
  if (/^https?:\/\//i.test(url)) return url
  return `assets/presidents/${slug}.jpg?v=${PHOTO_V}`
}

function hasPortrait(row) {
  const url = String(row && row.photo_url ? row.photo_url : '').trim()
  if (/^https?:\/\//i.test(url)) return true
  return HALL_PORTRAITS.has(slugifyPresident(row && row.name))
}

function cardHtml(row, hidden) {
  const slug = slugifyPresident(row.name)
  const label = shortPresidentLabel(row.name, slug)
  const src = portraitSrc(row, slug)
  const tab = hidden ? ' tabindex="-1"' : ''
  return (
    `<a class="marquee-item" href="president.html?id=${encodeURIComponent(slug)}"${tab}>` +
    `<img src="${escapeHtml(src)}" alt="" width="160" height="160" decoding="async" ` +
    `onerror="this.onerror=null;this.src='assets/presidents/${escapeHtml(slug)}.jpg?v=${PHOTO_V}'">` +
    `<span class="marquee-name">${escapeHtml(label)}</span>` +
    `</a>`
  )
}

function fillSet(el, rows, hidden) {
  if (!el) return
  el.innerHTML = rows.map((row) => cardHtml(row, hidden)).join('')
}

async function loadPresidents() {
  const res = await fetch(`${catalogPrefix()}/catalog/presidents`, {
    credentials: 'omit',
    mode: 'cors',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('catalog http')
  const rows = await res.json()
  if (!Array.isArray(rows) || !rows.length) throw new Error('empty')
  const withPhotos = rows.filter(hasPortrait)
  if (!withPhotos.length) throw new Error('no portraits')
  return withPhotos.sort((a, b) => termStart(a.service) - termStart(b.service))
}

loadPresidents()
  .then((rows) => {
    const sets = document.querySelectorAll('#marqueeTrack .marquee-set')
    if (!sets.length) return
    fillSet(sets[0], rows, false)
    for (let i = 1; i < sets.length; i += 1) fillSet(sets[i], rows, true)
  })
  .catch(() => {
    /* Keep the static hall portraits. */
  })

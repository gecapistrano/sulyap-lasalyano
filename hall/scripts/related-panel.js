/**
 * Shared artifact-sheet helpers: owner portrait, tag headings, related chips.
 * Tags are display-only; sibling artifacts under each tag are clickable.
 */
import { presidentPortraitSrc as hallPortraitSrc, shortPresidentLabel } from './catalog-graph.mjs?v=5'

export const RELATED_LIMIT = 5

const KIND_ORDER = {
  year: 0,
  owner: 1,
  type: 2,
  country: 3,
  theme: 4,
  manual: 5,
}

function text(value) {
  return String(value == null ? '' : value).trim()
}

export function slugifyTag(label) {
  return text(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
}

export function presidentPortraitSrc(name) {
  return hallPortraitSrc(name)
}

export function normalizeTags(raw) {
  var out = []
  var seen = Object.create(null)
  if (!Array.isArray(raw)) return out
  for (var i = 0; i < raw.length; i++) {
    var tag = raw[i]
    if (!tag) continue
    var label = ''
    var slug = ''
    var kind = 'theme'
    if (typeof tag === 'string') {
      label = text(tag)
      slug = slugifyTag(label)
    } else {
      label = text(tag.label || tag.name || tag.slug)
      slug = text(tag.slug) || slugifyTag(label)
      kind = text(tag.kind) || 'theme'
    }
    if (!label || !slug || seen[slug]) continue
    seen[slug] = true
    out.push({ slug: slug, label: label, kind: kind })
  }
  return out
}

export function catalogItem(row) {
  if (!row || typeof row !== 'object') return null
  var code = text(row.rdCode || row.id_code || row.rd_code || row.code).toUpperCase()
  if (!code) return null
  return {
    code: code,
    title: text(row.name || row.title || row.label) || code,
    description: text(row.description),
    owner: text(row.owner || row.owner_name),
    year: text(row.year || row.year_acquired),
    type: text(row.type || row.artifact_type || row.category),
    country: text(row.country || row.country_of_origin || row.place),
    subtitle: text(row.subtitle),
    tags: row.tags,
  }
}

function pushTag(list, seen, label, kind) {
  var value = text(label)
  if (!value) return
  if (kind === 'year' && !/^(19|20)\d{2}$/.test(value)) return
  var slug = slugifyTag(value)
  if (!slug || seen[slug]) return
  seen[slug] = true
  list.push({ slug: slug, label: value, kind: kind || 'theme' })
}

function yearsFromItem(item) {
  var blob = [item.year, item.title, item.description].join(' ')
  return blob.match(/\b(?:19|20)\d{2}\b/g) || []
}

function typeFromTitle(item) {
  if (text(item.type)) return text(item.type)
  var title = (item.title || '').toLowerCase()
  var kinds = [
    ['letter opener', 'letter opener'],
    ['paperweight', 'paperweight'],
    ['medallion', 'medallion'],
    ['incense', 'incense burner'],
    ['candle holder', 'candle holder'],
    ['medal', 'medal'],
    ['coin', 'coin'],
    ['plate', 'plate'],
    ['vase', 'vase'],
    ['fan', 'fan'],
    ['clock', 'clock'],
    ['doll', 'doll'],
    ['mug', 'mug']
  ]
  var i
  for (i = 0; i < kinds.length; i++) {
    if (title.indexOf(kinds[i][0]) !== -1) return kinds[i][1]
  }
  return ''
}

export function tagsForItem(row) {
  var item = catalogItem(row) || row
  if (!item) return []
  var tags = normalizeTags(item.tags).filter(function (tag) {
    return tag.kind !== 'year' || /^(19|20)\d{2}$/.test(tag.label)
  })
  var seen = Object.create(null)
  var i
  for (i = 0; i < tags.length; i++) seen[tags[i].slug] = true
  var years = yearsFromItem(item)
  for (i = 0; i < years.length; i++) pushTag(tags, seen, years[i], 'year')
  pushTag(tags, seen, item.owner, 'owner')
  pushTag(tags, seen, typeFromTitle(item), 'type')
  pushTag(tags, seen, item.country, 'country')
  pushTag(tags, seen, item.subtitle, 'theme')
  tags.sort(function (a, b) {
    var da = KIND_ORDER[a.kind] == null ? 8 : KIND_ORDER[a.kind]
    var db = KIND_ORDER[b.kind] == null ? 8 : KIND_ORDER[b.kind]
    if (da !== db) return da - db
    return a.label.localeCompare(b.label)
  })
  return tags
}

export function headingForTag(tag, t) {
  var translate = t || function (_k, fallback) { return fallback }
  var kind = text(tag && tag.kind).toLowerCase()
  var label = text(tag && tag.label)
  if (kind === 'year') {
    return translate('scan.relatedYear', 'Acquired from year {year}:').replace('{year}', label)
  }
  if (kind === 'owner') {
    return translate('scan.relatedOwner', 'From {name}:').replace('{name}', shortPresidentLabel(label))
  }
  if (kind === 'type') {
    var article = /^[aeiou]/i.test(label) ? 'An' : 'A'
    return translate('scan.relatedType', '{article} {type}:')
      .replace('{article}', article)
      .replace('{type}', label.toLowerCase())
  }
  if (kind === 'country') {
    return translate('scan.relatedCountry', 'From {place}:').replace('{place}', label)
  }
  return translate('scan.relatedTheme', '{label}:').replace('{label}', label.replace(/:$/, ''))
}

function itemHasTag(item, tag) {
  if (!item || !tag) return false
  var slug = text(tag.slug) || slugifyTag(tag.label)
  var label = text(tag.label).toLowerCase()
  var kind = text(tag.kind).toLowerCase()
  var own = tagsForItem(item)
  var i
  for (i = 0; i < own.length; i++) {
    if (slug && own[i].slug === slug) return true
    if (label && text(own[i].label).toLowerCase() === label) return true
  }
  if (kind === 'year') {
    var years = yearsFromItem(item)
    for (i = 0; i < years.length; i++) {
      if (years[i].toLowerCase() === label || slugifyTag(years[i]) === slug) return true
    }
  }
  if (kind === 'type') {
    var inferred = typeFromTitle(item)
    if (inferred && (slugifyTag(inferred) === slug || inferred.toLowerCase() === label)) return true
  }
  var fields = [item.year, item.owner, item.type, item.country, item.subtitle]
  for (i = 0; i < fields.length; i++) {
    var value = text(fields[i])
    if (!value) continue
    if (slug && slugifyTag(value) === slug) return true
    if (label && value.toLowerCase() === label) return true
  }
  return false
}

export function relatedGroups(source, catalog, t, limit) {
  var current = catalogItem(source)
  if (!current) return []
  var cap = Math.max(3, Math.min(5, Number(limit) || RELATED_LIMIT))
  var pool = []
  var seenCode = Object.create(null)
  var rows = Array.isArray(catalog) ? catalog : []
  var i
  for (i = 0; i < rows.length; i++) {
    var mapped = catalogItem(rows[i])
    if (!mapped || mapped.code === current.code || seenCode[mapped.code]) continue
    seenCode[mapped.code] = true
    pool.push(mapped)
  }
  pool.sort(function (a, b) { return a.code.localeCompare(b.code) })
  var tags = tagsForItem(current)
  var groups = []
  for (i = 0; i < tags.length; i++) {
    var tag = tags[i]
    var items = []
    var j
    for (j = 0; j < pool.length; j++) {
      if (!itemHasTag(pool[j], tag)) continue
      items.push({ code: pool[j].code, title: pool[j].title })
      if (items.length >= cap) break
    }
    if (!items.length) continue
    groups.push({
      tag: tag,
      heading: headingForTag(tag, t),
      items: items,
    })
  }
  return groups
}

function setPortrait(img, owner, alt) {
  if (!img) return
  var src = presidentPortraitSrc(owner)
  if (!src || !owner) {
    img.hidden = true
    img.removeAttribute('src')
    img.alt = ''
    return
  }
  img.hidden = false
  img.alt = alt || owner
  img.onerror = function () {
    img.hidden = true
    img.removeAttribute('src')
  }
  img.src = src
}

export function paintOwnerYear(opts) {
  var t = opts.t || function (_k, fallback) { return fallback }
  var owner = text(opts.owner)
  var year = text(opts.year)
  if (!/^(19|20)\d{2}$/.test(year)) {
    var yearHits = [opts.title, opts.description, year].join(' ').match(/\b(?:19|20)\d{2}\b/g)
    year = (yearHits && yearHits[0]) || ''
  }
  var presEl = opts.presEl
  var yearEl = opts.yearEl
  var photoEl = opts.photoEl
  var wrapEl = opts.wrapEl
  if (presEl) {
    presEl.textContent = owner
    presEl.hidden = !owner
  }
  if (yearEl) {
    yearEl.replaceChildren()
    if (year) {
      var kicker = document.createElement('span')
      kicker.className = 'sheet-owner__kicker'
      kicker.textContent = t('scan.yearAcquired', 'Year acquired')
      var value = document.createElement('span')
      value.className = 'sheet-owner__year-value'
      value.textContent = year
      yearEl.appendChild(kicker)
      yearEl.appendChild(value)
    }
    yearEl.hidden = !year
  }
  setPortrait(photoEl, owner, owner)
  if (wrapEl) wrapEl.hidden = !owner && !year
}

export function renderRelatedSection(host, opts) {
  if (!host) return
  var t = (opts && opts.t) || function (_k, fallback) { return fallback }
  var code = text(opts && opts.code).toUpperCase()
  var groups = (opts && opts.groups) || []
  var onOpen = (opts && opts.onOpen) || function () {}
  host.replaceChildren()
  if (!code || !groups.length) {
    host.hidden = true
    return
  }
  host.hidden = false
  var title = document.createElement('h3')
  title.className = 'sheet-related__title'
  title.textContent = t('scan.relatedTo', 'Related to {code}').replace('{code}', code)
  host.appendChild(title)
  for (var i = 0; i < groups.length; i++) {
    var group = groups[i]
    var block = document.createElement('div')
    block.className = 'sheet-related__group'
    var label = document.createElement('p')
    label.className = 'sheet-related__label'
    label.textContent = group.heading
    block.appendChild(label)
    var list = document.createElement('div')
    list.className = 'sheet-related__list'
    var items = group.items || []
    for (var j = 0; j < items.length; j++) {
      var item = items[j]
      var btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'sheet-related__item'
      btn.setAttribute('data-code', item.code)
      var codeEl = document.createElement('strong')
      codeEl.textContent = item.code
      var nameEl = document.createElement('span')
      nameEl.textContent = item.title
      btn.appendChild(codeEl)
      btn.appendChild(nameEl)
      btn.addEventListener('click', (function (nextCode) {
        return function (ev) {
          ev.preventDefault()
          onOpen(nextCode)
        }
      })(item.code))
      list.appendChild(btn)
    }
    block.appendChild(list)
    host.appendChild(block)
  }
}

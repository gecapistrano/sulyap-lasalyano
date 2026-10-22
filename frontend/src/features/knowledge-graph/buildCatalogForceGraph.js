/**
 * Catalog → Knowledge Graph transform.
 * Catalog graph for the public site.
 *
 * Input: public GET `/catalog/presidents` + `/catalog/artifacts` (same source
 * Browse and Scan use). Output: `{ nodes, links }` for the 3D / 2D KG.
 */

export const CATALOG_GRAPH_LIMIT = 2000

/** Accession prefix → canonical president name (must match catalog rows). Longest prefix first. */
export const OWNER_BY_PREFIX = {
  RDI: 'Br. Rolando V. Dizon, FSC',
  RD: 'Br. Rafael S. Donato, FSC',
  XAG: 'Br. Andrew B. Gonzalez, FSC',
  AG: 'Br. Andrew B. Gonzalez, FSC',
  AB: 'Br. Gus Boquer, FSC',
  FDR: 'Br. Francisco "Sockie" dela Rosa VI, FSC',
  IR: 'Br. Iñigo Riola, FSC',
}

const KNOWN_SLUGS = {
  'br. rafael s. donato, fsc': 'br-donato',
  'br. gus boquer, fsc': 'br-gus',
  'br. andrew b. gonzalez, fsc': 'br-andrew',
  'br. andrew b. gonzales, fsc': 'br-andrew',
  'br. rolando v. dizon, fsc': 'br-rolly',
  'br. armin a. luistro, fsc': 'br-armin',
  'dr. carmelita r. quebengco': 'dr-quebengco',
  'br. geminiano m. buenaventura, fsc': 'br-mawel',
  'br. francisco "sockie" dela rosa vi, fsc': 'br-sockie',
  'br. francisco sockie dela rosa vi, fsc': 'br-sockie',
  'br. iñigo riola, fsc': 'br-inigo',
  'br. inigo riola, fsc': 'br-inigo',
}

const KNOWN_SHORT = {
  'br-inigo': 'Br. Iñigo',
  'br-andrew': 'Br. Andrew',
  'br-armin': 'Br. Armin',
  'br-donato': 'Br. Donato',
  'br-gus': 'Br. Gus',
  'br-mawel': 'Br. Mawel',
  'br-rolly': 'Br. Rolly',
  'br-sockie': 'Br. Sockie',
  'dr-quebengco': 'Dr. Quebengco',
}

function text(value) {
  return String(value ?? '').trim()
}

function pick(row, keys) {
  if (!row || typeof row !== 'object') return ''
  for (const key of keys) {
    const value = row[key]
    if (value != null && String(value).trim() !== '') return value
  }
  return ''
}

function normalizeName(value) {
  return text(value)
    .toLowerCase()
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, ' ')
}

export function normalizeIdCode(value) {
  return text(value).toUpperCase().replace(/\s+/g, '')
}

export function prefixFromIdCode(value) {
  const match = normalizeIdCode(value).match(/^([A-Z]{1,4})\d{1,4}$/)
  return match ? match[1] : ''
}

export function ownerForIdCode(value) {
  const prefix = prefixFromIdCode(value)
  if (!prefix) return ''
  if (OWNER_BY_PREFIX[prefix]) return OWNER_BY_PREFIX[prefix]
  const known = Object.keys(OWNER_BY_PREFIX).sort((a, b) => b.length - a.length)
  for (const key of known) {
    if (prefix === key || (prefix.length > key.length && prefix.startsWith(key))) {
      const longerConflict = known.some(
        (other) => other !== key && prefix.startsWith(other) && other.length > key.length,
      )
      if (longerConflict) continue
      return OWNER_BY_PREFIX[key]
    }
  }
  return ''
}

function parseService(service) {
  const raw = text(service)
  const parts = raw.split(/\s*[-–—]\s*/)
  const start = (parts[0] || '').replace(/[^\d]/g, '')
  const end = text(parts[1] || '')
  return { termStart: start, termEnd: end }
}

function asciiSlugPart(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

export function slugifyPresident(name) {
  const known = KNOWN_SLUGS[normalizeName(name)]
  if (known) return known
  const raw = text(name)
  const isDr = /^(Dr\.)/i.test(raw)
  const cleaned = raw.replace(/,?\s*FSC\.?$/i, '').replace(/^(Br\.|Bro\.|Brother|Dr\.)\s+/i, '')
  const bits = cleaned.split(/\s+/).filter(Boolean)
  const last = asciiSlugPart(bits[bits.length - 1] || cleaned || 'president') || 'president'
  return `${isDr ? 'dr' : 'br'}-${last}`
}

function shortLabelFor(name, slug) {
  if (KNOWN_SHORT[slug]) return KNOWN_SHORT[slug]
  const raw = text(name).replace(/,?\s*FSC\.?$/i, '')
  const isDr = /^(Dr\.)/i.test(raw)
  const rest = raw.replace(/^(Br\.|Bro\.|Brother|Dr\.)\s+/i, '')
  const parts = rest.split(/\s+/).filter(Boolean)
  const last = parts[parts.length - 1] || rest || 'President'
  return `${isDr ? 'Dr.' : 'Br.'} ${last}`
}

function slugifyFacet(label) {
  return (
    text(label)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  )
}

function tagList(row) {
  if (!Array.isArray(row?.tags)) return []
  return row.tags
    .map((tag) => {
      if (typeof tag === 'string') return { label: text(tag), kind: '' }
      return { label: text(tag?.label), kind: text(tag?.kind) }
    })
    .filter((tag) => tag.label)
}

export function resolveCatalogMediaUrl(pathOrUrl, apiBase) {
  const value = text(pathOrUrl)
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const base = text(apiBase).replace(/\/+$/, '')
  if (!base) return value.startsWith('/') ? value : `/${value}`
  if (value.startsWith('/')) return `${base}${value}`
  return `${base}/${value}`
}

function presidentNodeId(row, slug) {
  const id = row?.id
  if (id != null && id !== '' && Number.isFinite(Number(id))) return `pres:${Number(id)}`
  return `pres:${slug}`
}

function resolvePresidentNode(art, byCatalogId, byName) {
  const pid = art?.president_id ?? art?.presidentId
  if (pid != null && pid !== '') {
    const hit = byCatalogId.get(Number(pid))
    if (hit) return hit
  }
  const owner = pick(art, ['owner_name', 'ownerName', 'owner'])
  if (owner) {
    const hit = byName.get(normalizeName(owner))
    if (hit) return hit
  }
  const code = pick(art, ['id_code', 'idCode', 'rd_code', 'rdCode'])
  const fromPrefix = ownerForIdCode(code)
  if (fromPrefix) {
    const hit = byName.get(normalizeName(fromPrefix))
    if (hit) return hit
  }
  return null
}

/**
 * @param {object[]} presidentsInput Catalog presidents (snake_case or mapped)
 * @param {object[]} artifactsInput Catalog artifacts (snake_case or mapped)
 * @param {{ apiBase?: string }} [options]
 */
export function buildCatalogGraph(presidentsInput, artifactsInput, options = {}) {
  const apiBase = text(options.apiBase)
  const presidents = Array.isArray(presidentsInput) ? presidentsInput.filter(Boolean) : []
  const artifacts = Array.isArray(artifactsInput) ? artifactsInput.filter(Boolean) : []

  const nodes = [
    {
      id: 'col:aea-irc',
      type: 'collection',
      label: "Presidents' Memorabilia, AEA-IRC",
      name: "Presidents' Memorabilia",
      place: 'AEA-IRC',
    },
  ]
  const links = []
  const byCatalogId = new Map()
  const byName = new Map()
  const presidentNodes = []

  const ordered = presidents.slice().sort((a, b) => {
    const startA = Number(parseService(a.service).termStart) || 0
    const startB = Number(parseService(b.service).termStart) || 0
    if (startA !== startB) return startA - startB
    return Number(a.id || 0) - Number(b.id || 0)
  })

  for (const row of ordered) {
    const slug = slugifyPresident(row.name)
    const nodeId = presidentNodeId(row, slug)
    const { termStart, termEnd } = parseService(row.service)
    const node = {
      id: nodeId,
      type: 'president',
      label: text(row.name),
      displayName: text(row.name),
      shortLabel: shortLabelFor(row.name, slug),
      slug,
      termStart,
      termEnd,
      photo: resolveCatalogMediaUrl(pick(row, ['photo_url', 'photoUrl', 'photo']), apiBase),
      catalogId: row.id ?? null,
    }
    nodes.push(node)
    presidentNodes.push(node)
    if (row.id != null && row.id !== '') byCatalogId.set(Number(row.id), node)
    if (row.name) byName.set(normalizeName(row.name), node)
    links.push({ source: 'col:aea-irc', target: nodeId, relation: 'houses' })
  }

  for (let i = 0; i < presidentNodes.length - 1; i += 1) {
    links.push({
      source: presidentNodes[i].id,
      target: presidentNodes[i + 1].id,
      relation: 'succeeded by',
    })
  }

  const facets = {
    category: new Map(),
    era: new Map(),
    place: new Map(),
    event: new Map(),
  }

  function ensureFacet(type, label) {
    const key = slugifyFacet(label)
    const existing = facets[type].get(key)
    if (existing) return existing
    const node = {
      id: `${type.slice(0, 3)}:${key}`,
      type,
      label: text(label),
      name: text(label),
    }
    nodes.push(node)
    facets[type].set(key, node)
    return node
  }

  const seenArt = new Set()
  for (const art of artifacts) {
    const code = normalizeIdCode(pick(art, ['id_code', 'idCode', 'rd_code', 'rdCode']))
    const fallbackId = art.id != null ? String(art.id) : ''
    const artId = `art:${code || fallbackId}`
    if (!code && !fallbackId) continue
    if (seenArt.has(artId)) continue
    seenArt.add(artId)

    const pres = resolvePresidentNode(art, byCatalogId, byName)
    const title = text(pick(art, ['title', 'name', 'label'])) || code || 'Artifact'
    const year = text(pick(art, ['year_acquired', 'yearAcquired', 'year']))
    const category = text(pick(art, ['artifact_type', 'artifactType', 'category']))
    const place = text(pick(art, ['country_of_origin', 'countryOfOrigin', 'place']))
    const model = pick(art, ['model_url', 'modelUrl', 'modelFile', 'glb', 'model'])
    const image = pick(art, ['image_url', 'imageUrl', 'image'])
    let event = text(pick(art, ['event']))
    for (const tag of tagList(art)) {
      if ((tag.kind === 'event' || tag.kind === 'place') && tag.kind === 'event' && !event) {
        event = tag.label
      }
    }

    nodes.push({
      id: artId,
      type: 'artifact',
      label: title,
      rdCode: code,
      name: title,
      presidentId: pres ? pres.id : '',
      year,
      category,
      event,
      givenBy: '',
      place,
      description: text(pick(art, ['description'])),
      image: resolveCatalogMediaUrl(image, apiBase),
      modelFile: resolveCatalogMediaUrl(model, apiBase),
    })

    links.push({
      source: pres ? pres.id : 'col:aea-irc',
      target: artId,
      relation: 'received',
    })

    if (category) {
      links.push({ source: artId, target: ensureFacet('category', category).id, relation: 'in category' })
    }
    if (year && year !== '\u2014' && year !== '-') {
      links.push({ source: artId, target: ensureFacet('era', year).id, relation: 'in era' })
    }
    if (place) {
      links.push({ source: artId, target: ensureFacet('place', place).id, relation: 'located at' })
    }
    if (event) {
      links.push({ source: artId, target: ensureFacet('event', event).id, relation: 'at event' })
    }
  }

  return { nodes, links }
}

export function summarizeGraph(graph) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : []
  const counts = {}
  for (const node of nodes) {
    const type = node?.type || 'unknown'
    counts[type] = (counts[type] || 0) + 1
  }
  return {
    nodeCount: nodes.length,
    linkCount: Array.isArray(graph?.links) ? graph.links.length : 0,
    counts,
  }
}

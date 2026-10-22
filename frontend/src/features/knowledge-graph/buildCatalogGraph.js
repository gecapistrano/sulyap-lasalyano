/**
 * Build Knowledge Graph nodes/links from the public catalog
 * (`GET /catalog/presidents` + `GET /catalog/artifacts`).
 *
 * Clustering order for each published artifact:
 *   1. president_id
 *   2. owner_name matching a catalog president (gallery aliases skipped)
 *   3. accession prefix (RD, RDI, AB, …) mapped to a president
 *   4. leftover owner / prefix cluster
 *   5. unlinked
 *
 * Prefix map must stay aligned with `backend/app/services/id_codes.py`.
 */

/** @type {Record<string, string>} */
export const OWNER_BY_PREFIX = {
  RDI: 'Br. Rolando V. Dizon, FSC',
  RD: 'Br. Rafael S. Donato, FSC',
  XAG: 'Br. Andrew B. Gonzalez, FSC',
  AG: 'Br. Andrew B. Gonzalez, FSC',
  AB: 'Br. Gus Boquer, FSC',
  FDR: 'Br. Francisco "Sockie" dela Rosa VI, FSC',
  IR: 'Br. Iñigo Riola, FSC',
}

const GALLERY_OWNER_ALIASES = new Set([
  "dlsu-d presidents' gallery",
  'dlsu-d presidents gallery',
  "su-d presidents' gallery",
  'su-d presidents gallery',
  "presidents' gallery",
  'presidents gallery',
])

export function normalizeName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isGalleryOwnerLabel(value) {
  return GALLERY_OWNER_ALIASES.has(normalizeName(value))
}

export function prefixFromIdCode(value) {
  const code = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  const match = code.match(/^([A-Z]{1,4})\d{1,4}$/)
  return match ? match[1] : ''
}

export function ownerForIdCode(value) {
  const prefix = prefixFromIdCode(value)
  if (!prefix) return { prefix: '', owner: '' }
  if (OWNER_BY_PREFIX[prefix]) return { prefix, owner: OWNER_BY_PREFIX[prefix] }
  const keys = Object.keys(OWNER_BY_PREFIX).sort((a, b) => b.length - a.length)
  for (const known of keys) {
    if (prefix === known || prefix.startsWith(known)) {
      const longerConflict = keys.some(
        (other) => other !== known && prefix.startsWith(other) && other.length > known.length,
      )
      if (longerConflict) continue
      return { prefix: known, owner: OWNER_BY_PREFIX[known] }
    }
  }
  return { prefix, owner: '' }
}

function asArtifact(row) {
  if (!row || typeof row !== 'object') return null
  const idCode = String(row.idCode || row.rdCode || row.id_code || row.rd_code || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
  const presidentRaw = row.presidentId ?? row.president_id ?? null
  const presidentId = presidentRaw == null || presidentRaw === '' ? null : Number(presidentRaw)
  return {
    id: row.id,
    idCode,
    name: String(row.name || row.title || '').trim(),
    owner: String(row.owner || row.owner_name || '').trim(),
    year: String(row.year || row.yearAcquired || row.year_acquired || '').trim(),
    presidentId: Number.isFinite(presidentId) ? presidentId : null,
    icon: String(row.icon || '').trim(),
  }
}

function asPresident(row) {
  if (!row || typeof row !== 'object' || row.id == null) return null
  const id = Number(row.id)
  if (!Number.isFinite(id)) return null
  return {
    id,
    name: String(row.name || '').trim() || `President ${id}`,
    service: String(row.service || '').trim(),
    icon: String(row.icon || '').trim(),
  }
}

function shortPresidentLabel(name) {
  const raw = String(name || '')
    .replace(/,?\s*FSC\.?$/i, '')
    .trim()
  const quoted = raw.match(/"([^"]+)"/)
  if (quoted) return quoted[1]
  const parts = raw.split(/\s+/).filter(Boolean)
  return parts[parts.length - 1] || raw
}

function clipLabel(value, max) {
  const text = String(value || '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(1, max - 1))}…`
}

function placeAround(cx, cy, count, baseR, gap) {
  if (count <= 0) return []
  const perRing = Math.max(8, Math.floor((2 * Math.PI * baseR) / gap))
  const out = []
  for (let i = 0; i < count; i += 1) {
    const ring = Math.floor(i / perRing)
    const idx = i % perRing
    const nThis = Math.min(perRing, count - ring * perRing)
    const r = baseR + ring * gap
    const ang = (idx / nThis) * Math.PI * 2 - Math.PI / 2
    out.push({ x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r })
  }
  return out
}

/**
 * @param {unknown[]} presidents
 * @param {unknown[]} artifacts
 * @param {{ unlinkedLabel?: string }} [opts]
 */
export function buildCatalogGraph(presidents = [], artifacts = [], opts = {}) {
  const unlinkedLabel = opts.unlinkedLabel || 'Unlinked memorabilia'
  const presidentRows = (Array.isArray(presidents) ? presidents : []).map(asPresident).filter(Boolean)
  const artifactRows = (Array.isArray(artifacts) ? artifacts : []).map(asArtifact).filter(Boolean)

  const presidentsById = new Map(presidentRows.map((p) => [p.id, p]))
  const presidentsByName = new Map()
  for (const p of presidentRows) {
    const key = normalizeName(p.name)
    if (key && !presidentsByName.has(key)) presidentsByName.set(key, p)
  }

  const hubs = presidentRows.map((p) => ({
    key: `p-${p.id}`,
    type: 'president',
    label: p.name,
    president: p,
    artifacts: [],
  }))
  const hubByKey = new Map(hubs.map((h) => [h.key, h]))
  const extraHubs = new Map()

  function extraHub(key, type, label) {
    if (hubByKey.has(key)) return hubByKey.get(key)
    if (extraHubs.has(key)) return extraHubs.get(key)
    const hub = { key, type, label, president: null, artifacts: [] }
    extraHubs.set(key, hub)
    return hub
  }

  function resolveHub(art) {
    if (art.presidentId != null && presidentsById.has(art.presidentId)) {
      return hubByKey.get(`p-${art.presidentId}`)
    }
    if (art.owner && !isGalleryOwnerLabel(art.owner)) {
      const byOwner = presidentsByName.get(normalizeName(art.owner))
      if (byOwner) return hubByKey.get(`p-${byOwner.id}`)
    }
    const accession = ownerForIdCode(art.idCode)
    if (accession.owner) {
      const byPrefix = presidentsByName.get(normalizeName(accession.owner))
      if (byPrefix) return hubByKey.get(`p-${byPrefix.id}`)
      return extraHub(`owner-${normalizeName(accession.owner)}`, 'cluster', accession.owner)
    }
    if (art.owner) {
      return extraHub(`owner-${normalizeName(art.owner)}`, 'cluster', art.owner)
    }
    if (accession.prefix) {
      return extraHub(`prefix-${accession.prefix}`, 'cluster', accession.prefix)
    }
    return extraHub('unlinked', 'cluster', unlinkedLabel)
  }

  for (const art of artifactRows) {
    const hub = resolveHub(art)
    if (hub) hub.artifacts.push(art)
  }

  const allHubs = [...hubs, ...extraHubs.values()]
  const maxArts = allHubs.reduce((m, h) => Math.max(m, h.artifacts.length), 0)
  const rings = Math.max(1, Math.ceil(maxArts / 14) || 1)
  const leafR = 16
  const leafGap = 42
  const baseOrbit = 88
  const hubSpread = Math.max(260, 150 + rings * 78, allHubs.length * 26)
  const cx = 0
  const cy = 0
  const hubPos =
    allHubs.length <= 1
      ? [{ x: cx, y: cy }]
      : allHubs.map((_, i) => {
          const ang = (i / allHubs.length) * Math.PI * 2 - Math.PI / 2
          return { x: cx + Math.cos(ang) * hubSpread, y: cy + Math.sin(ang) * hubSpread }
        })

  const nodes = []
  const links = []

  allHubs.forEach((hub, i) => {
    const pos = hubPos[i]
    const isPresident = hub.type === 'president'
    const node = {
      id: hub.key,
      type: isPresident ? 'president' : 'cluster',
      x: pos.x,
      y: pos.y,
      r: isPresident ? 28 : 24,
      label: clipLabel(isPresident ? shortPresidentLabel(hub.label) : hub.label, 14),
      title: hub.label,
      service: hub.president?.service || '',
      presidentId: hub.president?.id ?? null,
      childCount: hub.artifacts.length,
    }
    nodes.push(node)

    const orbit = placeAround(pos.x, pos.y, hub.artifacts.length, baseOrbit, leafGap)
    hub.artifacts.forEach((art, j) => {
      const at = orbit[j]
      const artId = `a-${art.id ?? art.idCode ?? `${hub.key}-${j}`}`
      nodes.push({
        id: artId,
        type: 'artifact',
        x: at.x,
        y: at.y,
        r: leafR,
        label: clipLabel(art.idCode || art.name || '•', 10),
        title: art.name || art.idCode || 'Artifact',
        idCode: art.idCode,
        owner: art.owner,
        year: art.year,
        artifactId: art.id ?? null,
        presidentId: hub.president?.id ?? art.presidentId,
      })
      links.push({ from: artId, to: hub.key })
    })
  })

  let width = 960
  let height = 640
  if (nodes.length) {
    const pad = 96
    const minX = Math.min(...nodes.map((n) => n.x - n.r))
    const minY = Math.min(...nodes.map((n) => n.y - n.r))
    const maxX = Math.max(...nodes.map((n) => n.x + n.r))
    const maxY = Math.max(...nodes.map((n) => n.y + n.r))
    const dx = pad - minX
    const dy = pad - minY
    for (const n of nodes) {
      n.x += dx
      n.y += dy
    }
    width = Math.max(640, maxX - minX + pad * 2)
    height = Math.max(480, maxY - minY + pad * 2)
  }

  return {
    nodes,
    links,
    width,
    height,
    stats: {
      presidentCount: presidentRows.length,
      artifactCount: artifactRows.length,
      clusterCount: extraHubs.size,
      nodeCount: nodes.length,
      linkCount: links.length,
      presidentNodes: nodes.filter((n) => n.type === 'president').length,
      artifactNodes: nodes.filter((n) => n.type === 'artifact').length,
    },
  }
}

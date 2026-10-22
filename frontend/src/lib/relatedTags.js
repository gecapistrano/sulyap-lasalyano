/**
 * Related-tag helpers — shared by ArtifactDetail and RelatedArtifacts.
 */
const RELATED_SKIP = new Set(['memorabilia', 'aea-irc collection'])

export function getAllArtifactsForRelatedBrowse() {
  return []
}

/** Tags shown on artifact detail / used to find peers (same rules, deduped). */
export function getRelatedTagsForArtifact(artifact) {
  if (!artifact) return []
  const tags = []
  // Prefer API/catalog tags when present (hybrid auto|manual|llm).
  if (Array.isArray(artifact.tags) && artifact.tags.length > 0) {
    for (const t of artifact.tags) {
      if (typeof t === 'string' && t.trim()) tags.push(t.trim())
      else if (t && typeof t.label === 'string' && t.label.trim()) tags.push(t.label.trim())
    }
  } else {
    const rd = artifact.idCode ?? artifact.rdCode ?? artifact.rd_code ?? artifact.id_code
    if (typeof rd === 'string' && rd.trim()) tags.push(rd.trim())
    const y = artifact.yearAcquired ?? artifact.year
    const yStr = y != null ? String(y).trim() : ''
    const o = typeof artifact.owner === 'string' ? artifact.owner.trim() : ''
    const sub = typeof artifact.subtitle === 'string' ? artifact.subtitle.trim() : ''
    const country = typeof artifact.countryOfOrigin === 'string' ? artifact.countryOfOrigin.trim() : ''
    const atype = typeof artifact.artifactType === 'string' ? artifact.artifactType.trim() : ''
    if (yStr && yStr !== '\u2014') tags.push(yStr)
    if (o && o !== '\u2014') tags.push(o)
    if (sub) tags.push(sub)
    if (country) tags.push(country)
    if (atype) tags.push(atype)
  }
  const seen = new Set()
  const out = []
  for (const raw of tags) {
    const key = raw.toLowerCase()
    if (RELATED_SKIP.has(key)) continue
    if (seen.has(key)) continue
    seen.add(key)
    out.push(raw)
  }
  return out
}

/** All artifacts whose related-tag set includes this label (case-insensitive). */
export function getArtifactsForRelatedTag(tag) {
  const needle = typeof tag === 'string' ? tag.trim() : ''
  if (!needle) return []
  const lower = needle.toLowerCase()
  const all = getAllArtifactsForRelatedBrowse()
  return all
    .filter((a) => getRelatedTagsForArtifact(a).some((t) => t.toLowerCase() === lower))
    .sort((a, b) => a.id - b.id)
}

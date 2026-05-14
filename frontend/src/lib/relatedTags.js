/**
 * Related-tag helpers — shared by ArtifactDetail and RelatedArtifacts.
 */
import { MOCK_ARTIFACTS_BROWSE, MOCK_ARTIFACTS_RELATED_EXTENDED } from '../data/artifactBrowseMocks'

const RELATED_SKIP = new Set(['memorabilia', 'aea-irc collection'])

export function getAllArtifactsForRelatedBrowse() {
  return [...MOCK_ARTIFACTS_BROWSE, ...MOCK_ARTIFACTS_RELATED_EXTENDED]
}

/** Tags shown on artifact detail / used to find peers (same rules, deduped). */
export function getRelatedTagsForArtifact(artifact) {
  if (!artifact) return []
  const tags = []
  const rd = artifact.rdCode ?? artifact.rd_code
  if (typeof rd === 'string' && rd.trim()) tags.push(rd.trim().replace(/^rd/i, 'RD'))
  const y = artifact.year != null ? String(artifact.year).trim() : ''
  const o = typeof artifact.owner === 'string' ? artifact.owner.trim() : ''
  const sub = typeof artifact.subtitle === 'string' ? artifact.subtitle.trim() : ''
  if (y && y !== '\u2014') tags.push(y)
  if (o && o !== '\u2014') tags.push(o)
  if (sub) tags.push(sub)
  if (Array.isArray(artifact.tags)) {
    for (const t of artifact.tags) {
      if (typeof t === 'string' && t.trim()) tags.push(t.trim())
    }
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

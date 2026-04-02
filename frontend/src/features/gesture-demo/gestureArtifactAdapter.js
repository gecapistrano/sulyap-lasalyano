/**
 * Maps browse / API artifact rows into the shape expected by GestureDemo, GestureHUD, GestureInfoSheet, ModelStage.
 * Placeholder model fields until the database supplies real GLB URLs and scales.
 */

import { GESTURE_MODEL_PRESETS } from './mockArtifacts'

const DEFAULT_MODEL_URL = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'
const DEFAULT_MODEL_SCALE = 1.2

const ACCENT_PALETTE = ['#4CC9F0', '#F4A261', '#E63946', '#90BE6D', '#9B5DE5', '#00BBF9', '#FEE440', '#F15BB7']

/**
 * @param {object} raw — e.g. MOCK_ARTIFACTS_BROWSE row or API record
 * @param {number} [indexFallback] — used for accent color when `id` is missing
 */
export function normalizeGestureArtifact(raw, indexFallback = 0) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('normalizeGestureArtifact: expected an object')
  }
  const id = raw.id ?? indexFallback
  const accent =
    typeof raw.accentColor === 'string' && raw.accentColor.trim()
      ? raw.accentColor.trim()
      : ACCENT_PALETTE[Math.abs(Number(id)) % ACCENT_PALETTE.length]

  const ownerOrPresident = raw.owner ?? raw.president ?? '—'
  const year = raw.year != null && raw.year !== '' ? String(raw.year) : '—'
  const description =
    typeof raw.description === 'string' && raw.description.trim()
      ? raw.description.trim()
      : 'Description will appear here when this record is loaded from the database.'

  return {
    id,
    name: raw.name ?? 'Artifact',
    president: ownerOrPresident,
    year,
    description,
    historical_context: typeof raw.historical_context === 'string' ? raw.historical_context : '',
    modelUrl: typeof raw.modelUrl === 'string' && raw.modelUrl.trim() ? raw.modelUrl.trim() : DEFAULT_MODEL_URL,
    modelScale: typeof raw.modelScale === 'number' && Number.isFinite(raw.modelScale) ? raw.modelScale : DEFAULT_MODEL_SCALE,
    accentColor: accent,
  }
}

/**
 * Builds four gesture slots from the list item opened in artifact detail: same catalog text,
 * four different 3D assets (Astronaut, BoomBox, Avocado, DamagedHelmet) for layout/QA variation.
 *
 * @param {object} rawBrowse — row from browse / API
 * @returns {object[]}
 */
export function buildKnowledgeGraphGestureSlots(rawBrowse) {
  const base = normalizeGestureArtifact(rawBrowse, 0)
  return GESTURE_MODEL_PRESETS.map((preset, i) => ({
    ...base,
    id: `${String(base.id)}-kg-${i}`,
    modelUrl: preset.modelUrl,
    modelScale: preset.modelScale,
    accentColor: preset.accentColor,
  }))
}

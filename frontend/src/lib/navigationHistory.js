/**
 * Browser history snapshots for App.jsx (pushState / popstate).
 * Keeps enough context to restore artifact / president / tag views when the user uses the browser Back button.
 */
import { findMockArtifactById } from '../data/artifactBrowseMocks'
import { findPresidentById } from '../data/presidentBrowseMocks'

/**
 * @typedef {{
 *   screen: string,
 *   artifactId: number | null,
 *   presidentId: number | null,
 *   relatedArtifactsTag: string,
 *   artifactDetailReturn: string | null,
 *   relatedArtifactsReturn: string,
 *   kgReturnScreen: string,
 *   browseReturnScreen: string,
 * }} NavSnapshot
 */

export function emptySnapshot(screen = 'home') {
  return {
    screen,
    artifactId: null,
    presidentId: null,
    relatedArtifactsTag: '',
    artifactDetailReturn: null,
    relatedArtifactsReturn: 'artifact-detail',
    kgReturnScreen: 'home',
    browseReturnScreen: 'home',
  }
}

/** Coerce unknown history payloads into a NavSnapshot shape (may still be invalid for `sanitizeSnapshot`). */
export function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return emptySnapshot('home')
  const screen = typeof raw.screen === 'string' && raw.screen ? raw.screen : 'home'
  const aid = raw.artifactId
  const pid = raw.presidentId
  return {
    screen,
    artifactId: aid != null && aid !== '' ? Number(aid) : null,
    presidentId: pid != null && pid !== '' ? Number(pid) : null,
    relatedArtifactsTag: typeof raw.relatedArtifactsTag === 'string' ? raw.relatedArtifactsTag : '',
    artifactDetailReturn: raw.artifactDetailReturn ?? null,
    relatedArtifactsReturn:
      typeof raw.relatedArtifactsReturn === 'string' && raw.relatedArtifactsReturn
        ? raw.relatedArtifactsReturn
        : 'artifact-detail',
    kgReturnScreen: typeof raw.kgReturnScreen === 'string' && raw.kgReturnScreen ? raw.kgReturnScreen : 'home',
    browseReturnScreen:
      typeof raw.browseReturnScreen === 'string' && raw.browseReturnScreen ? raw.browseReturnScreen : 'home',
  }
}

/** Drop invalid stacks (e.g. artifact-detail without a resolvable artifact) to home. */
export function sanitizeSnapshot(raw) {
  const n = normalizeSnapshot(raw)
  if (n.screen === 'artifact-detail') {
    if (n.artifactId == null || !findMockArtifactById(n.artifactId)) return emptySnapshot('home')
  }
  if (n.screen === 'president-artifacts') {
    if (n.presidentId == null || !findPresidentById(n.presidentId)) return emptySnapshot('home')
  }
  if (n.screen === 'related-artifacts') {
    if (typeof n.relatedArtifactsTag !== 'string' || !n.relatedArtifactsTag.trim()) return emptySnapshot('home')
  }
  return n
}

/**
 * Merge previous snapshot with a navigation target.
 * @param {NavSnapshot} prev
 * @param {string} nextScreen
 * @param {Partial<NavSnapshot>} [patch]
 */
export function mergeSnapshot(prev, nextScreen, patch = {}) {
  const p = { ...prev }

  switch (nextScreen) {
    case 'home':
    case 'onboarding':
    case 'camera':
      return {
        ...emptySnapshot(nextScreen),
        browseReturnScreen: patch.browseReturnScreen ?? p.browseReturnScreen ?? 'home',
      }

    case 'browse':
      return {
        ...emptySnapshot('browse'),
        browseReturnScreen: patch.browseReturnScreen ?? p.browseReturnScreen ?? 'home',
      }

    case 'president-artifacts':
      return {
        ...emptySnapshot('president-artifacts'),
        presidentId: patch.presidentId ?? p.presidentId ?? null,
        browseReturnScreen: patch.browseReturnScreen ?? p.browseReturnScreen ?? 'home',
      }

    case 'artifact-detail': {
      const artifactId = patch.artifactId != null ? Number(patch.artifactId) : p.artifactId
      return {
        screen: 'artifact-detail',
        artifactId: Number.isNaN(artifactId) ? null : artifactId,
        artifactDetailReturn: patch.artifactDetailReturn ?? p.artifactDetailReturn ?? null,
        presidentId: patch.presidentId !== undefined ? patch.presidentId : p.presidentId,
        relatedArtifactsTag: patch.relatedArtifactsTag ?? p.relatedArtifactsTag ?? '',
        relatedArtifactsReturn: patch.relatedArtifactsReturn ?? p.relatedArtifactsReturn ?? 'artifact-detail',
        kgReturnScreen: patch.kgReturnScreen ?? p.kgReturnScreen ?? 'home',
        browseReturnScreen: patch.browseReturnScreen ?? p.browseReturnScreen ?? 'home',
      }
    }

    case 'related-artifacts':
      return {
        ...p,
        screen: 'related-artifacts',
        relatedArtifactsTag: patch.relatedArtifactsTag ?? p.relatedArtifactsTag ?? '',
        relatedArtifactsReturn: patch.relatedArtifactsReturn ?? p.relatedArtifactsReturn ?? 'artifact-detail',
        artifactId: patch.artifactId !== undefined ? patch.artifactId : p.artifactId,
        presidentId: patch.presidentId !== undefined ? patch.presidentId : p.presidentId,
        artifactDetailReturn: patch.artifactDetailReturn ?? p.artifactDetailReturn,
        kgReturnScreen: patch.kgReturnScreen ?? p.kgReturnScreen ?? 'home',
        browseReturnScreen: patch.browseReturnScreen ?? p.browseReturnScreen ?? 'home',
      }

    case 'knowledge-graph':
      return {
        ...p,
        screen: 'knowledge-graph',
        kgReturnScreen: patch.kgReturnScreen ?? p.kgReturnScreen ?? 'home',
      }

    default:
      return emptySnapshot('home')
  }
}

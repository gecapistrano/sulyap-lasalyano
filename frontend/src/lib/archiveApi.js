/**
 * Typed-ish wrappers for backend routes the SPA uses.
 * Public catalog reads power Browse / scan lookup. Auth helpers remain for admin/login later.
 */
import { env } from '../config/env'
import { sanitizeText } from '../utils/security'
import { apiClient } from './apiClient'

export function isBackendConfigured() {
  return Boolean(env.apiConfigured)
}

/** Resolve API-relative media paths (e.g. `/media/models/...`) for the browser. */
export function resolveMediaUrl(pathOrUrl) {
  const value = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : ''
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (!env.apiConfigured) return value
  try {
    return new URL(value.startsWith('/') ? value : `/${value}`, env.apiBaseUrl).href
  } catch {
    return value
  }
}

/** Map catalog JSON to the browse/detail row shape used by the UI. */
export function mapCatalogArtifact(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id,
    rdCode: row.rd_code,
    name: row.title,
    subtitle: row.subtitle || '',
    year: row.year || '',
    owner: row.owner_name || '',
    icon: row.icon || '🏺',
    description: row.description || '',
    modelUrl: resolveMediaUrl(row.model_url || ''),
  }
}

export async function listCatalogPresidents() {
  return apiClient.request('/catalog/presidents', { method: 'GET' })
}

export async function listCatalogArtifacts({ search = '', ownerName = '' } = {}) {
  return apiClient.request('/catalog/artifacts', {
    method: 'GET',
    query: {
      search: String(search ?? '').trim(),
      owner_name: String(ownerName ?? '').trim(),
    },
  })
}

export async function getCatalogArtifactByRdCode(rdCode) {
  const code = String(rdCode ?? '').trim().toUpperCase()
  if (!code) return null
  return apiClient.request(`/catalog/artifacts/rd/${encodeURIComponent(code)}`, { method: 'GET' })
}

export async function login(email, password) {
  return apiClient.request('/auth/login', {
    method: 'POST',
    body: {
      email: sanitizeText(email).trim(),
      password,
    },
  })
}

export async function getMe() {
  return apiClient.request('/auth/me', { method: 'GET' })
}

export async function refreshSession() {
  return apiClient.request('/auth/refresh', { method: 'POST' })
}

export async function logout() {
  return apiClient.request('/auth/logout', { method: 'POST' })
}

export async function listArtifacts({ search = '' } = {}) {
  return apiClient.request('/artifacts', {
    method: 'GET',
    query: { search: String(search ?? '').trim() },
  })
}

function cleanField(value) {
  // Strip control chars only — do not HTML-escape before storage (UI renders as text).
  return [...String(value ?? '')]
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
}

export async function updateArtifact(artifactId, patch) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  const body = {}
  if (typeof patch?.title === 'string') body.title = cleanField(patch.title).trim()
  if (typeof patch?.description === 'string') body.description = cleanField(patch.description)
  if (typeof patch?.rd_code === 'string') body.rd_code = cleanField(patch.rd_code).trim().toUpperCase()
  if (typeof patch?.owner_name === 'string') body.owner_name = cleanField(patch.owner_name).trim()
  if (typeof patch?.year === 'string') body.year = cleanField(patch.year).trim()
  if (typeof patch?.subtitle === 'string') body.subtitle = cleanField(patch.subtitle).trim()
  if (typeof patch?.icon === 'string') body.icon = cleanField(patch.icon).trim()
  if (typeof patch?.published === 'boolean') body.published = patch.published
  if (typeof patch?.model_url === 'string') body.model_url = cleanField(patch.model_url).trim()
  return apiClient.request(`/artifacts/${id}`, {
    method: 'PATCH',
    body,
  })
}

/** Upload a .glb 3D model for an artifact (auth cookie + CSRF). */
export async function uploadArtifactModel(artifactId, file) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  if (!(file instanceof File)) throw new Error('Invalid file')
  const formData = new FormData()
  formData.append('file', file, file.name || 'model.glb')
  return apiClient.upload(`/artifacts/${id}/model`, formData)
}

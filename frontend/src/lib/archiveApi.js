/**
 * Typed-ish wrappers for backend routes the SPA / Next app uses.
 */
import { env } from '../config/env'
import { sanitizeText } from '../utils/security'
import { apiClient } from './apiClient'
import { clearCsrfToken, setCsrfToken } from './secureApi'

function rememberCsrf(payload) {
  if (payload && typeof payload.csrf_token === 'string') {
    setCsrfToken(payload.csrf_token)
  }
  return payload
}

export function isBackendConfigured() {
  return Boolean(env.apiConfigured)
}

/** Visitor-facing image for a catalog row. Local curator files go through the published photo route. */
export function catalogImageSrc(idCode, imageUrl) {
  const value = typeof imageUrl === 'string' ? imageUrl.trim() : ''
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  const code = String(idCode ?? '').trim()
  if (!code || !env.apiConfigured) return ''
  try {
    return new URL(`/catalog/artifacts/id/${encodeURIComponent(code)}/photo`, env.apiBaseUrl).href
  } catch {
    return ''
  }
}

export function resolveMediaUrl(pathOrUrl) {
  const value = typeof pathOrUrl === 'string' ? pathOrUrl.trim() : ''
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (value.startsWith('/curator-media/')) {
    if (!env.apiConfigured) return value
    try {
      return new URL(`/artifacts/photo-proxy${value}`, env.apiBaseUrl).href
    } catch {
      return value
    }
  }
  if (!env.apiConfigured) return value
  try {
    return new URL(value.startsWith('/') ? value : `/${value}`, env.apiBaseUrl).href
  } catch {
    return value
  }
}

function mapTags(row) {
  if (!Array.isArray(row?.tags)) return []
  return row.tags
    .map((t) => (typeof t === 'string' ? t : t?.label))
    .filter((t) => typeof t === 'string' && t.trim())
}

/** Map catalog JSON to the browse/detail row shape used by the UI. */
export function mapCatalogArtifact(row) {
  if (!row || typeof row !== 'object') return null
  const idCode = row.id_code || row.rd_code || row.idCode || row.rdCode || ''
  const imageUrl = catalogImageSrc(idCode, row.image_url || row.imageUrl || '')
  return {
    id: row.id,
    rdCode: idCode,
    idCode,
    name: row.title || row.name || '',
    subtitle: row.subtitle || '',
    year: row.year_acquired || row.year || row.yearAcquired || '',
    yearAcquired: row.year_acquired || row.year || row.yearAcquired || '',
    countryOfOrigin: row.country_of_origin || row.countryOfOrigin || '',
    artifactType: row.artifact_type || row.artifactType || '',
    owner: row.owner_name || row.owner || '',
    icon: row.icon || '🏺',
    description: row.description || '',
    imageUrl,
    modelUrl: resolveMediaUrl(row.model_url || row.modelUrl || ''),
    presidentId: row.president_id ?? null,
    tags: mapTags(row),
  }
}

export async function listCatalogPresidents() {
  return apiClient.request('/catalog/presidents', { method: 'GET' })
}

export async function listCatalogArtifacts({
  search = '',
  ownerName = '',
  yearAcquired = '',
  countryOfOrigin = '',
  artifactType = '',
  tag = '',
  sort = 'id',
} = {}) {
  const rows = await apiClient.request('/catalog/artifacts', {
    method: 'GET',
    query: {
      search: String(search ?? '').trim(),
      owner_name: String(ownerName ?? '').trim(),
      year_acquired: String(yearAcquired ?? '').trim(),
      country_of_origin: String(countryOfOrigin ?? '').trim(),
      artifact_type: String(artifactType ?? '').trim(),
      tag: String(tag ?? '').trim(),
      sort: String(sort ?? 'id').trim(),
    },
  })
  return Array.isArray(rows) ? rows.map(mapCatalogArtifact).filter(Boolean) : []
}

export async function getCatalogArtifactByIdCode(idCode) {
  const code = String(idCode ?? '').trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return null
  const row = await apiClient.request(`/catalog/artifacts/id/${encodeURIComponent(code)}`, { method: 'GET' })
  return mapCatalogArtifact(row)
}

/** @deprecated use getCatalogArtifactByIdCode */
export async function getCatalogArtifactByRdCode(rdCode) {
  return getCatalogArtifactByIdCode(rdCode)
}

export async function listRelatedArtifacts({ tag = '', idCode = '' } = {}) {
  const rows = await apiClient.request('/catalog/artifacts/related', {
    method: 'GET',
    query: { tag: String(tag ?? '').trim(), id_code: String(idCode ?? '').trim() },
  })
  return Array.isArray(rows) ? rows.map(mapCatalogArtifact).filter(Boolean) : []
}

export async function login(email, password) {
  const me = await apiClient.request('/auth/login', {
    method: 'POST',
    body: {
      email: sanitizeText(email).trim(),
      password,
    },
  })
  return rememberCsrf(me)
}

export async function getMe() {
  return rememberCsrf(await apiClient.request('/auth/me', { method: 'GET' }))
}

export async function refreshSession() {
  return rememberCsrf(await apiClient.request('/auth/refresh', { method: 'POST' }))
}

export async function logout() {
  try {
    return await apiClient.request('/auth/logout', { method: 'POST' })
  } finally {
    clearCsrfToken()
  }
}

export async function listArtifacts({ search = '' } = {}) {
  // Trailing slash matches FastAPI collection routes and avoids 307 redirects
  // that drop cookies on cross-origin credentialed fetch.
  return apiClient.request('/artifacts/', {
    method: 'GET',
    query: { search: String(search ?? '').trim() },
  })
}

export async function listPresidentsAdmin() {
  return apiClient.request('/presidents/', { method: 'GET' })
}

function cleanField(value) {
  return [...String(value ?? '')]
    .filter((char) => {
      const code = char.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
}

export async function createArtifact(payload) {
  return apiClient.request('/artifacts/', {
    method: 'POST',
    body: payload,
  })
}

export async function deleteArtifact(artifactId) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  return apiClient.request(`/artifacts/${id}`, { method: 'DELETE' })
}

export async function updateArtifact(artifactId, patch) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  const body = {}
  if (typeof patch?.title === 'string') body.title = cleanField(patch.title).trim()
  if (typeof patch?.description === 'string') body.description = cleanField(patch.description)
  if (typeof patch?.id_code === 'string') body.id_code = cleanField(patch.id_code).trim().toUpperCase().replace(/\s+/g, '')
  if (typeof patch?.rd_code === 'string') body.id_code = cleanField(patch.rd_code).trim().toUpperCase().replace(/\s+/g, '')
  if (typeof patch?.owner_name === 'string') body.owner_name = cleanField(patch.owner_name).trim()
  if (typeof patch?.year === 'string') body.year_acquired = cleanField(patch.year).trim()
  if (typeof patch?.year_acquired === 'string') body.year_acquired = cleanField(patch.year_acquired).trim()
  if (typeof patch?.country_of_origin === 'string') body.country_of_origin = cleanField(patch.country_of_origin).trim()
  if (typeof patch?.artifact_type === 'string') body.artifact_type = cleanField(patch.artifact_type).trim()
  if (typeof patch?.subtitle === 'string') body.subtitle = cleanField(patch.subtitle).trim()
  if (typeof patch?.icon === 'string') body.icon = cleanField(patch.icon).trim()
  if (typeof patch?.remarks === 'string') body.remarks = cleanField(patch.remarks)
  if (typeof patch?.published === 'boolean') body.published = patch.published
  if (typeof patch?.llm_assist_enabled === 'boolean') body.llm_assist_enabled = patch.llm_assist_enabled
  if (typeof patch?.model_url === 'string') body.model_url = cleanField(patch.model_url).trim()
  if (patch?.president_id === null) body.president_id = null
  else if (typeof patch?.president_id === 'number' && Number.isFinite(patch.president_id)) {
    body.president_id = patch.president_id
  }
  if (Array.isArray(patch?.tags)) body.tags = patch.tags
  else if (Array.isArray(patch?.manual_tags)) body.tags = patch.manual_tags
  return apiClient.request(`/artifacts/${id}`, {
    method: 'PATCH',
    body,
  })
}

export async function uploadArtifactModel(artifactId, file) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  if (!(file instanceof File)) throw new Error('Invalid file')
  const formData = new FormData()
  formData.append('file', file, file.name || 'model.glb')
  return apiClient.upload(`/artifacts/${id}/model`, formData)
}

export async function uploadArtifactPhoto(artifactId, file) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  if (!(file instanceof File)) throw new Error('Invalid file')
  const formData = new FormData()
  formData.append('file', file, file.name || 'photo.jpg')
  return apiClient.upload(`/artifacts/${id}/photo`, formData)
}

export async function llmSuggest(artifactId) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  return apiClient.request(`/artifacts/${id}/llm-suggest`, { method: 'POST', body: {} })
}

export async function llmApply(artifactId, suggestion) {
  const id = Number(artifactId)
  if (!Number.isFinite(id)) throw new Error('Invalid artifact id')
  return apiClient.request(`/artifacts/${id}/llm-apply`, { method: 'POST', body: suggestion })
}

export async function createPresident(payload) {
  return apiClient.request('/presidents/', { method: 'POST', body: payload })
}

export async function updatePresident(presidentId, patch) {
  const id = Number(presidentId)
  if (!Number.isFinite(id)) throw new Error('Invalid president id')
  return apiClient.request(`/presidents/${id}`, { method: 'PATCH', body: patch })
}

export async function deletePresident(presidentId) {
  const id = Number(presidentId)
  if (!Number.isFinite(id)) throw new Error('Invalid president id')
  return apiClient.request(`/presidents/${id}`, { method: 'DELETE' })
}

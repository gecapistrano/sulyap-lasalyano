/**
 * Typed-ish wrappers for backend routes the SPA uses.
 * Auth helpers exist for future login UI; `listArtifacts` powers Browse mode (cookie session + CSRF on mutating routes).
 */
import { sanitizeText } from '../utils/security'
import { apiClient } from './apiClient'

export async function login(email, password) {
  return apiClient.request('/auth/login', {
    method: 'POST',
    body: {
      email: sanitizeText(email).trim(),
      password,
    },
  })
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

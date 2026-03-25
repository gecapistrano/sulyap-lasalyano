/**
 * Shared `fetch` client bound to `env.apiBaseUrl`.
 * All API modules should import `apiClient` from here instead of calling `fetch` directly.
 */
import { env } from '../config/env'
import { createSecureApiClient } from './secureApi'

export const apiClient = createSecureApiClient({
  baseUrl: env.apiBaseUrl,
})

/**
 * Hybrid recognition API client.
 *
 * Sends camera frame payload to backend retrieval endpoint and returns ranked candidates.
 * Endpoint is CSRF/session protected on backend scaffold.
 */
import { apiClient } from './apiClient'

/**
 * @typedef {Object} RecognitionCandidate
 * @property {string} artifact_id
 * @property {string} label
 * @property {number} score
 * @property {string} source
 */

/**
 * @typedef {Object} RecognitionResponse
 * @property {'ok'} status
 * @property {string} model_version
 * @property {boolean} supported
 * @property {number} top_k
 * @property {number} min_score
 * @property {RecognitionCandidate[]} candidates
 */

/**
 * Request backend retrieval candidates from a frame payload.
 * Supply exactly one of `frameDataUrl` or `frameBase64`.
 *
 * @returns {Promise<RecognitionResponse>}
 */
export async function fetchRecognitionCandidates({
  frameDataUrl,
  frameBase64,
  topK = 5,
  minScore = 0.7,
  clientTs = Date.now(),
}) {
  const hasDataUrl = Boolean(frameDataUrl)
  const hasBase64 = Boolean(frameBase64)
  if (hasDataUrl === hasBase64) {
    throw new Error('Provide exactly one of frameDataUrl or frameBase64')
  }

  return apiClient.request('/recognition/candidates', {
    method: 'POST',
    body: {
      frame_data_url: hasDataUrl ? frameDataUrl : null,
      frame_base64: hasBase64 ? frameBase64 : null,
      top_k: topK,
      min_score: minScore,
      client_ts: clientTs,
    },
  })
}

export async function listRecognitionClasses() {
  return apiClient.request('/recognition/classes', { method: 'GET' })
}

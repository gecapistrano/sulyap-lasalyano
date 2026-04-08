# Recognition API Contract (Hybrid Scaffold)

Base URL: backend API host (e.g. `https://archive-api.onrender.com`)

## `GET /recognition/classes`

Public helper endpoint for UI/debug bootstrapping.

### Response `200`

```json
{
  "classes": ["RD242-243", "RD244"]
}
```

---

## `POST /recognition/candidates`

Retrieve top-K artifact candidates from one camera frame.

### Security

- Requires authenticated active user session cookie.
- Requires CSRF header/cookie pair (`X-CSRF-Token` matching `csrf_token` cookie).

### Request JSON

Send **exactly one** of `frame_data_url` or `frame_base64`.

```json
{
  "frame_data_url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ...",
  "frame_base64": null,
  "top_k": 5,
  "min_score": 0.7,
  "client_ts": 1744135305123
}
```

### Request Fields

- `frame_data_url`: string, optional, max 6_000_000 chars, must start with `data:image/`
- `frame_base64`: string, optional, max 6_000_000 chars
- `top_k`: integer, default `5`, range `1..20`
- `min_score`: float, default `0.7`, range `0..1`
- `client_ts`: integer timestamp (ms), optional

### Success Response `200`

```json
{
  "status": "ok",
  "model_version": "rd-hybrid-scaffold-v1",
  "supported": true,
  "top_k": 5,
  "min_score": 0.7,
  "candidates": [
    {
      "artifact_id": "RD242-243",
      "label": "RD242-243",
      "score": 0.91,
      "source": "mock-index-v1"
    },
    {
      "artifact_id": "RD244",
      "label": "RD244",
      "score": 0.88,
      "source": "mock-index-v1"
    }
  ]
}
```

### Validation Error `422`

```json
{
  "detail": "Provide exactly one of frame_data_url or frame_base64"
}
```

---

## Frontend Client

See:

- `frontend/src/lib/recognitionApi.js`

### Usage

```js
import { fetchRecognitionCandidates } from '../lib/recognitionApi'

const result = await fetchRecognitionCandidates({
  frameDataUrl,
  topK: 5,
  minScore: 0.7,
})
```

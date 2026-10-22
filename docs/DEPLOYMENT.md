# Production deployment — Sulyap Lasalyano

Live stack:

| Layer | Host |
|-------|------|
| Next.js UI | Vercel (`frontend/`) |
| FastAPI API | Render (`backend/`, see `render.yaml`) |
| Postgres | Supabase |

## 1. Supabase

1. Create project; copy **Session mode** Postgres URI.
2. Run SQL in order:
   - `supabase/migrations/001_init.sql`
   - `supabase/migrations/002_artifact_model_url.sql` (if needed)
   - `supabase/migrations/003_catalog_knowledge.sql`
3. Optional: seed via API startup or `backend/scripts/import_memorabilia_xlsb.py`.

## 2. Render (API)

1. New Web Service from repo, root `backend`, or apply `render.yaml`.
2. Set env:
   - `DATABASE_URL` = Supabase URI
   - `APP_ENV=production`
   - `JWT_SECRET_KEY` = long random secret
   - `FRONTEND_ORIGINS=https://<your-vercel-host>`
   - `COOKIE_SECURE=true`
   - `COOKIE_SAMESITE=none`
   - `ADMIN_SEED_PASSWORD` = strong password (before first seed)
   - Optional: `LLM_API_KEY`, `LLM_MODEL`, `LLM_API_BASE`
3. Confirm `GET https://<api-host>/health` → `{"status":"ok"}`.

**Uploads:** Render ephemeral disk loses files on redeploy. Curator reference photos are restored on API startup from `backend/data/curator_photos.tar.gz` (regenerate with `tar -czf backend/data/curator_photos.tar.gz -C backend/uploads/artifacts .`). New curator uploads and 3D models still need a persistent disk or object storage for durability across deploys.

## 3. Vercel (Next.js)

1. Project root: `frontend` (or monorepo setting Root Directory = `frontend`).
2. Framework: Next.js.
3. Env:
   - `NEXT_PUBLIC_API_BASE_URL=https://<api-host>`
   - `NEXT_PUBLIC_RECOGNITION_MODE=local`
4. Deploy production; open the Vercel URL and verify Browse + Curator login.

## 4. Live verify checklist (end-to-end)

Run against production (or staging with the same cookie/CORS shape).

### API + DB

- [ ] `GET https://<api-host>/health` → `{"status":"ok"}`
- [ ] `GET /catalog/presidents` returns published presidents
- [ ] `GET /catalog/artifacts` returns imported memorabilia (limit raised; filters work)
- [ ] `GET /catalog/artifacts/id/<ID_CODE>` resolves normalized accession (e.g. `RD244`, `AB005`)
- [ ] Public JSON **omits** curator-only `image_url` / `remarks` / `llm_assist_enabled`

### Cross-origin auth (Vercel → Render)

- [ ] `FRONTEND_ORIGINS` includes exact Vercel origin(s) (and `http://localhost:3000` for local Next)
- [ ] `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` on Render
- [ ] Curator login from production UI sets session; `/auth/me` succeeds
- [ ] Mutating curator calls send CSRF header; no CORS failures in console

### Curator Desk

- [ ] Dual catalogs: Artifacts + Presidents
- [ ] Create / edit / delete artifact; photo + GLB/OBJ upload
- [ ] Tags visible; optional AI assist toggle + suggest (if `LLM_*` set)
- [ ] Create / edit president (bio, photo URL, published)

### Visitor UI

- [ ] Browse presidents → memorabilia list from API
- [ ] Artifact detail: full description + **Show more**; related tags; no photo/remarks
- [ ] Related tag list loads from `/catalog/artifacts/related`
- [ ] Live Scan opens; ONNX + `labels.txt` load from `/models`
- [ ] Curator Desk is reachable at `/curator` (Next.js) or static `/curator` bridge — **not** linked from the public home

### Static site (`sulyap-lasalyano/`)

Separate Vercel project with Root Directory `sulyap-lasalyano`. Local: `node serve.mjs` (correct `.mjs` MIME). Ensure `models/model.onnx`, `models/labels.txt`, and `vendor/onnxruntime-web/*` are deployed (build runs `scripts/check-scan-assets.mjs`). Catalog: `/scan?api=https://<api-host>` and add that static origin to `FRONTEND_ORIGINS`.

### Import / ML (ops)

- [ ] Re-import workbook against Supabase is idempotent (`id_code` upsert)
- [ ] After retraining, `deploy_model.py` writes ONNX + training-order `labels.txt` (147 classes, YOLOv8s); catalog export uses `sync_labels_from_db.py` → `catalog_id_codes.txt` only

See also [OPS_RUNBOOK.md](./OPS_RUNBOOK.md).

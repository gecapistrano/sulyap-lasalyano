# Production deployment — Sulyap Lasalyano

Live stack:

| Layer | Host |
|-------|------|
| Public UI (museum hall) | Vercel (`hall/`) |
| Curator Desk | Vercel (`frontend/`) — staff only |
| FastAPI API | Render (`backend/`, see `render.yaml`) |
| Postgres + Storage | Supabase |

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
   - Catalog photos: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET=catalog-photos`
   - Visitor 3D: `CATALOG_OMIT_STORAGE_MODELS=true` (forced in production). GLBs are on the Vercel hall host, not Storage. Do not re-upload models to the `catalog-photos` bucket.
3. Confirm `GET https://<api-host>/health` → `{"status":"ok"}`.

**Uploads:** Render ephemeral disk loses files on redeploy. Catalog **photos** belong in **Supabase Storage** (bucket `catalog-photos`). **Do not serve visitor GLBs from that bucket** — they burn Cached Egress even on a cache hit, and purging does not refund usage. Hall files in `hall/models/catalog/` are the visitor 3D. Curator photo uploads still go to Storage when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set. A GitHub Action pings `GET /health` every 10 minutes so the free Render service does not sleep. See [§5 Catalog sync](#5-catalog-sync-local-sqlite--supabase) and [§6 Catalog media](#6-catalog-media-in-supabase-storage).

## 3. Vercel

### Public museum hall (required)

1. Project root: `sulyap-lasalyano` (Root Directory = `hall`).
2. Framework: Other / static (`vercel.json` in that folder).
3. Confirm Scan, Knowledge Graph, and president browse load. Catalog: local `serve.mjs` proxies `/catalog`; production `hall/vercel.json` rewrites `/catalog` to `https://sulyap-lasalyano-api.onrender.com` (same-origin, like local). `?api=` still overrides.

### Curator Desk (staff, not a second visitor site)

Do **not** create another Vercel project for `frontend/`. One project, Root Directory `hall`. Staff use local `npm run dev:curator` or the hall `/curator` bridge. Visitor 3D stays in `hall/models/catalog` (never Supabase Storage GLBs).

## 4. Live verify checklist (end-to-end)

Run against production (or staging with the same cookie/CORS shape).

### API + DB

- [ ] `GET https://<api-host>/health` → `{"status":"ok"}`
- [ ] `GET /catalog/presidents` returns published presidents
- [ ] `GET /catalog/artifacts` returns imported memorabilia (limit raised; filters work)
- [ ] `GET /catalog/artifacts/id/<ID_CODE>` resolves normalized accession (e.g. `RD244`, `AB005`)
- [ ] Public JSON **omits** curator-only `remarks` / `llm_assist_enabled`
- [ ] Catalog `model_url` / president `photo_url` may be https Storage URLs (not BYTEA)

### Cross-origin auth (Vercel → Render)

- [ ] `FRONTEND_ORIGINS` includes exact Vercel origin(s) (and `http://127.0.0.1:8765` for the local museum hall, plus `http://localhost:3000` if you run Curator locally)
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

### Static site (`hall/`)

One Vercel project, Root Directory `hall`. Preview deploys are skipped (rebuild noise). Local: `node hall/serve.mjs` (correct `.mjs` MIME). Ensure `models/model.onnx`, `models/labels.txt`, and `vendor/onnxruntime-web/*` are deployed (build runs `scripts/check-scan-assets.mjs`). `hall/vercel.json` rewrites `/catalog` to the Render API so Scan/KG need no `?api=` query.

### Import / ML (ops)

- [ ] Re-import workbook against Supabase is idempotent (`id_code` upsert)
- [ ] After retraining, `deploy_model.py` writes ONNX + training-order `labels.txt` (~147 classes today); catalog export uses `sync_labels_from_db.py` → `catalog_id_codes.txt` only

See also [OPS_RUNBOOK.md](./OPS_RUNBOOK.md).

## 5. Catalog sync (local SQLite ↔ Supabase)

Keeps **presidents**, **artifacts**, **tags**, and **artifact_tags** in sync. The **users** table (including password hashes) is never copied.

Production `DATABASE_URL` is already Supabase Postgres. Sync still works when you pair a local SQLite file with that remote URI:

- `DATABASE_URL=sqlite:///./sulyap.db` and `SYNC_REMOTE_DATABASE_URL=<Supabase URI>`, or
- `DATABASE_URL=<Supabase URI>` and `SYNC_REMOTE_DATABASE_URL=sqlite:///./sulyap.db`, or
- `DATABASE_URL` remote and a `backend/sulyap.db` file present (CLI treats the file as local)

Photo and 3D-model **paths** on rows are synced as metadata only. After binaries live at public Storage URLs, sync copies those URL strings. Bytes in `backend/uploads/` are not replicated.

### Env

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | API primary DB (local SQLite or Supabase Postgres) |
| `SYNC_REMOTE_DATABASE_URL` | The other catalog endpoint |
| `CATALOG_SYNC_ON_START` | Default **on**. `0` to skip. On boot, pairs local `sulyap.db` with Supabase when `DATABASE_URL` is remote (creates the sqlite file if needed). Failures are logged; boot continues. |

Copy `backend/.env.example` → `backend/.env`. Do not commit `.env`.

### CLI

From `backend/`:

```powershell
python scripts/sync_catalog.py --dry-run
python scripts/sync_catalog.py --both
python scripts/sync_catalog.py --pull
python scripts/sync_catalog.py --push
python scripts/sync_catalog.py --both --apply-deletes
```

Default is `--both`. Deletes are **not** propagated unless you pass `--apply-deletes` (so an empty local seed cannot wipe Supabase).

Before each real sync, both sides are snapshotted under `backend/data/catalog_versions/` (gitignored). At most **10** files are kept; the oldest are dropped.

```powershell
python scripts/sync_catalog.py --list-versions
python scripts/sync_catalog.py --restore VERSION_ID
python scripts/sync_catalog.py --restore VERSION_ID --target local
```

Restore writes that snapshot back onto `--target` (`local`, `remote`, or `both`, default both) after taking a fresh snapshot of the current catalog so the restore itself is undoable.

Conflicts (same row changed on both sides since the last sync) keep the remote (Supabase) copy. Restore the matching **local** snapshot id to recover the discarded side.

### Admin HTTP (optional)

`POST /admin/catalog/sync` requires an authenticated **admin** session plus CSRF (`X-CSRF-Token`). It is not a public webhook. Body (unknown fields rejected): `{ "direction": "both", "dry_run": false, "apply_deletes": false, "restore": null, "target": "both" }`.

## 6. Catalog media in Supabase Storage

Photos and 3D models are **not** stored as BYTEA in Postgres. Upload bytes to Storage; keep the public URL (or a relative `/curator-media` / `/media/models` path) on the row.

### Bucket and keys

| | |
|--|--|
| Bucket | `catalog-photos` (public) |
| Artifacts | `artifacts/{id}.jpg` (or `.png` / `.webp`) |
| Presidents | `presidents/{slug}.jpg` |
| 3D models | `models/{filename}.glb` |
| Public URL | `{SUPABASE_URL}/storage/v1/object/public/catalog-photos/{key}` |

### Env (backend)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | `https://<project-ref>.supabase.co` (not the dashboard URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Dashboard → Project Settings → API → `service_role` JWT (server/script only) |
| `SUPABASE_STORAGE_BUCKET` | `catalog-photos` |
| `SYNC_REMOTE_DATABASE_URL` | Optional second DB for the upload scripts |

Never commit `.env` or the service role key. Do not put the service role in Vercel/Next env.

### One-time upload (before wiping a laptop)

1. Dashboard → Storage: create public bucket `catalog-photos` (or let the script create it).
2. Put the env vars in `backend/.env`.
3. From `backend/`:

```powershell
python scripts/upload_catalog_photos.py --dry-run
python scripts/upload_catalog_photos.py
python scripts/upload_catalog_models.py --dry-run
python scripts/upload_catalog_models.py
```

`--dry-run` lists files and object keys without credentials. A real run requires `SUPABASE_URL` + a **service_role JWT** (not a short dashboard key) and prints `uploaded` / `skipped` / `missing` / `failed`. It updates `DATABASE_URL` rows and, if `SYNC_REMOTE_DATABASE_URL` is set, the other catalog too.

Curator Desk `POST /artifacts/{id}/photo` and `POST /artifacts/{id}/model` stay **admin/editor + CSRF**. When Storage env is set on the API host, those endpoints write Storage objects and store the public URL.

Keep laptop copies in `backend/uploads/artifacts/` and `backend/uploads/models/` for local Live Scan. Do **not** re-download those objects from Storage just to fill the folders — that spends Cached Egress. Keep Live Scan ONNX (`frontend/public/models/` / `hall/models/`) in git — that is not this bucket.

### Local development vs production media

| Mode | Metadata | Photos / GLBs |
|------|----------|----------------|
| Local (`APP_ENV` ≠ `production`) | Local SQLite, or Postgres if `DATABASE_URL` points at Supabase | Files under `backend/uploads/` when they exist. Catalog `image_url` becomes `/catalog/artifacts/id/{CODE}/photo`; `model_url` becomes `/media/models/{CODE}.glb`. Hall `serve.mjs` proxies `/catalog` and `/media` to FastAPI (`SULYAP_API_PROXY`, default `http://127.0.0.1:8000`). |
| Production (Vercel hall + Render API) | Supabase Postgres | Photos: stored https Storage URLs. GLBs: `{PUBLIC_MODEL_BASE_URL}/models/{CODE}.glb`, or omitted until that host exists. `CATALOG_PREFER_LOCAL_MEDIA` is forced off. `CATALOG_OMIT_STORAGE_MODELS` is forced on. |

Copy GLBs into `backend/uploads/models/AG013.glb` (accession filename) from your original photogrammetry export. Prefer `npm run models:compress` so local Live Scan uses the small files. Drop `CATALOG_PREFER_LOCAL_MEDIA=false` only if you need the local API to return cloud URLs anyway.

### Live Scan 3D models and Storage egress

Catalog GLBs are photogrammetry files (often **16–25MB**). Every visitor download of `…/storage/v1/object/public/catalog-photos/models/*.glb` counts toward **Cached Egress**, even on a cache hit. **Purging does not refund usage.** Do **not** re-upload the same 20MB files to “fix” cache headers, and do **not** download the current Storage objects to recompress.

**Keep Postgres + small photos on Supabase.** Host compressed GLBs on Cloudflare R2 (typical egress $0) or Pages.

```
npm run models:compress
npm run models:publish -- --pages-project sulyap-models
```

Then on Render:

```
PUBLIC_MODEL_BASE_URL=https://<your-models-host>
CATALOG_OMIT_STORAGE_MODELS=true
```

The catalog API rewrites `model_url` to `{PUBLIC_MODEL_BASE_URL}/models/AG013.glb`. Until that host exists, production omits Storage GLB URLs (the 3D stage stays empty). The public hall also skips Supabase GLB URLs unless you pass `?storageGlb=1`.

Compress from laptop folders only (`D:\STORAGE\Downloads\Andrew Gonzales (AG)\…` today). The compressor resizes JPEGs to 1024px and simplifies the mesh (`--simplify-ratio 0.18`) so stock THREE `GLTFLoader` can read the files (no Draco decoder). Expect roughly 5MB per item instead of 16–25MB.

### Stakeholder demo / ~500 testers (1–2 months)

500 people tapping 20MB Storage GLBs will blow **Free (5 GB)** immediately and can still chew through **Pro (250 GB cached egress)** if many unique items are opened. Upgrade **Supabase Pro for the demo window** so the project is not paused (Database + photo Storage stay there). Still keep visitor GLBs off Storage:

| Layer | Where | Why |
|-------|--------|-----|
| Postgres + auth | Supabase Pro | Tiny; Pro avoids a hard Free pause mid-presentation |
| Catalog photos | Supabase Storage | Small files; well under Database/Storage size |
| Visitor GLBs | R2 / Pages after `models:compress` | 20MB files must not ride Cached Egress |

Set `CATALOG_OMIT_STORAGE_MODELS=true` on the **live** Render service now (Dashboard → Environment), then redeploy/restart the API. `render.yaml` already includes that flag for the next blueprint sync. After Pages/R2 is up, add `PUBLIC_MODEL_BASE_URL` and restart again — do not wait for a code-only deploy if the live service is still returning Storage GLB URLs.

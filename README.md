# Sulyap Lasalyano

Sulyap Lasalyano is a web-based AR + ML museum experience for the DLSU-D AEA-IRC Presidents' Memorabilia Gallery.

Visitors can point a phone camera at supported memorabilia and the system attempts real-time recognition using a YOLO/ONNX pipeline, then presents contextual content in an interactive UI.

> **Official public UI:** the museum hall in `hall/` (home, Live Scan, 3D Knowledge Graph, president browse). `frontend/` is Curator Desk only — do not send visitors to `:3000`.

## Core Features

- Museum hall public site (static) with president browse from the live catalog
- Browser-based Live Scan with on-device YOLOv8/ONNX inference (~147 classes) and catalog lookup
- 3D Knowledge Graph (presidents + artifact halos) from the same catalog
- Secure FastAPI backend (auth, CSRF, rate limiting) on Supabase Postgres
- Bidirectional catalog mirror to local `backend/sulyap.db` (never copies users)
- Photos and 3D models in Supabase Storage (Postgres stores URLs only)
- ML workspace under `ml/` for training, exports, and evaluation artifacts

## Tech Stack

- Public UI: static museum hall in `hall/`
- Curator Desk: Next.js app under `frontend/`
- Backend: FastAPI, Pydantic, SQLAlchemy
- ML: Ultralytics YOLOv8, PyTorch, ONNX
- Deployment: Vercel (`hall/`), Render (FastAPI) — see `docs/DEPLOYMENT.md`
- Database: Supabase Postgres via `DATABASE_URL`, mirrored to local SQLite

## Repository Structure

```text
sulyap-lasalyano/                 # this Git repo
+-- hall/                        # Official public UI (museum hall)
+-- backend/                     # FastAPI API, catalog sync, Storage uploads
+-- frontend/                    # Curator Desk (Next.js) — not the visitor app
+-- supabase/                    # Postgres schema + catalog seed
+-- data/imports/                # Local memorabilia workbook copies (gitignored)
+-- ml/                          # Training scripts, datasets, runs, weights
+-- docs/                        # DEPLOYMENT.md, OPS_RUNBOOK.md, SUPABASE_SETUP.md
+-- README.md
```

## Local Development

### 1) Clone

```bash
git clone https://github.com/gecapistrano/sulyap-lasalyano.git
cd sulyap-lasalyano
npm install
```

Running `npm install` at the repository root sets `core.hooksPath` to `.githooks/`. The `commit-msg` hook removes any line containing `cursoragent@cursor.com` from the final commit message so automated Cursor co-author trailers are not pushed to GitHub.

### 2) Museum hall + API (public app)

```bash
npm run dev
```

- Hall: [http://127.0.0.1:8765/](http://127.0.0.1:8765/)
- API: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

`serve.mjs` proxies `/catalog` to the API so Scan, Browse, and the Knowledge Graph all read the live database. Use this server (not `python -m http.server`) so ONNX/WASM MIME types stay correct.

### 3) Curator Desk (staff only)

```bash
npm run dev:curator
```

Curator default URL: `http://127.0.0.1:3000/curator` (Next.js). Plaque long-press on the hall also opens this desk.

### 4) Backend (if started on its own)

```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host localhost --port 8000
```

Backend default URL: `http://localhost:8000`

On startup the API mirrors catalog rows both ways (Supabase ↔ `backend/sulyap.db`). Users and password hashes are never copied. Photos belong in Supabase Storage (`python scripts/upload_catalog_photos.py` from `backend/`).

## Environment Notes

- Configure Curator env in `frontend/.env.local` (`NEXT_PUBLIC_API_BASE_URL`)
- Configure backend env in `backend/.env`
- For split hosting (Vercel + Render), use `COOKIE_SAMESITE=none` + `COOKIE_SECURE=true` and set `FRONTEND_ORIGINS` to the Vercel origin(s)
- **Supabase:** [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md) · **Deploy:** [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · **Ops:** [`docs/OPS_RUNBOOK.md`](docs/OPS_RUNBOOK.md)

## Vercel (project URL and domain)

**Free `vercel.app` URL (team projects):** Vercel assigns a stable production hostname in the form **`https://<project-name>-<team-slug>.vercel.app`**. For this repo’s redirect and CORS examples we use **`https://sulyap-lasalyano-gecapistranos-projects.vercel.app`**. Longer URLs (with `-git-main-` or a deployment id) also appear in the dashboard; see [Generated deployment URLs](https://vercel.com/docs/deployments/generated-urls).

**Shorter `https://sulyap-lasalyano.vercel.app`:** That hostname is **not** guaranteed for every team/project. To try to attach it: **Project → Settings → Domains → Add** `sulyap-lasalyano.vercel.app`. If Vercel accepts it, it will show as verified with no DNS changes. If it is unavailable or not offered, use the **`…-gecapistranos-projects.vercel.app`** URL above for links and backend `FRONTEND_ORIGINS`.

Under **Settings → Domains**, remove broken custom domains you are not using. The HTTP→HTTPS redirect in `frontend/vercel.json` targets the stable team hostname above.

## Naming Update

This repository has been updated to the Sulyap Lasalyano project identity.

If your local folder still uses the old project name, you can rename it manually:

```powershell
cd D:\projects
Rename-Item "<old-folder-name>" "sulyap-lasalyano"
```

## License

Academic project for DLSU-D. Institutional assets (datasets, trained weights, media) remain subject to school/team ownership and sharing restrictions.


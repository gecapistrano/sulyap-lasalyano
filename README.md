# Sulyap Lasalyano

Sulyap Lasalyano is a web-based AR + ML museum experience for the DLSU-D AEA-IRC Presidents' Memorabilia Gallery.

Visitors can point a phone camera at supported memorabilia and the system attempts real-time recognition using a YOLO/ONNX pipeline, then presents contextual content in an interactive UI.

> **Layout note:** The primary public UI is `presidents-memorabilia/` (static site). `backend/` remains for API integration. The older `frontend/` app is legacy if present and is not the primary visitor surface.

## Core Features

- Browser-based camera scanner with on-device model inference
- Splash/onboarding/camera flow optimized for mobile web
- Gesture-driven knowledge graph viewer (frontend module)
- Secure FastAPI backend scaffold (auth, CSRF, rate limiting)
- ML workspace under `ml/` for training, exports, and evaluation artifacts

## Tech Stack

- Primary UI: static site in `presidents-memorabilia/`
- Legacy frontend (optional): Next.js / React app under `frontend/`
- Backend: FastAPI, Pydantic, SQLAlchemy
- ML: Ultralytics YOLOv8, PyTorch, ONNX
- Deployment: Vercel (`presidents-memorabilia/`), Render (FastAPI) — see `docs/DEPLOYMENT.md`
- Database: Supabase Postgres via `DATABASE_URL` (SQLite still ok for local smoke tests)

## Repository Structure

```text
sulyap-lasalyano/
+-- presidents-memorabilia/  # Primary public UI (static)
+-- backend/                 # FastAPI API and security middleware
+-- frontend/                # Legacy Next.js app (kept for reference / API clients)
+-- supabase/                # Postgres schema + catalog seed for Supabase
+-- data/imports/            # Local memorabilia workbook copies (gitignored binaries)
+-- ml/                      # Training scripts, datasets, runs, weights
+-- docs/                    # DEPLOYMENT.md, OPS_RUNBOOK.md, SUPABASE_SETUP.md
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

### 2) Primary UI (`presidents-memorabilia/`)

Serve the static site locally (any static server), for example:

```bash
cd presidents-memorabilia
npx --yes serve .
```

### 3) Legacy frontend (optional)

```bash
cd frontend
npm install
npm run dev
```

Legacy frontend default URL: `http://localhost:3000` (Next.js)

### 4) Backend

```bash
cd backend
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# macOS/Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Backend default URL: `http://localhost:8000`

## Environment Notes

- Configure frontend env in `frontend/.env.local` (`NEXT_PUBLIC_API_BASE_URL`)
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


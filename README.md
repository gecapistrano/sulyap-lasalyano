# Sulyap Lasalyano

Sulyap Lasalyano is a web-based AR + ML museum experience for the DLSU-D AEA-IRC Presidents' Memorabilia Gallery.

Visitors can point a phone camera at supported memorabilia and the system attempts real-time recognition using a YOLO/ONNX pipeline, then presents contextual content in an interactive UI.

## Core Features

- Browser-based camera scanner with on-device model inference
- Splash/onboarding/camera flow optimized for mobile web
- Gesture-driven knowledge graph viewer (frontend module)
- Secure FastAPI backend scaffold (auth, CSRF, rate limiting)
- ML workspace under `ml/` for training, exports, and evaluation artifacts

## Tech Stack

- Frontend: React, Vite, Tailwind, onnxruntime-web
- Backend: FastAPI, Pydantic, SQLAlchemy
- ML: Ultralytics YOLOv8, PyTorch, ONNX
- Deployment: Vercel (frontend), Render-compatible backend

## Repository Structure

```text
sulyap-lasalyano/
+-- frontend/          # SPA (scanner, splash, onboarding, gesture modules)
+-- backend/           # FastAPI API and security middleware
+-- ml/                # Training scripts, datasets, runs, weights
+-- docs/              # Setup/deployment/API notes
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

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend default URL: `http://localhost:5173`

### 3) Backend

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

- Configure frontend env in `frontend/.env` (or `.env.local`)
- Configure backend env in `backend/.env`
- For split hosting (frontend + backend on different domains), keep secure cookie settings enabled in production

## Vercel (project URL and domain)

The deployment hostname `*.vercel.app` comes from the **Vercel project name** and your team slug (for example `archive-dlsud-…-gecapistranos-projects.vercel.app`). In the Vercel dashboard: open the project → **Settings → General → Project Name** and rename it to something like `sulyap-lasalyano` so the default URL becomes `sulyap-lasalyano-<team>.vercel.app`.

For the short production domain **`sulyap-lasalyano.vercel.app`**: **Settings → Domains** → remove `archive-dlsud.vercel.app` if it is no longer needed → **Add** `sulyap-lasalyano.vercel.app` and set it as the primary production domain. The HTTP→HTTPS redirect in `frontend/vercel.json` already targets `https://sulyap-lasalyano.vercel.app`.

## Naming Update

This repository has been updated to the Sulyap Lasalyano project identity.

If your local folder still uses the old project name, you can rename it manually:

```powershell
cd D:\projects
Rename-Item "<old-folder-name>" "sulyap-lasalyano"
```

## License

Academic project for DLSU-D. Institutional assets (datasets, trained weights, media) remain subject to school/team ownership and sharing restrictions.


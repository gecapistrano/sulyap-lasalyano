# Environment setup (step 3)

Your production frontend URL: **https://archive-dlsud.vercel.app** (no trailing slash in `FRONTEND_ORIGINS`).

## Backend (`backend/.env`)

1. Copy the example file:
   ```bash
   cp backend/.env.example backend/.env
   ```
   On Windows PowerShell:
   ```powershell
   Copy-Item backend\.env.example backend\.env
   ```
2. Set a strong secret (do not reuse the placeholder):
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
   Put the output in `JWT_SECRET_KEY=...` in `backend/.env`.
3. Keep `FRONTEND_ORIGINS` including both:
   - `http://localhost:5173` (local Vite)
   - `https://archive-dlsud.vercel.app` (your Vercel app)
4. For production API deployment, set `APP_ENV=production` and ensure `FRONTEND_ORIGINS` lists only **https** public origins (no `localhost`).

## Frontend (`frontend/.env` or `frontend/.env.local`)

1. Copy `frontend/.env.example` to `frontend/.env.local`.
2. Point `VITE_API_BASE_URL` at your API:
   - Local: `http://127.0.0.1:8000`
   - Vercel builds: add **Environment Variables** in the Vercel dashboard for `VITE_API_BASE_URL` (your deployed API URL, https).

## Vercel dashboard

After you deploy the API, add `VITE_API_BASE_URL` under **Settings → Environment Variables** for Production (and Preview if needed), then redeploy the frontend.

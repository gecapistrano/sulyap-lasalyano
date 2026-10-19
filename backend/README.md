# FastAPI Security Baseline

## Controls Implemented

1. JWT authentication with refresh token rotation using HttpOnly + Secure cookies.
2. Dependency-injected authentication (`get_current_active_user`) and RBAC (`require_roles`).
3. IDOR protection by validating ownership on resource-by-ID operations.
4. Strict Pydantic schemas (`extra="forbid"`) for request payloads.
5. CORS allowlist based on configured frontend origins only.
6. Defense headers middleware: CSP, HSTS (prod), X-Frame-Options, nosniff, and more.
7. Rate limiting on sensitive routes (`/auth/login` and `/artifacts` search/list endpoint).
8. Generic sanitized error responses with detailed server-side logging.

Visitor browse/scan reads use public `GET /catalog/*` (published collection only). Admin mutations stay on `/artifacts` with auth + CSRF.

Local curator seed (created / synced on non-production startup):
- username alias: `admin` (maps to `curator@example.com`)
- password: `admin123` when `APP_ENV` is not `production` and `ADMIN_SEED_PASSWORD` is unset
- production: set a strong `ADMIN_SEED_PASSWORD` before first seed (never rely on `admin123`)
- UI: static home plaque long-press → `/curator` bridge → Next.js Curator Desk (not linked in public nav)

Hosted DB: set `DATABASE_URL` to a Supabase Postgres URI (see `docs/SUPABASE_SETUP.md`). Schema/seed live under `supabase/`. Smoke-check with `python scripts/check_db.py` from `backend/`.

## Run Locally

```bash
python -m venv .venv
. .venv/bin/activate  # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --app-dir backend
```

## Security Lint

```bash
python backend/scripts/security_lint.py
```

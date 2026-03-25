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

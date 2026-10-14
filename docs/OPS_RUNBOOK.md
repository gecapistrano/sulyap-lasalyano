# Ops runbook — handover (no laptop dependency)

Daily work happens on the **hosted** site. The original developer’s PC is not required.

## Roles

| Role | Tools |
|------|--------|
| Curator / admin | Production site → **Curator Desk** (`/curator`) |
| ML operator | Training machine or CI + `ml/scripts/train_and_deploy.py` |
| Platform owner | Vercel + Render + Supabase org accounts |

## Add or edit an artifact

1. Open `https://<vercel-host>/curator` and sign in.
2. **Sulyap Lasalyano Artifacts** → Add or select a row.
3. Fill Accession ID (`id_code`), title, full description; optional year/country/type.
4. Upload curator photo and/or 3D model (`.glb` or `.obj`).
5. Toggle **Published** when ready for visitors.
6. Optional: enable **AI assist for this item** → Suggest with AI → Accept.

## Add or edit a president

1. Curator Desk → **DLSU Presidents**.
2. Edit name, service years, biography, portrait URL, published.

## Bulk import (occasional)

1. Place workbook/CSV in `data/imports/` (or any path).
2. On a machine with `DATABASE_URL` pointing at Supabase:

```powershell
cd backend
python scripts/import_memorabilia_xlsb.py --path ..\data\imports\file.xlsx
```

Prefer `.xlsx`/`.csv` for portability. `.xlsb` needs Excel COM on Windows.

## Live Scan model update (iterative)

1. Ensure catalog `id_code` values match training class names.
2. After retraining, deploy ONNX + training-order labels: `python ml/scripts/deploy_model.py --onnx <path>` (do not overwrite Live Scan `labels.txt` from the catalog)
3. Train/deploy: `python ml/scripts/train_and_deploy.py` (see `ml/README.md`)
4. Commit/deploy updated `frontend/public/models/` (ONNX + `labels.txt`) with the Next.js app.

Catalog rows can exist before the next train cycle; browse works immediately; scan catches up after deploy.

## Secrets ownership

Keep these in the org dashboards (not personal laptops only):

- Supabase DB password / URI
- Render `JWT_SECRET_KEY`, `ADMIN_SEED_PASSWORD`, `LLM_*`
- Vercel `NEXT_PUBLIC_API_BASE_URL`

Rotate curator password after handover. Never commit `.env` files.

## Incident basics

| Symptom | Check |
|---------|--------|
| Blank browse / empty catalog | Render logs; Supabase `DATABASE_URL`; migrations `001`+`003` applied |
| Login works locally, fails on Vercel | `FRONTEND_ORIGINS`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`, HTTPS API URL |
| CSRF / 403 on save | Session cookie present; CSRF cookie + header; origin allowlist |
| Photos/models missing after Render deploy | Ephemeral disk — re-upload or attach persistent disk / object storage |
| Scan wrong / no class | `labels.txt` must match ONNX class order (`ml/weights/classes.txt`); never replace with sorted catalog codes; bump `MODEL_ASSET_VERSION` / redeploy Next |

Full deploy steps: [DEPLOYMENT.md](./DEPLOYMENT.md).

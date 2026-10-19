# Supabase database setup (Sulyap Lasalyano)

Your FastAPI backend talks to **Postgres**. Supabase hosts that Postgres.
Visitors still use the React app → API → database (not the Supabase anon key from the browser).

---

## What you do manually (dashboard only)

### 1. Create a Supabase project

1. Open [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. **New project**.
3. Pick an org, name (e.g. `sulyap-lasalyano`), a **strong database password**, and a region close to you (e.g. `Southeast Asia (Singapore)`).
4. Save the database password somewhere safe — Supabase shows it once.
5. Wait until the project status is healthy (usually 1–2 minutes).

### 2. Copy the Postgres connection string

1. In the project: **Project Settings** (gear) → **Database**.
2. Under **Connection string**, choose **URI**.
3. Prefer **Session mode** (port **5432**) for the long-lived FastAPI process.
4. Replace `[YOUR-PASSWORD]` with the database password from step 1.
5. Copy the full URI. It looks like:

```text
postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

### 3. Point the backend at Supabase

1. Open `backend/.env` (create it from `backend/.env.example` if needed).
2. Set:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

Paste the URI as-is. The app upgrades it to the `psycopg` driver and adds `sslmode=require` for Supabase hosts.

3. Keep your existing JWT / cookie / `FRONTEND_ORIGINS` values.

### 4. (Optional but recommended) Run schema + seed in the SQL Editor

If you want tables visible in the Supabase **Table Editor** before starting the API:

1. Dashboard → **SQL Editor** → **New query**.
2. Paste the full contents of `supabase/migrations/001_init.sql` → **Run**.
3. New query → paste `supabase/seed.sql` → **Run**.
4. Confirm under **Table Editor**: `users`, `presidents`, `artifacts` (and empty `refresh_tokens`).

If you skip this step, starting FastAPI still creates tables and seeds the catalog automatically when the DB is empty.

### 5. (Production host) Set the same `DATABASE_URL`

On Render (or wherever the API runs), add env var `DATABASE_URL` with the **same** Supabase URI (and your production JWT / CORS settings). Redeploy.

---

## What is already automated in this repo

| Piece | Location |
| --- | --- |
| Schema SQL | `supabase/migrations/001_init.sql` |
| Catalog seed SQL (10 presidents, 26 artifacts, curator) | `supabase/seed.sql` |
| Postgres driver | `psycopg` in `backend/requirements.txt` |
| URI normalization + SSL for Supabase | `backend/app/core/database.py` |
| Auto `CREATE TABLE` + seed on API startup | `backend/app/main.py` + `catalog_seed.py` |
| Env template | `backend/.env.example` |

Curator after seed:

- username / email: `admin` or `curator@example.com`
- password: `admin123` locally when `ADMIN_SEED_PASSWORD` is unset (set a strong `ADMIN_SEED_PASSWORD` before first production seed)

---

## Verify locally after step 3

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Then open:

- API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- Catalog: [http://127.0.0.1:8000/catalog/presidents](http://127.0.0.1:8000/catalog/presidents)

In Supabase **Table Editor**, you should see the same presidents and artifacts.

---

## Do not commit

- `backend/.env` (contains the DB password)
- Supabase service role / anon keys (this app does not need the anon key for the catalog)

---

## Regenerate seed SQL (optional)

If catalog rows in `backend/app/services/catalog_seed.py` change:

```powershell
cd backend
python scripts\generate_supabase_seed.py
```

# Public demo repo (step 5) — how to do it

This **cannot** be created automatically from Cursor: a second GitHub repository is created **on github.com** by you. Use this checklist so the public copy never includes institutional data.

## Why a separate repo?

- **Private repo** = real gallery data, real keys, internal URLs.  
- **Public repo** = code + **only** mock/public datasets for outsiders to test.  
Copying the whole private repo to public risks leaking paths, images, or `.env` if someone makes a mistake.

## Steps

### 1. Create a new empty repository on GitHub

- Name it e.g. `archive-dlsud-demo` or `archive-dlsud-public`.
- **Do not** initialize with a README if you will push from local (avoids merge noise).

### 2. Clone your private repo to a new folder (working copy for public)

```bash
git clone <your-private-repo-url> archive-dlsud-public
cd archive-dlsud-public
```

### 3. Remove private / institutional content

Before the first public push, delete or exclude:

- Real datasets: e.g. `ml/dataset/` if it contains real photos.
- Any `*.db` or dumps with real users/artifacts.
- Any committed `.env`, `.env.local`, or secrets.
- Internal-only docs, watermarked images, or gallery-specific assets.

Use only **mock** JSON/images or clearly labeled public test data.

### 4. Point config at “demo” only

- `README.md`: state clearly that data is **mock / public test only**.
- `FRONTEND_ORIGINS` / `VITE_API_BASE_URL`: use demo domains or Vercel preview URLs, not internal hosts.
- Never paste real `JWT_SECRET_KEY` or database URLs into the public repo.

### 5. New git remote and push

```bash
git remote remove origin
git remote add origin https://github.com/<you>/archive-dlsud-public.git
git checkout -b main   # if needed
git push -u origin main
```

### 6. Re-enable automation on the public repo

Copy these from the private repo so checks still run:

- `.github/workflows/` (e.g. `security-guardrails.yml`, `security-audit.yml`)
- `backend/scripts/security_lint.py`
- `.cursor/rules/` (optional, for your own Cursor use)

Turn on **Actions** in the public repo settings.

### 7. Ongoing rule

**Private repo** = source of truth for real deployment.  
**Public repo** = periodic sync of **code only**, plus hand-picked public fixtures — never sync institutional datasets.

---

If you later use **GitHub “fork”** from private to public, GitHub may block private→public fork in some cases; a fresh clone + new remote (above) is the most reliable pattern.

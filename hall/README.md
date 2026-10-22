# Museum hall

Public visitor site for Sulyap Lasalyano (home, Live Scan, Knowledge Graph, president pages).
No build step. Serve with `node serve.mjs` from this folder, or `npm run dev:hall` from the repo root.

`frontend/` is Curator Desk only — visitors use this hall.

## Layout

```
index.html      markup + two inline scripts (theme boot, loading curtain)
404.html        standalone not-found page (inlined tokens)
styles/         numbered CSS in load order
scripts/        numbered JS in load order
vercel.json     security headers for static deploy
site.webmanifest
icon.svg        (+ optional favicon / PWA PNGs)
```

`styles/` and `scripts/` are numbered because **order is part of the meaning**.

### styles/

| file | what lives there |
|---|---|
| `01-tokens.css` | colour tokens, four palettes, resets, focus ring, skip link |
| `02-hero.css` | dark hero card, lens headline, intro, theme/lang controls |
| `03-stage.css` | cream stage, stickers, collection panel, about |
| `04-view-chrome.css` | sticky bar, corner badge, flip wipe, mobile sheet |
| `05-sections.css` | section headings, skip pill |
| `06-progress.css` | scroll progress, “what’s next” |
| `07-galleries.css` | gallery cards, `<dialog>` lightbox, footer |
| `08-responsive.css` | mobile / portrait / ultrawide sweeps |
| `09-feedback.css` | loading curtain, toasts, no-JS, image fail |

### scripts/

| file | role |
|---|---|
| `01-hero.js` | lens, flip wipe, `window.flipView()` |
| `02-i18n.js` | `T` dictionary, `data-i` / `data-i-label`, placeholders |
| `03-artwork.js` | inline SVG art (no external images) |
| `04-gallery.js` | grid + native `<dialog>` lightbox |
| `05-view-chrome.js` | sticky bar, badge, mobile menu |
| `06-theme.js` | light/dark + `prefers-color-scheme` + persistence |
| `07-routing.js` | `#/`, `#/history`, `#/gallery` + warm/cool |
| `08-progress.js` | `--p`, nav glow, skip pill |
| `09-a11y.js` | reduced-motion helper |
| `10-feedback.js` | `window.toast`, `window.copyText`, curtain rail, offline |

Every file is one or more IIFEs. Cross-file globals:

| global | set in | used by |
|---|---|---|
| `window.flipView()` | `01-hero.js` | bar, badge, routing |
| `window.toast(kind, title, detail)` | `10-feedback.js` | theme, lang, offline |
| `window.copyText(text, done)` | `10-feedback.js` | reserved for future copy actions |

No sound / music layer (by design).

## The two inline scripts

1. **Theme setter** in `<head>` — sets `data-theme` (and `warm` for `#/gallery`) before first paint.
2. **Loading curtain** at the top of `<body>` — adds the `js` class and arms the failsafe timeout.

## Themes

- **Polarity (light/dark):** defaults from `prefers-color-scheme`, manual toggle persists in `localStorage` (`pm-theme`).
- **Warmth:** Home + History = cool tight (`16px` / `0.25s`). Gallery = warm soft (`26px` / `0.45s`) via `html.warm`.
- Palette keeps La Salle green (`#00703C` family).

## i18n

EN / FIL via `window.T` and `data-i` / `data-i-label`. Bracketed `[placeholders]` render with a dotted underline (`.ph`). Language persists as `pm-lang`.

## Routes

| hash | view |
|---|---|
| `#/` | Home (cool) |
| `#/history` | Home, scroll to collection (cool) |
| `#/gallery` | Gallery (warm) |

## Live Scan

`scan.html` (also `/scan`) is the on-device artifact scanner: rear camera + YOLOv8 detection ONNX (`models/model.onnx`, 640×640, 47 RD classes in `labels.txt`) via onnxruntime-web (`vendor/onnxruntime-web/`). The hero CTA and Live Scan “Try” link open this page.

- **Local:** from this folder run `node serve.mjs` (default `http://127.0.0.1:8765`), then open `/scan`. Do **not** use Python `http.server` — it serves `.mjs` as `text/plain`, which blocks ORT’s WASM loader and shows “Could not load the recognition model.”
- **Assets:** `models/` + `vendor/onnxruntime-web/` must be present in this folder (and committed for Vercel). Sync from the Next app with `node scripts/sync-scan-assets.mjs`; deploy checks via `node scripts/check-scan-assets.mjs`.
- **Catalog details:** leave `apiBaseUrl` empty so `/catalog` and `/media` go through `serve.mjs` to local FastAPI (`SULYAP_API_PROXY`, default `http://127.0.0.1:8000`). Local API serves photos/GLBs from `backend/uploads/` instead of Supabase. Production `vercel.json` rewrites `/catalog` to Render, so Scan/KG work without `?api=`.
- **Deploy:** `vercel.json` allows `camera=(self)` and WASM eval only on `/scan` / `/scan.html`; the rest of the site keeps `camera=()`. Set Vercel Root Directory to `hall`.

## Curator desk (staff, direct URL only)

`/curator` is **not** linked from the public home. Long-press (~3s) the hanging plaque’s Sulyap logo to open it. Locally `curator.html` auto-bridges to `http://127.0.0.1:3000/curator`. Production `vercel.json` proxies `/curator` to the staff Next.js desk on the same hall origin (Render CORS already allows it). Local/dev login: `admin` / `admin123`.

## Deploying

Vercel static — set **Root Directory** to `hall`. `404.html` at that root is used for unmatched routes. `/scan` rewrites to `scan.html`. `/catalog` rewrites to the Render API.

## Accessibility

Skip link, visible focus ring, landmarks, `aria-current` on nav, `aria-expanded` on menu, decorative SVG `aria-hidden`, `prefers-reduced-motion` (no wipe / hero motion), safe-area insets, 44–48px touch targets.

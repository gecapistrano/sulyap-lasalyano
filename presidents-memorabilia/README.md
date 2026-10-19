# President’s Memorabilia

Static site for the President’s Memorabilia collection (De La Salle University).
No build step, no dependencies. Open `index.html` in a browser, or deploy this
folder as the Vercel root.

> **Temporary home.** This folder is a standalone prototype. When the UI/UX is
> polished, it will be integrated into the official Sulyap Lasalyano frontend
> and its subfolders.

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

## Deploying

Vercel static — set **Root Directory** to `presidents-memorabilia`. `404.html` at that root is used for unmatched routes.

## Accessibility

Skip link, visible focus ring, landmarks, `aria-current` on nav, `aria-expanded` on menu, decorative SVG `aria-hidden`, `prefers-reduced-motion` (no wipe / hero motion), safe-area insets, 44–48px touch targets.

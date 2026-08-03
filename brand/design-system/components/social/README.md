# Social feed templates — Satori source

JSX components for the automated feed-post pipeline (Satori: JSX → PNG/SVG).
Distinct from `ui_kits/social/` (a hand-designed HTML kit for manual posts) —
these are meant to be **imported into the Satori render pipeline as-is**, one
template per format, reused across all three platforms by passing that
platform's canvas size.

## Formats
| Component | Use |
|---|---|
| `StatementPost` | Bold text on branded background — announcements, thought leadership |
| `VacancyPost` | Job title + location + sector tag — auto-generated per item from the XML vacatures feed |
| `PhotoFeaturePost` | Branded overlay on a warehouse/logistics/food photo |
| `StoryPost` | Instagram/Facebook Story (1080×1920, fixed) — full-bleed photo + brand-red panel |

## Feed canvas per platform
```js
import { PLATFORM_SIZES } from './tokens.js';
// instagram 1080×1080 · facebook 1200×630 · linkedin 1200×627
```
Every template takes `width`/`height` directly and reflows itself — square
canvases get a stacked layout, landscape canvases (aspect > 1.3) get a
side-by-side layout. Render the same template 3× with each platform's size.

## Why these look different from `ui_kits/social/`
Satori renders a plain JSX tree with no browser, no CSS engine, no JS at
render time. These files avoid everything Satori can't do:
- **No CSS variables** — every color/font is a literal (from `tokens.js`),
  not `var(--light-red)`.
- **No `clip-path`** — the notch corner motif is not used here; badges/pills
  are plain rounded rectangles instead.
- **No `<i data-lucide>` + runtime icon swap** — icons are static inline SVG
  (`icons.jsx`), since there's no JS pass to replace them.
- **No image tags without real bytes** — `photoSrc`/`logoSrc` must be an
  actual fetchable URL or a `data:` URI; Satori fetches images itself but
  cannot resolve anything requiring a live DOM/CSS cascade.
- Layout uses flexbox only (`display:flex` + `gap`), which Satori supports;
  no CSS grid.

## Fonts
Satori does not read `@font-face`/Google Fonts — the pipeline must load
Montserrat (700/800) and Open Sans (400/600/700) as font buffers and pass
them in the `fonts` option of `satori()`. Family names used here match the
brand tokens: `Montserrat` (display/headings) and `Open Sans` (body/meta).

## Logo
Every template defaults to the **real brand mark**, embedded as base64 in
`logos.js` (`LOGO_WHITE` for dark/photo backgrounds, `LOGO_COLOR` for white
backgrounds) — zero extra fetches at render time. Pass `logoSrc` to override.

## Photos
`tokens.js` exports `PLACEHOLDER_PHOTOS` (Unsplash) used only for previewing
in `ui_kits/social/feed/index.html`. Swap in real Light photography — encode
as base64 `data:` URIs for a self-contained render, same as the profile
banner SVG exports.

## Files
| File | Exports |
|---|---|
| `tokens.js` | `TOKENS`, `PLATFORM_SIZES`, `PLACEHOLDER_PHOTOS` |
| `logos.js` | `LOGO_WHITE`, `LOGO_COLOR` — base64 brand mark |
| `icons.jsx` | `Icon` — static SVG, names: `map-pin`, `clock`, `arrow-right`, `truck`, `factory`, `sparkles`, `badge-check`, `briefcase` |
| `StatementPost.jsx` | `StatementPost` |
| `VacancyPost.jsx` | `VacancyPost` |
| `PhotoFeaturePost.jsx` | `PhotoFeaturePost` |
| `StoryPost.jsx` | `StoryPost` — fixed 1080×1920 |

Preview all ten (3 formats × 3 platforms + story) at `ui_kits/social/feed/index.html`.

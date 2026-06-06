# Light Personeelsdiensten — Design System

A design system for **Light Personeelsdiensten B.V.**, a Rotterdam-based Dutch
staffing agency (*uitzendbureau*) specialising in **production, logistics and
cleaning personnel** (*productie, logistiek en schoonmaakpersoneel*).

> **Source of truth:** the live WordPress site at
> [lightpersoneelsdiensten.nl](https://lightpersoneelsdiensten.nl/) and the
> brand logo (red banner + grey block + white feather). This system reconstructs
> the brand foundations from those public materials; it is not derived from a
> private codebase or Figma file.

---

## Company / product context

Light Personeelsdiensten places workers across the full production chain —
*"van het begin tot aan het eindproduct"* — for food-production, logistics and
cleaning clients. The brand voice is built around deep operational know-how:
*"wij kennen de klappen van de zweep"* (we know the ropes) and *"de productie
moet draaien, punt"* (production has to keep running, full stop).

There are **two audiences**, and almost every surface speaks to one of them:

| Audience | Dutch term | What they want |
|---|---|---|
| **Clients / employers** | *opdrachtgevers* | reliable, screened production & logistics staff, business advice |
| **Job seekers** | *werkzoekenden* | clear vacancies, honest expectations, fast placement |

Contact split mirrors this: `administratie@lightpersoneelsdiensten.nl` for
clients, `vacature@lightpersoneelsdiensten.nl` for job seekers.

**Key facts**
- Light Personeelsdiensten B.V. · Selma Lagerlöfweg 63, 3069 BT Rotterdam · +31 10 760 0857
- Certified by **Stichting Normering Arbeid (SNA)** — a trust marker shown in the footer.
- Site sections: Home · Over ons · Zakelijke diensten · Vacatures · Contact.
- Built on WordPress (Handyman theme) by Zite Media.

### Surfaces

1. **Marketing website** (`ui_kits/website/`) — public site that converts
   *opdrachtgevers* into clients and *werkzoekenden* into placements. Three
   service tiles (the company, "Werken bij…", business services) and a vacancy feed.

---

## Sources

| Source | Access |
|---|---|
| Live website | https://lightpersoneelsdiensten.nl/ (text scraped) |
| Brand logo | `assets/light-logo-beeldmerk.png` (provided by user; brand red `#be1e2d`, grey `#787c7e` sampled directly) |
| Favicon | `wp-content/uploads/2022/12/270-favicon-light-personeelsdiensten.png` (not imported) |

> **Note on fonts & exact layout:** the WordPress theme's licensed fonts and CSS
> were not available, so type is a documented *substitution* (see Visual
> foundations → Typography). Flag this with the user and swap in real files if provided.

---

## Index / manifest

| Path | Purpose |
|---|---|
| `styles.css` | Root entry — `@import`s all tokens. Link this one file. |
| `tokens/colors.css` | Brand red, grey ramp, semantic aliases. |
| `tokens/typography.css` | Families, scale, weights, helper classes. |
| `tokens/spacing.css` | Spacing, radius, the notched-corner clip, shadows, motion. |
| `tokens/fonts.css` | Google Fonts import (substitution). |
| `assets/` | Logos (primary, white reverse, ink, red mono, feather mark, wordmark). |
| `guidelines/` | Foundation specimen cards + the full Brand & UI overview sheet. |
| `components/` | Reusable React primitives (Button, Card, Badge, Input, Tag, JobCard…). |
| `ui_kits/website/` | Marketing-site recreation. |
| `ui_kits/social/` | Social media kit — square / story / LinkedIn templates. |
| `research/` | Source notes — site scrape, sampled colors, copy extract, company facts. |
| `SKILL.md` | Agent-Skill manifest for download/Claude Code. |

---

## Content fundamentals

> **Read first if you're writing copy.** Tone is **direct, plain-spoken, and
> confident** — a no-nonsense operator who knows the factory floor, not a
> corporate recruiter.

### Voice
- **Plain Dutch, short sentences.** Punchy and declarative. *"De productie moet
  draaien, punt."* End a point and move on.
- **Operationally credible.** Reference the real work: shifts, hygiene rules,
  safety regulations, the snijhal, the etiketteermachine. *"Wij kennen de
  klappen van de zweep."*
- **Warm but not soft.** Encouraging toward job seekers — *"echte doorzetters die
  gemotiveerd zijn"* — without slogans or hype.
- **Address the reader directly.** *"u"* / *"uw bedrijf"* for clients, *"je" / "jou"*
  for job seekers. Match the register to the audience.
- **Bilingual-friendly.** Primary language is **Dutch**; keep Dutch domain terms
  even in English contexts (*uitzenden, opdrachtgever, vacature, snijhal*).

### Casing & mechanics
- **Sentence case** for headings and buttons: "Enkele van onze vacatures",
  "Lees meer", "Bekijk alle vacatures".
- **Title Case** only for proper nouns: *Light Personeelsdiensten B.V.*,
  *Stichting Normering Arbeid*, *Rotterdam*.
- **The wordmark** "Light" is the brand's only all-bold moment; the eyebrow
  wordmark may be spaced ("L I G H T") echoing the logo.
- **No emoji. No exclamation-mark spam.** One emphatic line at most ("…vak apart!").
- **Numerals for data:** "236 words", "+31 10 760 0857", read-times.

### Worked examples
| ✅ On-brand | ❌ Off-brand |
|---|---|
| "Specialist in het uitzenden van productie, logistiek en schoonmaakpersoneel" | "Your #1 partner for amazing staffing solutions!" |
| "De productie moet draaien, punt." | "We help businesses unlock their full potential" |
| "Wij zoeken echte doorzetters." | "Join our incredible team of rockstars 🚀" |
| "Lees meer" / "Bekijk alle vacatures" | "Click here to learn more!!!" |

---

## Visual foundations

### Colors
Two brand colors, sampled from the logo, with a cool-grey neutral ramp.

| Role | Token | Hex |
|---|---|---|
| Primary brand red (banner, CTAs) | `--light-red` | `#be1e2d` |
| Red hover / press | `--light-red-600` / `--light-red-700` | `#a81927` / `#8d1420` |
| Brand grey (logo block) | `--grey-500` | `#787c7e` |
| Ink / body text | `--grey-900` | `#1f2123` |
| Default border | `--grey-200` | `#e0e2e4` |
| Soft background | `--grey-50` | `#f6f7f8` |

- **Red is the accent, not the field.** Used for the banner, primary buttons,
  links, active states, and the occasional full-bleed CTA strip — never as a
  large page background.
- **Grey carries structure.** The logo grey and its ramp do dividers, dark
  sections (footer), captions and chrome.
- Semantic feedback colors (`--green`, `--amber`, `--blue`) are muted and only
  used for status (e.g. "vacature open").

### Typography
- **Display / headings — Montserrat (800/900).** Stands in for the heavy,
  slightly-rounded geometric "Light" wordmark. Tight tracking on large sizes.
  H1 44 / H2 32 / H3 24 / H4 19; hero display 64.
- **Body — Open Sans 16 / 1.6.** Highly readable, neutral, WordPress-native feel.
- **Mono — JetBrains Mono.** Phone numbers, reference codes, tabular figures.
- **Eyebrows** are uppercase Montserrat-bold with `0.14em` tracking, in red.
- `text-wrap: pretty` on body, `balance` on headings.

> **SUBSTITUTION:** Montserrat + Open Sans are Google-Fonts stand-ins for the
> theme's real (unavailable) faces. Replace with licensed files if provided.

### Backgrounds & imagery
- **White by default**, soft grey (`--grey-50`) for alternating sections, dark
  grey (`--grey-800`) for the footer / occasional inverse band.
- **Real photography** of the work: production lines, trucks, the snijhal,
  job interviews, cleaning. Cool/neutral grade, no warm filters, no stock
  "people pointing at laptops". Photos sit in cards with a hover zoom.
- **No gradients as page backgrounds, no patterns, no hand-drawn illustration.**
  The one signature flourish is the **notched corner** (`--clip-notch`) lifted
  from the logo banner — used sparingly on a CTA block or image badge.

### Cards
- White fill, `1px` `--grey-200` border, `--radius-md` (10px), `--shadow-xs` at
  rest → `--shadow-md` + red-tinted border on hover.
- Image-topped service/vacancy cards: image fills the top, content padded 24px,
  a red "Lees meer" link with arrow at the bottom.

### Borders, shadows, radius
- Borders: `1px --grey-200`; strong dividers `--grey-300`.
- Shadows: soft and low (`--shadow-xs/sm/md`); CTAs may use `--shadow-red`.
- Radius: **10px default**, 16px elevated, pill for badges/chips. Data tables
  and image viewports stay square. The notched corner is the brand's one
  non-rounded signature.

### Motion & states
- **Reserved.** Fades and ≤8px slides, 140–360ms, `--ease-out`. No bounce/spring/parallax.
- **Hover:** primary fill darkens 10% (`--color-primary-hover`); cards lift with
  `--shadow-md` and gain a faint red border; images scale ~1.04.
- **Press:** further darken (`--color-primary-press`); no shrink.
- **Focus:** 2px ring at `--color-focus-ring` (red 40%) with 2px offset.

### Layout
- Max content width **1180px**, 24px gutters. 12-column marketing grid.
- Sticky top bar with a thin red utility strip above the main nav (mirrors the
  site's "mail direct" + socials row).
- No fixed footer; page ends in a dark-grey footer with logo, address, SNA badge.

---

## Iconography

The site uses simple line icons (theme defaults) and a feather brand mark. For
artefacts we standardise on **[Lucide](https://lucide.dev)** via CDN — clean
1.5px stroke line icons that match the practical, no-frills tone.

### Rules
- **Lucide first**, 20–24px, 1.5 stroke, `currentColor`.
- Load in HTML: `<script src="https://unpkg.com/lucide@latest"></script>` then `lucide.createIcons()`.
- **No emoji. No unicode glyphs as icons** (use Lucide `Check`, `X`, `ArrowRight`).
- **Brand mark = the feather.** Always use the PNG logo assets; never redraw the
  feather or wordmark in SVG. Variants available in `assets/`:
  - `light-logo-beeldmerk.png` — primary, full colour (default).
  - `light-logo-white.png` — white reverse, for dark / red / photo backgrounds.
  - `light-logo-ink.png` — single-colour ink, for light backgrounds.
  - `light-logo-red.png` — single-colour brand red.
  - `light-mark.png` — feather beeldmerk only (app icon / avatar).
  - `light-wordmark.png` — "Light" wordmark only (compact spaces).
  - See `guidelines/brand-overview.html` for the full specimen sheet.

### Domain icon vocabulary
| Concept | Lucide icon |
|---|---|
| Vacancy / job | `Briefcase` |
| Production / factory | `Factory` |
| Logistics / driver | `Truck` |
| Cleaning | `Sparkles` / `SprayCan` |
| Location | `MapPin` |
| Shift / hours | `Clock` |
| Apply / forward | `ArrowRight`, `Send` |
| Certified (SNA) | `BadgeCheck`, `ShieldCheck` |
| Phone / mail | `Phone`, `Mail` |

---

*Maintained from public brand materials. When the brand updates (new fonts,
photography, colors), update `tokens/` and the matching section above.*

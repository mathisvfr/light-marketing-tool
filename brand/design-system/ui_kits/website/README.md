# Website UI kit — Light Personeelsdiensten

A recreation of the public marketing site at
[lightpersoneelsdiensten.nl](https://lightpersoneelsdiensten.nl/), rebuilt with
the design-system tokens and components.

## Screens / sections
| File | Section |
|---|---|
| `Header.jsx` | Dark utility strip ("mail direct: opdrachtgevers / werkzoekenden") + sticky white nav with logo and red Vacatures CTA. |
| `Hero.jsx` | Brand statement, dual CTAs, sector chips, and a photo with the notched SNA badge. |
| `ServiceTiles.jsx` | The three service cards (the company · Werken bij… · Zakelijke diensten). |
| `VacancyFeed.jsx` | "Enkele van onze vacatures" — category filter Tags + JobCard grid. |
| `CtaBand.jsx` | Full-width red call-to-action using the notched-corner motif. |
| `Footer.jsx` | Dark footer: logo, Rotterdam address, phone, link columns, SNA certification. |
| `App.jsx` | Composes the page; nav is interactive (filter, smooth-scroll, demo toast). |
| `index.html` | Entry point. Loads React + the DS bundle and mounts `App`. |

## How it loads
`index.html` loads the generated `_ds_bundle.js` and reads components from the
design-system namespace. In raw preview (before the bundle is compiled) it
transparently falls back to transpiling the component source with Babel, so the
page renders either way.

## Notes / cut corners
- It is a single interactive page; secondary routes (Over ons, Contact, single
  vacancy) are stubbed with a demo toast.
- Photography uses Unsplash placeholders standing in for the real site imagery
  (production lines, trucks, food processing, interviews). Swap for licensed
  brand photos in production.

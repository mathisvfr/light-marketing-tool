# Social media kit — Light Personeelsdiensten

Ready-to-use social templates built from the same brand elements as the website
(brand red `#be1e2d`, the feather logo, the notched-corner motif, Montserrat +
Open Sans). Drop in a photo and swap the copy.

## Formats
| Format | Size | Use |
|---|---|---|
| **Square** | 1080 × 1080 | Instagram / Facebook / LinkedIn feed |
| **Story** | 1080 × 1920 | Instagram / Facebook story (full-bleed photo + angled red panel) |
| **Banner** | 1200 × 627 | LinkedIn post / link preview |

## Templates included
- **Vacature (square)** — photo, category pill, "Wij zoeken" notch banner, title, meta, Solliciteer CTA, logo. Two examples (Logistiek, Productie).
- **Statement (square)** — dark, bold quote ("De productie moet draaien. Punt.").
- **Aankondiging (square)** — list of open roles with category badges + CTA.
- **Story** — full-bleed photo with the angled red banner and "link in bio" CTA. Two examples.
- **LinkedIn banner** — brand statement, sector chips, SNA badge.

## Files
| File | Purpose |
|---|---|
| `index.html` | The kit gallery — open this. |
| `templates.js` | Each template as a function returning real-pixel HTML. Edit copy/photos here. |
| `gallery.js` | Scales every template to fit and renders Lucide icons. |

## How to use / export
- Templates are drawn at true pixel size and scaled down only for preview.
- To export a single post, render the desired template full-size (remove the
  `transform: scale()` on its `.post`) and screenshot at 1080/1200 px, or hand
  these specs to a designer.
- Photography is Unsplash placeholder; replace with real Light photos.

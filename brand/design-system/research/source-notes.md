# Research & source notes — Light Personeelsdiensten

Source material behind this design system. Mirrors the role of Geo Insights'
`research/` folder. Nothing here is a finished surface — it's the evidence the
tokens, copy and UI kits are grounded in.

---

## Sources

| Source | Type | Access |
|---|---|---|
| [lightpersoneelsdiensten.nl](https://lightpersoneelsdiensten.nl/) | Live marketing site (WordPress, "Handyman" theme by Zite Media) | Public — text scraped 2026-06 |
| Brand logo (`assets/light-logo-beeldmerk.png`) | Badge logo — grey block + white feather + red "Light" banner | Provided by user |
| Favicon | `wp-content/uploads/2022/12/270-favicon-light-personeelsdiensten.png` | Public (not imported) |

**Not available** (would improve fidelity if provided):
- Licensed brand fonts (the wordmark face). Currently substituted with Montserrat + Open Sans.
- Real brand photography (production lines, trucks, snijhal, cleaning). Currently Unsplash placeholders.
- Brand styleguide / logo variants (white knockout, horizontal lockup).

---

## Colors sampled from the logo

Pixel-sampled directly from `assets/light-logo-beeldmerk.png`:

| Region | Hex | Token |
|---|---|---|
| Red banner | `#be1e2d` | `--light-red` |
| Grey block | `#787c7e` | `--grey-500` |
| Feather / "Light" text | `#ffffff` | `--white` |

---

## Company facts

- **Name:** Light Personeelsdiensten B.V.
- **What:** Dutch staffing agency (*uitzendbureau*) for **production, logistics & cleaning** personnel.
- **Address:** Selma Lagerlöfweg 63, 3069 BT Rotterdam
- **Phone:** +31 10 760 0857
- **Certification:** Stichting Normering Arbeid (SNA) — shown in footer as a trust marker.
- **Socials:** Facebook (LightPersoneelsdiensten), X (@light_bv), Tumblr (lightbv), LinkedIn (company/lightbv).
- **Contact split:** `administratie@…` for *opdrachtgevers* (clients), `vacature@…` for *werkzoekenden* (job seekers).
- **Site map:** Home · Over ons · Zakelijke diensten · Vacatures · Contact · (Algemene Voorwaarden, Privacy, Ziekteverzuim protocol).

### Two audiences
1. **Opdrachtgevers** (clients/employers) — want reliable, screened staff + business advice.
2. **Werkzoekenden** (job seekers) — want clear vacancies, honest expectations, fast placement.

---

## Copy extract (verbatim, for tone reference)

> "Specialist in het uitzenden van productie, logistiek en schoonmaakpersoneel"

> "Omdat wij al jarenlang in de productiebranche medewerkers mogen inzetten van het begin tot aan het eindproduct, kennen wij de klappen van de zweep. Kortom, de productie moet draaien, punt. Het vinden van deze specifieke medewerkers is een vak apart. En laat dit nu nou juist ons vak zijn!"

> "Wij zoeken echte doorzetters die gemotiveerd zijn dit productiewerk fulltime uit te voeren. Het werk moet worden uitgevoerd onder de strenge veiligheids- en hygiëne reglementen die gelden op de locatie."

> "Door onze specifieke kennis van de branche weten wij wat er speelt op de markt én op de werkvloer. Wij geven u graag persoonlijk advies dat aansluit bij uw bedrijf en ondersteunen waar nodig."

### Real vacancies seen on site (used in UI kits)
- **Meewerkend chauffeur** — Logistiek. "Ben je graag onderweg en wil je dit combineren met je nieuwe baan?"
- **Medewerker snijhal (portioneren)** — Productie. Totaalleverancier van kip-, wild- en gevogelteproducten.
- **Medewerker etiketteermachine (etiketteerder)** — Productie. Zelfde opdrachtgever.

---

## Tone takeaways (→ see README "Content fundamentals")

- Direct, plain Dutch, short declarative sentences. *"De productie moet draaien, punt."*
- Operationally credible — names the real work (snijhal, etiketteermachine, shifts, hygiene rules).
- *"u / uw bedrijf"* for clients, *"je / jou"* for job seekers.
- No hype, no emoji, at most one emphatic line.

---

## Why no "dashboard" UI kit (unlike Geo Insights)

Geo Insights ships an authenticated product (UrbanAdapt) so its system includes
a product dashboard kit. Light Personeelsdiensten is a services company whose
only real digital surface is the **marketing website** — there is no app to
recreate. We therefore ship `ui_kits/website/` plus a `ui_kits/social/` kit for
recruitment content, rather than inventing a product UI that doesn't exist.

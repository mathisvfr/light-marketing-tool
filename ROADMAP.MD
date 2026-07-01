# Light Marketing Tool — Roadmap

Volgorde op basis van afhankelijkheden, niet op fasenummer. Sommige dingen hebben
externe wachttijd (andermans actie), die starten eerst en lopen op de achtergrond
terwijl jij bouwt.

**Grote wijziging door Buffer:** de Meta App Review en LinkedIn-app-goedkeuring
zijn VERVALLEN. Dat was de langste, minst controleerbare wachttijd in het hele
project. Buffer houdt die platform-goedkeuringen zelf. Social en vacatures kunnen
nu vrijwel tegelijk live.

---

## Track 0 — Nu starten, parallel (wachten op anderen, niet op jou)

| # | Taak | Waarom eerst | Wachttijd |
|---|------|--------------|-----------|
| 1 | **Buffer-account + kanalen koppelen.** Light maakt account, koppelt LinkedIn/Facebook/Instagram in Buffer UI, owner genereert persoonlijke API-key. | Geeft je BUFFER_API_KEY + channelId's. Vervangt de oude Meta/LinkedIn reviews. | Kort (uren) |
| 2 | **Hosting-beslissing (Anbecom-meeting).** Waar draait backend + feed. | Bepaalt server-IP voor DNS-record. Blokkeert launch, niet de bouw. | Dagen |
| 3 | **Jobit/Multiposter follow-up.** Pull-interval, stats-methode, veld-mapping. | Vult de twee stubs. Niet blokkerend. | Volgende week |

Geen van deze blokkeert Track 1. Ze moeten alleen *lopen*.

---

## Track 1 — Fundament (lokaal op je Legion, geen server nodig)

Bouw de hele app eerst lokaal. Je hebt de VPS niet nodig om te beginnen.

| # | Taak | CLAUDE.md |
|---|------|-----------|
| 4 | **Brand knowledge base afronden.** Drive-docs + design system in repo, Claude Code synthetiseert brand-knowledge.md, jij reviewt. Gate voor alle contentkwaliteit. | (voor Stap 1) |
| 5 | **Repo + scaffolding.** Backend, frontend, Supabase, migraties, seed owner. | Stap 1 |
| 6 | **Auth + rollen.** Login, JWT, owner/recruiter/viewer guards. | Stap 2 |
| 7 | **Layout + navigatie.** Shell, sidebar, rol-bewuste nav. | Stap 3 |

**Mijlpaal:** inlogbare app. Eerste demo-moment voor je vriend.

---

## Track 2 — Kernwaarde: vacatures (lokaal)

Hoogste waarde, minste externe afhankelijkheid. Eerst af.

| # | Taak | CLAUDE.md |
|---|------|-----------|
| 8 | **Vacature-generatie.** Form, Claude gestructureerde velden NL/PL, Criticus, preview, approve→actief. | Stap 5 |
| 9 | **XML feed.** /jobs.xml, CDATA, één-plaats-validatie, DB-mapping. Lokaal testbaar in browser. | Stap 6 |
| 10 | **Wachtrij + Gepubliceerd.** Lifecycle-views, vacature sluiten = uit feed. | Stap 7-8 |

**Mijlpaal:** vacature-helft werkt end-to-end behalve de live-handoff naar Jobit
(wacht op publieke URL in Track 4). Lokaal demobaar.

---

## Track 3 — Marketing + blogs + rendering (lokaal)

Door Buffer is dit niet meer geblokkeerd door platform-reviews.

| # | Taak | CLAUDE.md |
|---|------|-----------|
| 11 | **Satori render pipeline.** HTML/design-system → PNG + upload-override. Grootste nieuwe subsysteem; isoleer en test apart. | Stap 9 |
| 12 | **Marketing post via Buffer.** Form, Claude copy, Criticus, beeld, buffer.js createPost (nu/inplannen). | Stap 10 |
| 13 | **WordPress (blogs).** Eigen content-flow, Claude blog_html, Criticus, REST publish. | Stap 11 |
| 14 | **Merk instellingen + Gebruikers.** Brand UI, Buffer-kanaalstatus, WordPress-koppeling, gebruikersbeheer. | Stap 12-13 |

**Mijlpaal:** alle content-types werken lokaal. Buffer test je tegen Light's echte
account zodra Track 0 #1 klaar is (geen review-wachttijd meer).

---

## Track 4 — Deploy (na hosting-beslissing)

Pas nu doet de server ertoe.

| # | Taak |
|---|------|
| 15 | **Server provisionen** (Anbecom-VPS of Hetzner-fallback). Root/SSH, publiek IP. |
| 16 | **DNS A-record** naar Anbecom: feed → server-IP. Wachten op propagatie. |
| 17 | **Deploy.** Docker Compose + Caddy, HTTPS auto op feed-subdomein. |
| 18 | **Feed-URL aan Jobit/Multiposter geven** en pull bevestigen. Vacatures écht live. |
| 19 | **Buffer in productie:** BUFFER_API_KEY op server, kanaalstatus groen. Social live. |

---

## Track 5 — Launch

| # | Taak |
|---|------|
| 20 | **End-to-end test** alle kanalen met echte/gemarkeerde testcontent. |
| 21 | **Training** Sandra/owner, opnemen, één A4 NL-spiekbriefje. |
| 22 | **Handoff** + start €500/mnd onderhoudsfase. |

---

## Kritiek pad (kortste route naar kernwaarde)

```
brand doc → scaffold → auth → vacature-gen → feed
   → (server bestaat) → deploy → Jobit pullt feed → [VACATURES LIVE]
```

Social/blog loopt er parallel naast en convergeert bij deploy. Door Buffer zit er
GEEN approval-gate meer tussen, dus de twee helften landen dicht bij elkaar.

## Wat het tijdpad nog kan vertragen
- **Hosting-beslissing** (Anbecom-meeting): blokkeert launch, niet de bouw.
- **Brand knowledge base**: blokkeert contentkwaliteit. Niet half doen.

De vroegere grootste vertrager (Meta App Review) is wég dankzij Buffer.

## Optie: vacatures-first als bewuste Release 1
Je kunt vacatures als Release 1 leveren en marketing/social/blog als Release 2.
Minder dwingend dan vroeger (Buffer haalde de review-gate weg), maar nog steeds
een nette manier om snel echte waarde te leveren en de feed met Jobit te bewijzen.

## Terugkerende kosten (tegen €500/mnd envelop)
- Supabase: gratis tier waarschijnlijk voldoende [VERIFY bij volume]
- Anthropic API: ~€30-50/mnd geschat [VERIFY na 2 weken gebruik]
- Buffer: Free tier (3 kanalen) — let op levenslange cap van 8 koppelingen ooit
- Hosting: Anbecom-VPS (prijs t.b.v.) of Hetzner ~€5/mnd
- Jobit/Multiposter: per vacature/abonnement [VERIFY]
- Jouw onderhoud: 1-2u/mnd
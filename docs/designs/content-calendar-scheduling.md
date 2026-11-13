# Content Calendar & Scheduling v2

**Status:** DRAFT
**Issues:** #10, #11
**Datum:** 2026-11-13
**Auteur:** mathisvfr

---

## Samenvatting

De kalender (`/kalender`) toont op dit moment alleen marketing-posts (Type B) — zowel ingeplande als gepubliceerde items via Buffer. Deze spec breidt de kalender uit met:

1. **Alle content-types op de kalender**: vacatures (Type A), blogs en marketing-posts (Type B) naast elkaar, visueel onderscheiden.
2. **Maandweergave** naast de bestaande weekweergave.
3. **Slim inplannen** — "plan in op het volgende goede moment" per content-type, gebaseerd op configureerbare optimale tijden per kanaal.
4. **Handmatig inplannen** — klik op een tijdslot of sleep een goedgekeurd concept naar een dagcel.
5. **Instagram-kleur** — van rood/roze naar het herkenbare Instagram-gradient (paars-roze).
6. **Slotbeheer** — dubbele posts op hetzelfde kanaal op hetzelfde moment detecteren en voorkomen (met name LinkedIn).
7. **Cross-type post-generatie** (#11) — bij publicatie van een blog automatisch een marketing-post voorstel aanmaken.

---

## Huidige situatie

### Kalender (frontend)

- **Bestand:** `frontend/src/pages/Kalender.jsx` + `kalender.css`
- **Weergave:** alleen weekweergave (7-koloms grid, ma-zo)
- **Data:** leest van `GET /publish` dat `scheduledItems` en `marketingItems` teruggeeft
- **Inhoud:** alleen marketing-posts met `publications`-rijen (status `scheduled` of `success`)
- **Interactie:** klik op chip opent detail-overlay met titel, kanaal, tijd en link naar Gepubliceerd
- **Geen** maandweergave, geen drag-and-drop, geen directe inplan-actie

### Backend (`GET /publish`)

Retourneert vier lijsten (zie `backend/src/routes/publish.js`):
- `marketingItems` — marketing-posts met minstens een live publicatie
- `scheduledItems` — marketing-posts met alleen `scheduled` publicaties
- `vacatureItems` — actieve vacatures (uit `drafts` met status `actief`)
- `blogItems` — blogs met status `published` of `approved`

De kalender gebruikt alleen `scheduledItems` + `marketingItems`. Vacatures en blogs hebben geen `scheduled_for`-timestamps en verschijnen niet.

### Publicatiepatronen

- **Tabel:** `publication_patterns` (migratie 010) — naam, kanaal, weekdagen, tijd
- **Backend:** `patternScheduler.js` — `nextSlot(pattern, now)` berekent het eerstvolgende moment in `Europe/Amsterdam`
- **Frontend:** `Publicatiepatronen.jsx` — CRUD voor patronen (owner-only)
- **Gebruik:** patronen worden nu handmatig gekozen bij het publiceren van een marketing-post ("Plan in via patroon")

### Kanaal-kleuren (CSS)

```css
.ch-linkedin  → blauw (--color-info-soft)
.ch-facebook  → indigo (#e0e7ff / #3730a3)
.ch-instagram → roze (#fce7f3 / #9d174d)  /* nu rood-achtig, moet gradient worden */
```

---

## Ontwerp

### Database-wijzigingen

#### Migratie: `030_calendar_scheduling.sql`

```sql
-- 1. Widen channel CHECK constraint zodat 'feed' en 'website' ook toegestaan zijn.
-- Bestaande constraint staat alleen 'linkedin','facebook','instagram' toe.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'publication_patterns_channel_check'
  ) THEN
    ALTER TABLE publication_patterns DROP CONSTRAINT publication_patterns_channel_check;
  END IF;

  ALTER TABLE publication_patterns
    ADD CONSTRAINT publication_patterns_channel_check
    CHECK (channel IN ('linkedin', 'facebook', 'instagram', 'feed', 'website'));
END
$$;

-- 2. Optimale tijden per kanaal+type configureerbaar maken.
-- Hergebruikt publication_patterns maar voegt content_type toe.
ALTER TABLE publication_patterns
  ADD COLUMN IF NOT EXISTS content_type TEXT
    NOT NULL DEFAULT 'marketing-post'
    CHECK (content_type IN ('vacature', 'marketing-post', 'blog'));

-- Index voor slim-inplannen lookups
CREATE INDEX IF NOT EXISTS idx_patterns_type_channel
  ON publication_patterns (content_type, channel)
  WHERE is_active;

-- Index voor calendar date-range queries
CREATE INDEX IF NOT EXISTS idx_drafts_scheduled_for
  ON drafts (scheduled_for) WHERE scheduled_for IS NOT NULL;

-- 2. Vacatures en blogs krijgen een optioneel scheduled_for in drafts
-- zodat ze op de kalender verschijnen voordat ze live gaan.
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

-- 3. Cross-type link: welke draft triggerde een afgeleide draft
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS parent_draft_id UUID REFERENCES drafts(id);
```

**Toelichting:**

- `content_type` op `publication_patterns`: patronen worden nu per type gedefinieerd. Bestaande rijen krijgen default `marketing-post` — geen dataverlies.
- `scheduled_for` op `drafts`: vacatures hebben geen `publications`-rij (ze gaan via XML feed, niet via Buffer). Om ze toch op de kalender te tonen bij een geplande goedkeuring/activering, slaan we de geplande tijd op in de draft zelf. Hetzelfde geldt voor blogs. Marketing-posts blijven hun `scheduled_for` in `publications` gebruiken (Buffer-scheduling).
- `parent_draft_id`: koppelt een automatisch aangemaakte marketing-post terug aan de blog die hem triggerde (#11).

### API endpoints

#### Bestaand — uitbreiden

**`GET /publish`**

Response uitbreiden: `vacatureItems` en `blogItems` krijgen ook `scheduledFor` mee.

```js
// vacatureItems krijgt scheduled_for uit drafts
{
  id, title, status, updatedAt, channels,
  scheduledFor: draft.scheduled_for  // nieuw
}

// blogItems krijgt scheduled_for uit drafts
{
  id, title, status, updatedAt, categorie,
  scheduledFor: draft.scheduled_for  // nieuw
}
```

#### Nieuw

**`POST /drafts/:id/schedule`** (owner/manager)

Handmatig inplannen van een goedgekeurd concept op een specifieke datum/tijd. Werkt voor alle types.

```
Body: { scheduledFor: "2026-11-18T09:00:00Z" }
```

Logica:
- Valideert dat draft status `approved` of `actief` is
- Voor marketing-posts: roept bestaande Buffer-scheduling aan (`createPost` met `dueAt`)
- Voor vacatures: zet `drafts.scheduled_for`; op dat moment wordt status `actief` gezet (of direct als datum in het verleden)
- Voor blogs: zet `drafts.scheduled_for`; op dat moment wordt website-publicatie getriggerd
- Response: `{ scheduledFor, channel?, slotConflicts: [] }`

**`POST /drafts/:id/smart-schedule`** (owner/manager)

Slim inplannen: zoekt het eerstvolgende vrije moment op basis van actieve patronen voor dit content-type en kanaal.

```
Body: { channels: ["linkedin"] }  // optioneel, default: alle kanalen van dit type
```

Logica:
1. Haal actieve patronen op voor `content_type` + gevraagde kanalen
2. Per patroon: bereken `nextSlot()` via bestaande `patternScheduler.js`
3. Check slotconflicten (zie Slotbeheer hieronder)
4. Als er een conflict is: schuif door naar het volgende slot
5. Plan in via `POST /drafts/:id/schedule`

Response: `{ scheduledFor, channel, patternName, skippedSlots: [] }`

**`GET /calendar`** (auth)

Dedicated calendar-endpoint dat alle types samenbrengt, geoptimaliseerd voor datumbereik-queries.

```
Query: ?from=2026-11-01&to=2026-11-30
```

Response:
```js
{
  items: [
    {
      id: "draft-uuid",
      type: "vacature" | "marketing-post" | "blog",
      title: "Heftruckchauffeur Rotterdam",
      channel: "feed" | "linkedin" | "facebook" | "instagram" | "website",
      status: "scheduled" | "published" | "actief",
      scheduledFor: "2026-11-18T09:00:00Z",  // of null
      publishedAt: "2026-11-15T10:30:00Z",   // of null
      parentDraftId: null,  // voor cross-type links
    },
    // ...
  ]
}
```

Dit endpoint vervangt het huidige hergebruik van `GET /publish` door de kalender. De Gepubliceerd-pagina blijft `GET /publish` gebruiken.

**`GET /calendar/slots`** (owner/manager)

Retourneert bezette slots voor conflictdetectie.

```
Query: ?from=2026-11-18&to=2026-11-18&channel=linkedin
```

Response:
```js
{
  slots: [
    { time: "2026-11-18T09:00:00Z", draftId: "uuid", title: "..." }
  ]
}
```

**`POST /drafts/:id/cross-post`** (owner/manager)

Maak een marketing-post draft aan op basis van een blog (#11). Zie sectie Cross-type.

### Frontend componenten

#### `Kalender.jsx` — refactor

Huidige structuur wordt uitgebreid met:

```
Kalender.jsx
├── KalenderHeader.jsx        — navigatie, week/maand toggle, filters
├── WeekView.jsx              — bestaande weekweergave (gerefactord uit Kalender.jsx)
├── MonthView.jsx             — nieuwe maandweergave
├── CalendarChip.jsx          — type-bewuste chip (kleur per type + kanaal)
├── CalendarDetailPanel.jsx   — uitgebreide detail-overlay met acties
├── ScheduleDropdown.jsx      — "Plan in" dropdown (patroon of handmatig)
└── SmartScheduleButton.jsx   — "Volgend goed moment" one-click
```

#### Nieuwe query key

```js
// frontend/src/lib/queryKeys.js
export const calendarKeys = {
  all: ['calendar'],
  range: (from, to) => ['calendar', { from, to }],
  slots: (from, to, channel) => ['calendar', 'slots', { from, to, channel }],
};
```

---

## Scheduling-logica

### Slim inplannen ("Volgend goed moment")

Het systeem gebruikt `publication_patterns` als bron voor optimale tijden. Per content-type bestaan er standaard patronen:

| Content-type | Kanaal | Standaard patroon |
|---|---|---|
| marketing-post | LinkedIn | Di, Do 09:00 |
| marketing-post | Facebook | Wo 12:00 |
| marketing-post | Instagram | Zo 18:00 |
| vacature | feed (XML) | Ma-Vr 08:00 |
| blog | website | Di, Do 10:00 |

De owner kan deze aanpassen via Publicatiepatronen (bestaande UI, uitgebreid met `content_type`-filter).

**Algoritme `smartSchedule(draftId, channels)`:**

```
1. patterns = SELECT * FROM publication_patterns
               WHERE content_type = draft.type
                 AND channel IN (channels)
                 AND is_active = true

2. Voor elk patroon:
   a. candidaat = nextSlot(pattern, now)
   b. conflicten = SELECT FROM publications/drafts
                    WHERE channel = pattern.channel
                      AND scheduled_for BETWEEN (candidaat - 30min, candidaat + 30min)
   c. Als conflict: herhaal nextSlot() vanaf candidaat + 1 dag (max 14 pogingen)
   d. Eerste conflictvrije slot wint

3. Return { scheduledFor: candidaat, channel, patternName }
```

### Slotbeheer — conflictdetectie

Dubbele posts op hetzelfde kanaal op hetzelfde moment zijn onwenselijk, vooral op LinkedIn (waar het er spammy uitziet).

**Definitie "conflict":** twee items op hetzelfde kanaal binnen 30 minuten van elkaar.

**Bronnen voor bezette slots:**
- `publications` tabel: `channel` + `scheduled_for` (marketing-posts via Buffer)
- `drafts` tabel: `scheduled_for` (vacatures, blogs)

**Toepassing:**
- Bij slim inplannen: automatisch doorschuiven naar volgend vrij slot
- Bij handmatig inplannen: waarschuwing tonen ("Er staat al een LinkedIn-post om 09:00 ingepland. Toch doorgaan?"), niet blokkeren
- In de kalender-UI: conflicterende chips krijgen een waarschuwingsicoon

**Geen harde blokkade** — de owner kan bewust twee posts tegelijk inplannen (bijv. LinkedIn + Instagram tegelijk is prima). Alleen same-channel conflicten tonen een waarschuwing.

### Handmatig inplannen

Twee methoden:

1. **Klik op tijdslot (maandweergave):** klik op een dagcel, kies tijd via een compacte time-picker, bevestig. Roept `POST /drafts/:id/schedule` aan.

2. **Drag-and-drop (weekweergave):** sleep een goedgekeurd concept uit een zijpaneel ("Klaar om in te plannen") naar een dagcel. Bij loslaten opent een mini-dialog met tijdkeuze + conflictwaarschuwing.

**Drag-and-drop implementatie:**
- Gebruik native HTML5 drag-and-drop (`draggable`, `onDragStart`, `onDrop`) — geen externe library nodig voor dit niveau van complexiteit.
- Het zijpaneel toont alleen drafts met status `approved` die nog niet ingepland zijn.
- Drop-target is de dagcel; na drop opent een popover met tijdkeuze.

---

## UI/UX

### Kalender header (wireframe)

```
┌─────────────────────────────────────────────────────────────┐
│  ‹  ›  [Vandaag]    november 2026         [Week] [Maand]   │
│                                                              │
│  Filters: [Alles ▾] [Vacatures] [Marketing] [Blogs]        │
│                                            12 items          │
└─────────────────────────────────────────────────────────────┘
```

- **Week/Maand toggle:** twee knoppen rechts in de header. Actieve staat is filled, inactieve is outline.
- **Type-filters:** toggle-buttons die content-types aan/uit zetten. Standaard alles aan. State in URL searchparams (`?view=month&types=vacature,marketing-post`).

### Weekweergave (bestaand, uitgebreid)

Zoals nu, maar chips zijn nu type-bewust:

```
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│  Ma  │  Di  │  Wo  │  Do  │  Vr  │  Za  │  Zo  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  18  │  19  │  20  │  21  │  22  │  23  │  24  │
│      │ ████ │      │ ████ │      │      │ ████ │
│      │ LI   │      │ LI   │      │      │ IG   │
│      │ 09:00│      │ 09:00│      │      │ 18:00│
│      │"Week │      │"SNA  │      │      │"Feest│
│      │ tips"│      │ cert"│      │      │ dagen│
│      │      │      │      │      │      │      │
│      │ ░░░░ │      │      │ ░░░░ │      │      │
│      │ VAC  │      │      │ VAC  │      │      │
│      │ 08:00│      │      │ 08:00│      │      │
│      │"Heft │      │      │"Inpak│      │      │
│      │ ruck"│      │      │ ker" │      │      │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

**Chip-kleuren per type + kanaal:**

| Type | Kanaal | Achtergrond | Tekstkleur | Icoon |
|---|---|---|---|---|
| marketing-post | LinkedIn | `#dbeafe` (lichtblauw) | `#1e40af` | `in` |
| marketing-post | Facebook | `#e0e7ff` (lichtindigo) | `#3730a3` | `f` |
| marketing-post | Instagram | gradient `#833ab4→#fd1d1d→#fcb045` als border, `#fce7f3` bg | `#833ab4` | `ig` |
| vacature | feed | `#fef3c7` (lichtgeel) | `#92400e` (amber) | `V` |
| blog | website | `#d1fae5` (lichtgroen) | `#065f46` | `B` |

### Maandweergave (nieuw)

```
┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐
│  Ma  │  Di  │  Wo  │  Do  │  Vr  │  Za  │  Zo  │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│      │      │      │      │   1  │   2  │   3  │
│      │      │      │      │  ○○  │      │  ●   │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│   4  │   5  │   6  │   7  │   8  │   9  │  10  │
│  ●○  │  ●   │      │  ●○  │      │      │      │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  11  │  12  │  13  │  14  │  15  │  16  │  17  │
│  ●   │  ●●  │      │  ●   │  ○   │      │  ●   │
├──────┼──────┼──────┼──────┼──────┼──────┼──────┤
│  ...                                             │
└──────────────────────────────────────────────────┘

● = chip (compacter dan weekweergave, alleen icoon + kleur)
○ = vacature-chip
```

- Dagcellen zijn kleiner; chips tonen alleen het kanaal-icoon en type-kleur (geen tekst, geen tijd).
- Klik op een dagcel opent een dagoverzicht als zijpaneel (lijst van die dag's items met tijd + titel).
- Maximaal 3 chips per cel; bij meer: "+2 meer" badge die het zijpaneel opent.
- Klik op een dag in maandweergave kan ook switchen naar weekweergave van die week (via dubbelklik of een knop in het zijpaneel).

### Detail-panel (uitgebreid)

Het huidige overlay wordt een rechter zijpaneel (slide-in) met meer acties:

```
┌──────────────────────────────────┐
│  × Sluiten                       │
│                                   │
│  [LinkedIn]  [Ingepland]         │
│                                   │
│  Wekelijkse tips logistiek       │
│  Dinsdag 19 nov, 09:00           │
│                                   │
│  Type: Marketing-post            │
│  Kanaal: LinkedIn                │
│  Status: Ingepland via Buffer    │
│                                   │
│  [Bekijk concept]                │
│  [Plan wijzigen]                 │
│  [Annuleren]                     │
│                                   │
│  ─────────────────               │
│  Ingepland via patroon:          │
│  "LinkedIn ochtend" (Di, Do 09:00)│
└──────────────────────────────────┘
```

Acties zijn rolafhankelijk:
- **owner/manager:** Plan wijzigen, Annuleren, Bekijk concept
- **recruiter:** Bekijk concept (alleen eigen drafts)
- **viewer:** alleen lezen

### Instagram-kleur update

De huidige `ch-instagram` kleur is `#fce7f3` / `#9d174d` (roze). Dit wordt:

```css
/* Nieuw: Instagram gradient-geïnspireerd */
.kal-chip.ch-instagram,
.kal-detail-badge.ch-instagram {
  background: linear-gradient(135deg, #833ab4 0%, #fd1d1d 50%, #fcb045 100%);
  color: #ffffff;
  /* Fallback voor contexts waar gradient niet werkt */
  background-color: #c13584;
}

/* Subtielere variant voor chips (lichtere achtergrond) */
.kal-chip.ch-instagram {
  background: #f0e6fa;
  color: #7c3aed;
  border-left: 3px solid #c13584;
}
```

De gradient wordt gebruikt voor badges en detail-panel; chips in de kalender krijgen een subtielere variant met een gekleurde linkerborder zodat ze leesbaar blijven op kleine schermen.

**Doorvoeren in:** `kalender.css`, `ChannelIndicator` component, `StatusBadge` indien van toepassing.

### Zijpaneel "Klaar om in te plannen"

Naast de kalender (of als uitklapbaar paneel op mobiel) een lijst van goedgekeurde maar nog niet ingeplande concepten:

```
┌────────────────────────┐
│  Klaar om in te plannen │
│                         │
│  ┌───────────────────┐ │
│  │ VAC Heftruckchauff │ │
│  │ eur Rotterdam     │ │
│  │ [Plan in ▾]       │ │
│  └───────────────────┘ │
│                         │
│  ┌───────────────────┐ │
│  │ MKT Eindejaars-   │ │
│  │ campagne          │ │
│  │ [Volgend moment]  │ │
│  │ [Plan in ▾]       │ │
│  └───────────────────┘ │
│                         │
│  ┌───────────────────┐ │
│  │ BLOG 5 tips voor  │ │
│  │ magazijnwerk      │ │
│  │ [Plan in ▾]       │ │
│  └───────────────────┘ │
└────────────────────────┘
```

- Items zijn `draggable` naar de kalender (weekweergave)
- "Volgend moment" knop roept `POST /drafts/:id/smart-schedule` aan
- "Plan in" dropdown toont actieve patronen + "Handmatig kiezen..." optie

---

## Cross-type post-generatie (#11)

### Probleem

Wanneer een blog gepubliceerd wordt, wil Luke vaak ook een social post maken die naar de blog linkt. Nu moet hij handmatig naar Marketing Post navigeren en de blog-URL kopiëren.

### Oplossing

Bij het publiceren (of inplannen) van een blog toont de UI een optie: **"Maak ook een social post aan"**. Dit maakt een nieuwe marketing-post draft aan met:

- `parent_draft_id` = de blog's draft ID
- `form_data.onderwerp` = blog-titel
- `form_data.type` = "Opdrachtgevers" (default, aanpasbaar)
- `form_data.channels` = ["linkedin", "facebook"] (default, aanpasbaar)
- Status: `draft` — de post moet nog gegenereerd en goedgekeurd worden

### Flow

```
Blog goedgekeurd → "Publiceer blog"
                  → ☑ Maak ook een social post aan
                  → [Publiceer + maak post]
                  ↓
Blog wordt gepubliceerd
Social draft wordt aangemaakt (status: draft)
                  ↓
Redirect naar MarketingPost.jsx?draftId=<new-id>
  → "Genereer" knop → Claude genereert post met blog-context
  → Preview → Goedkeuren → Inplannen (normaal flow)
```

### API

**`POST /drafts/:id/cross-post`** (owner/manager)

```
Body: {
  channels: ["linkedin", "facebook"],
  type: "Opdrachtgevers"  // of "Kandidaten"
}
```

Response:
```js
{
  draft: {
    id: "new-uuid",
    type: "marketing-post",
    status: "draft",
    parent_draft_id: "blog-uuid",
    form_data: { ... }
  }
}
```

### Prompt-aanpassing

`prompts/marketing-post.md` krijgt een extra sectie voor blog-promotie:

```
Als er een blog_context wordt meegegeven:
- Verwijs naar het blog-onderwerp in de post
- Voeg een CTA toe: "Lees meer op onze website"
- Blog-URL wordt door het systeem toegevoegd (niet door het model verzinnen)
```

### UI in MarketingPost.jsx

Wanneer `draftId` in de URL staat en de draft een `parent_draft_id` heeft, toon een banner:

```
ℹ Deze post is aangemaakt naar aanleiding van het blog "5 tips voor magazijnwerk".
  [Bekijk blog]
```

---

## Migratiepad

### Fase 1 — Fundament (niet-breaking)

1. **Migratie draaien:** `0XX_calendar_scheduling.sql`
   - `content_type` kolom op `publication_patterns` (default `marketing-post`)
   - `scheduled_for` kolom op `drafts`
   - `parent_draft_id` kolom op `drafts`
2. **`GET /calendar` endpoint** bouwen — nieuwe route, raakt bestaande niet aan
3. **Instagram-kleur** updaten in CSS — puur visueel, geen logica-wijziging

### Fase 2 — Kalender uitbreiden

4. **Kalender.jsx refactoren:** split in `WeekView` + `MonthView` + header met toggle
5. **Kalender data-source** switchen van `GET /publish` naar `GET /calendar`
6. **Type-filters** toevoegen
7. **Chip-kleuren** per type + kanaal implementeren

### Fase 3 — Scheduling

8. **`POST /drafts/:id/schedule`** endpoint
9. **`POST /drafts/:id/smart-schedule`** endpoint
10. **`GET /calendar/slots`** endpoint voor conflictdetectie
11. **Slotbeheer** — conflictwaarschuwingen in UI
12. **Zijpaneel** "Klaar om in te plannen"
13. **Drag-and-drop** in weekweergave

### Fase 4 — Cross-type

14. **`POST /drafts/:id/cross-post`** endpoint
15. **UI in blog-publicatie flow** — checkbox "Maak ook een social post aan"
16. **Banner in MarketingPost.jsx** voor afgeleide posts
17. **Prompt-aanpassing** voor blog-promotie context

### Fase 5 — Polish

18. **Maandweergave responsive** testen (mobiel)
19. **Publicatiepatronen** pagina uitbreiden met `content_type` filter
20. **Standaard patronen** seeden voor vacatures en blogs

### Rollback

Elke fase is onafhankelijk deploybaar. Database-wijzigingen zijn additief (nieuwe kolommen met defaults, nieuwe tabel-rijen). Bij problemen:
- Fase 2-5 zijn pure frontend/API-wijzigingen, rollback = vorige Docker image deployen
- Fase 1 database-kolommen zijn nullable/met defaults, hoeven niet teruggedraaid

---

## Open vragen

1. ~~**Vacature-scheduling: wat betekent "inplannen"?**~~
   **BESLUIT: Echte delayed activation.** Vacatures worden NIET direct actief gezet.
   - `POST /drafts/:id/schedule` zet status op `approved` + `scheduled_for` timestamp
   - **Nieuwe cron-job `scheduledActivation.js`:** checkt elke minuut of er drafts zijn met `scheduled_for <= now() AND status = 'approved'`. Die worden dan op `actief` gezet → verschijnen in de XML feed.
   - Zelfde patroon als `autoArchive.js`: `setInterval` + `.unref()`, no-op onder test.
   - UI toont: "Vacature wordt actief op [datum/tijd]" met countdown.
   - Blogs: zelfde mechanisme — `approved` + `scheduled_for` → cron zet op `published` en triggert website-publicatie.
   - Marketing-posts: gaan via Buffer's `dueAt` (bestaand) — geen cron nodig.

2. **Blog-scheduling: zelfde vraag.**
   De website-adapter is nog een stub. Scheduling van blogs is voorlopig alleen visueel/herinnerend. Zodra de eigen site live is, kan `scheduled_for` een echte publicatie-trigger worden.

3. **Conflictvenster: 30 minuten of configureerbaar?**
   Voorstel: hardcoded 30 minuten voor MVP. Als Luke andere marges wil, maak het een `brand_settings`-key.

4. **Drag-and-drop op mobiel?**
   HTML5 drag-and-drop werkt niet op touch-devices. Opties:
   - (a) Drag-and-drop alleen op desktop; op mobiel: klik → "Plan in" dropdown
   - (b) Gebruik een touch-drag library (`@dnd-kit/core`)
   Aanbeveling: optie (a) voor MVP. Luke checkt soms vanaf zijn telefoon maar het zware scheduling-werk doet hij op desktop.

5. **Hoeveel standaard patronen seeden?**
   De patronen uit de tabel hierboven (5 stuks) seeden als startpunt. Luke kan ze aanpassen via Publicatiepatronen.

6. **Cross-post: automatisch genereren of alleen draft aanmaken?**
   Voorstel: alleen draft aanmaken. Luke triggert generatie zelf — past bij de "niets automatisch live" filosofie. De redirect naar MarketingPost met de draft-ID maakt de flow vlot genoeg.

7. **Maandweergave: startdag maandag of zondag?**
   Maandag — consistent met de weekweergave en Nederlandse conventie.

8. **Performance: `GET /calendar` met groot datumbereik?**
   Maandweergave vraagt max 6 weken aan data op. Met de huidige volumes (< 100 items/maand) is een enkele query voldoende. Geen paginering nodig voor MVP. Index op `scheduled_for` + `status` toevoegen als het traag wordt.

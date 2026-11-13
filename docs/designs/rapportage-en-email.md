# Design: Rapportage uitbreiding — per-post metrics, aanpasbaar dashboard, e-mailrapporten

Status: DRAFT
Datum: 2026-11-13
GitHub issues: #24, #27
Voortbouwend op: `docs/designs/analytics-rapportage-loop.md` (task #3)

---

## Samenvatting

Dit spec breidt de bestaande rapportage-infrastructuur uit met drie pijlers:

1. **Per-post metrics** — individuele prestatie-informatie (clicks, impressions, engagement) per gepubliceerde Buffer-post, zichtbaar in de UI.
2. **Aanpasbaar dashboard** — widget-toggles en flexibele datumbereik-selectie zodat Sandra en de eigenaar hun eigen weergave samenstellen.
3. **Geautomatiseerde e-mailrapporten** — wekelijks en/of maandelijks samenvatting naar `vacature@lightpersoneelsdiensten.nl`.

Daarnaast dekt het de dashboard-verbeteringen uit issue #27: maandoverzicht met prestaties, deze maand vs vorige maand vergelijking, kanaaldistributie-donut, en activiteitstijdlijn.

---

## Huidige situatie

### Wat er al staat

| Laag | Bestand(en) | Wat het doet |
|------|------------|--------------|
| DB | `018_metric_snapshot.sql` | `metric_snapshot` tabel met upsert op `(metric_key, bucket_date, md5(dimensions))` |
| DB | `013_drafts_history_and_publications_metrics.sql` | `publications.metrics` (JSONB) + `publications.metrics_updated_at` kolommen |
| Backend | `services/metrics/db_snapshotter.js` | Nachtelijke + on-demand counts: actieve vacatures, nieuw deze week, per-kanaal breakdown, status-distributie, content per week |
| Backend | `services/metrics/buffer_snapshotter.js` | Nachtelijk: itereert Buffer-posts (max 5 API calls/run, 3s spacing), schrijft geaggregeerde engagement naar `metric_snapshot` |
| Backend | `services/metrics/website_snapshotter.js` | Umami stats: bezoekers, pageviews, top pages, referrers, weekly trend |
| Backend | `services/metrics/jobit_snapshotter.js` | Stub: probeert Jobit API, schrijft sollicitatie-counts |
| Backend | `routes/rapportage.js` | `GET /api/rapportage` (data), `POST /api/rapportage/refresh`, `POST /api/rapportage/application` |
| Frontend | `pages/Rapportage.jsx` | 3 secties (Vacatures / Marketing / Website), bar charts, line charts, trend badges, week/maand selector |

### Wat er ontbreekt

- **Per-post detail**: buffer_snapshotter schrijft alleen geaggregeerde totalen, niet per publicatie.
- **Widget-toggles**: alles is hardcoded zichtbaar; geen user preferences.
- **Custom datumbereik**: alleen "week" en "maand" keuze, geen vrije from/to picker.
- **E-mail**: geen SMTP-configuratie, geen cron voor periodieke verzending.
- **Maandoverzicht / vergelijking** (issue #27): geen deze-maand-vs-vorige-maand kaarten.
- **Kanaaldistributie chart** (issue #27): channelBreakdown wordt als tabel getoond, niet als donut/pie.
- **Activiteitstijdlijn** (issue #27): de dashboard-pagina heeft `recentActivity` maar de rapportage-pagina niet.

---

## Buffer Analytics API

### Beschikbare metrics per post

Buffer's GraphQL API biedt per post een `metrics`-array met platform-afhankelijke namen:

| Platform | Beschikbare metrics |
|----------|-------------------|
| LinkedIn | `Reactions`, `Comments`, `Impressions`, `Clicks`, `Shares`, `Engagement rate` |
| Facebook | `Reactions`, `Comments`, `Impressions`, `Reach`, `Clicks`, `Shares` |
| Instagram | `Likes`, `Comments`, `Impressions`, `Reach`, `Saves` |

De bestaande `buffer_snapshotter.js` normaliseert deze al naar: `likes`, `comments`, `reach`, `clicks`, `shares`.

### Huidig ophaal-patroon

```graphql
query BufferPostMetrics {
  post(input: { id: "<external_id>" }) {
    id
    metrics { name value }
    sentAt
  }
}
```

Dit is al geimplementeerd in `buffer_snapshotter.js:fetchPostMetrics()`.

### Free-tier limieten

- **3000 requests / 30 dagen** (100/dag gemiddeld).
- Huidige cap: 5 API calls per nachtelijke run + 3s spacing = zeer conservatief.
- Voor per-post metrics hebben we meer ruimte nodig: verhoog naar **15 calls/run** (nachtelijk) + een on-demand **per-post fetch** die 1 call kost en maximaal 1x per 6 uur per post wordt gedaan (rate-limited via `metrics_updated_at`).
- Worst case bij 15 nachtelijk + 10 on-demand/dag = 25/dag = 750/maand, ruim binnen de 3000 cap.

### Per-post vs geaggregeerd

Huidige situatie: `buffer_snapshotter` schrijft alleen `buffer.engagement.totals` en `buffer.engagement.by_channel`. De per-post metrics worden opgehaald maar niet per publicatie opgeslagen.

Nieuw: schrijf de per-post metrics ook terug naar `publications.metrics` (JSONB kolom bestaat al via migratie 013). Dit is de meest efficiente aanpak: geen extra tabel nodig, de data zit al op de juiste plek.

---

## DB-wijzigingen

### Migratie 032: `user_dashboard_preferences` + rapportage-uitbreidingen

```sql
-- 032_dashboard_preferences_and_email_reports.sql

-- Gebruiker-specifieke widget-voorkeuren voor het rapportage-dashboard.
CREATE TABLE IF NOT EXISTS user_dashboard_preferences (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  visible_widgets   JSONB NOT NULL DEFAULT '[]',
  -- Array van widget-keys, bv. ["vacatures-tiles","marketing-engagement",
  -- "marketing-channel-chart","website-stats","website-pages"]
  -- Lege array = toon alles (default).
  date_range_default TEXT DEFAULT 'month'
    CHECK (date_range_default IN ('week', 'month', 'quarter')),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- E-mail rapport configuratie (system-wide singleton, owner beheert).
-- Gebruikt een fixed UUID zodat seed idempotent is en er nooit meerdere rijen ontstaan.
CREATE TABLE IF NOT EXISTS email_report_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  frequency   TEXT NOT NULL CHECK (frequency IN ('monthly', 'disabled')),
  recipients  TEXT[] NOT NULL DEFAULT ARRAY['vacature@lightpersoneelsdiensten.nl'],
  -- Welke secties in de e-mail:
  include_sections JSONB NOT NULL DEFAULT '["vacatures","marketing","website"]',
  day_of_month INT DEFAULT 28,  -- einde van de maand (28 = veilig voor alle maanden)
  hour        INT DEFAULT 8,    -- 08:00 Amsterdam time
  last_sent_at TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Seed default config met fixed UUID (idempotent)
INSERT INTO email_report_config (id, frequency)
VALUES ('00000000-0000-0000-0000-000000000001', 'disabled')
ON CONFLICT (id) DO NOTHING;
```

Geen wijzigingen aan `metric_snapshot` of `publications` nodig: de bestaande kolommen (`publications.metrics`, `publications.metrics_updated_at`) zijn voldoende.

---

## Backend

### Wijzigingen aan buffer_snapshotter.js

1. **Per-post metrics opslaan**: na `fetchPostMetrics()` de response ook schrijven naar `publications.metrics`:

```js
// Na succesvolle fetch:
await supabase
  .from('publications')
  .update({
    metrics: normalizedMetrics,  // { likes, comments, reach, clicks, shares }
    metrics_updated_at: new Date().toISOString(),
  })
  .eq('id', pub.id);
```

Dit gebeurt al impliciet (de `metrics_updated_at` wordt al gezet), maar de `metrics` JSONB wordt nu niet gevuld. Fix: schrijf de genormaliseerde metrics mee.

2. **MAX_API_CALLS verhogen**: van 5 naar 15 per nachtelijke run. Ruim binnen budget.

### Nieuw endpoint: per-post metrics

```
GET /api/rapportage/post/:publicationId/metrics
```

- Leest `publications.metrics` + `publications.metrics_updated_at`.
- Als `metrics_updated_at` ouder is dan 6 uur en `external_id` aanwezig: doet live een `fetchPostMetrics()` call naar Buffer, update de rij, geeft verse data terug.
- Rate-limit: maximaal 1 live fetch per publicatie per 6 uur.
- Rolbeperking: alle ingelogde gebruikers (read-only).

### Nieuw endpoint: dashboard preferences

```
GET  /api/rapportage/preferences       → huidige user preferences
PUT  /api/rapportage/preferences       → update preferences
Body: { visible_widgets: [...], date_range_default: "month" }
```

- Alle ingelogde gebruikers mogen hun eigen preferences instellen.

### Nieuw endpoint: e-mail rapport configuratie

```
GET  /api/rapportage/email-config      → huidige config (owner only)
PUT  /api/rapportage/email-config      → update config (owner only)
Body: { frequency, recipients, include_sections, day_of_week, day_of_month, hour }

POST /api/rapportage/email-config/test → stuur test-e-mail (owner only)
```

### Uitbreiding: rapportage data endpoint

`GET /api/rapportage` krijgt extra query parameters:

- `from` bestaat al (rapportage.js:44). **Nieuw:** `to` (ISO 8601) voor volledig custom datumbereik.
- `range=quarter` als extra optie (naast bestaande `week`/`month`).
- Extra velden in response:

```json
{
  "marketing": {
    "perPost": [
      {
        "publicationId": "uuid",
        "draftId": "uuid",
        "channel": "linkedin",
        "title": "...",
        "publishedAt": "...",
        "metrics": { "likes": 12, "comments": 3, "reach": 450, "clicks": 28, "shares": 5 },
        "metricsUpdatedAt": "..."
      }
    ],
    "thisMonthVsLast": {
      "current": { "posts": 8, "likes": 45, "reach": 1200 },
      "previous": { "posts": 6, "likes": 32, "reach": 900 },
      "change": { "posts": 33, "likes": 40, "reach": 33 }
    }
  },
  "activity": {
    "timeline": [
      { "date": "2026-11-12", "action": "draft.published", "title": "...", "userName": "..." }
    ]
  }
}
```

### Cron: e-mail rapport verzending

In `services/metrics/index.js`, naast de nachtelijke snapshotters, een aparte check:

```js
// Na runAllSnapshotters(), check of er een e-mail verstuurd moet worden
async function checkEmailReportSchedule() {
  try {
    const config = await getEmailReportConfig();
    if (config.frequency === 'disabled') return;
    if (shouldSendNow(config)) {
      await sendReportEmail(config);
      await updateLastSentAt(config.id);
    }
  } catch (err) {
    // Log maar crash de cron niet — volgende run probeert het opnieuw
    console.error('[email-report] mislukt:', err?.message || err);
    // Optioneel: schrijf naar activity_log met action 'email.report.failed'
  }
}
```

Timing: de check draait direct na de nachtelijke snapshotter-run (03:00 Amsterdam). Als het de juiste dag/uur is, wordt de e-mail verstuurd. Alternatief: aparte timer op het geconfigureerde uur (bv. 08:00).

Aanbevolen: **aparte timer op het geconfigureerde uur**. De snapshotter draait om 03:00, maar de e-mail moet om 08:00 aankomen (standaard). Gebruik dezelfde `getNextRunMs()`-pattern maar dan voor het e-mail-tijdstip.

---

## SMTP setup

### Provider: SMTP (Nodemailer)

**Besluit: alleen SMTP**, geen Resend. Gebruikt de bestaande SMTP-provider van Light.

- npm package: `nodemailer` (al beschikbaar als dependency via password-reset flow).
- Env vars: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.

### Backend service: `services/email.js`

```js
const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_HOST) {
      throw new Error('E-mail niet geconfigureerd (SMTP_HOST ontbreekt).');
    }
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, html }) {
  return getTransporter().sendMail({
    from: process.env.EMAIL_FROM || 'rapportage@lightpersoneelsdiensten.nl',
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
}
```

### DNS

Voor goede deliverability: SPF + DKIM records op `lightpersoneelsdiensten.nl`. Configuratie afhankelijk van de SMTP-provider die Light gebruikt.

### Env vars toevoegen

```
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM=rapportage@lightpersoneelsdiensten.nl
```

---

## E-mail template

### Inhoud van het maandrapport

Het rapport is een gebrand HTML-document met Light-huisstijl. Maandelijks, verstuurd aan het einde van de maand. Moet leesbaar zijn in elke e-mailclient (Outlook, Gmail, mobiel).

**Structuur:**

```
Onderwerp: "Light Marketing — Maandrapport [maand] [jaar]"

[Light logo — inline base64 of hosted URL]
[Light-huisstijl: #be1e2d header, #2b2b2b tekst, #f5f5f0 achtergrond]

Hallo,

Hier is het maandoverzicht van Light Personeelsdiensten voor [maand jaar].

━━━ VACATURES ━━━
- Actieve vacatures: 12 (+2 t.o.v. vorige maand)
- Nieuw geplaatst: 4
- Sollicitaties (Jobit): 23
- Sollicitaties (website): 8

━━━ MARKETING ━━━
- Posts gepubliceerd: 3
- Totaal bereik: 1.240 (+15%)
- Engagement: 45 likes, 12 reacties, 8 shares
- Beste post: "[titel]" — 520 bereik, 18 likes

Per kanaal:
  LinkedIn:  bereik 680, engagement 28
  Facebook:  bereik 420, engagement 12
  Instagram: bereik 140, engagement 5

━━━ WEBSITE ━━━
- Bezoekers: 234 (+8%)
- Paginaweergaven: 567
- Top pagina: /vacatures/logistiek-medewerker-rotterdam (89 views)

━━━ AI-INZICHTEN ━━━
[Claude-gegenereerde analyse van de metrics — zie sectie hieronder]

---
Bekijk het volledige dashboard: [link naar /rapportage]
Dit rapport wordt automatisch verstuurd. Instellingen wijzigen: [link naar /instellingen].
```

### AI-gegenereerde inzichten (nieuw)

Na het verzamelen van alle metrics wordt een Claude-call gedaan die de data
analyseert en concrete aanbevelingen geeft. Dit is het onderscheidende element
van het rapport.

**Implementatie:**

```js
// services/email-templates/insights.js
async function generateMonthlyInsights(metricsData) {
  const prompt = `
Je bent een marketing-analist voor Light Personeelsdiensten, een uitzendbureau.
Analyseer deze maandelijkse metrics en geef 3-5 concrete, actionable inzichten.

Metrics:
${JSON.stringify(metricsData, null, 2)}

Schrijf in het Nederlands, informeel (je/jij). Focus op:
1. Wat werkte goed deze maand en waarom
2. Wat werkte minder en wat kan beter
3. Welk type content had het meeste bereik/engagement
4. Concrete suggesties voor volgende maand
5. Opvallende trends (stijgend/dalend t.o.v. vorige maand)

Houd het kort: max 200 woorden, in bullet points.
Geen algemeenheden — verwijs naar specifieke posts/vacatures waar mogelijk.
`;

  const result = await callAnthropicExpectingJson(systemBlocks, {
    metrics: metricsData,
    instructions: prompt,
  });
  return result.insights; // string met bullet points
}
```

**Voorbeeld output:**
```
• Je LinkedIn-post over SNA-certificering had 3x meer bereik dan gemiddeld
  — zakelijke content over kwaliteitsgaranties resoneert bij opdrachtgevers.
  Doe dit vaker.
• Instagram-engagement is 25% gedaald t.o.v. vorige maand. Overweeg meer
  visuele content (team-foto's, behind-the-scenes) in plaats van alleen tekst.
• De vacature "Heftruckchauffeur Rotterdam" kreeg 12 sollicitaties in 3 dagen
  — dit type vacature scoort consistent goed. Plaats vergelijkbare functies
  op maandag (beste dag voor jullie feed).
• Website-bezoek steeg 8% maar het contactformulier had maar 2 inzendingen.
  Check of de CTA op de vacaturepagina's duidelijk genoeg is.
```

**Model:** Gebruik het standaard model (niet Haiku) — de inzichten moeten
kwalitatief goed zijn. Eén API-call per maand is verwaarloosbaar qua kosten.

**Fallback:** Als de AI-call faalt, stuur het rapport zonder inzichten-sectie
(met een placeholder: "AI-inzichten waren deze maand niet beschikbaar").

### Implementatie

Gebruik inline CSS (e-mailclients strippen `<style>` tags). Bouw de HTML met template literals — geen template engine dependency nodig voor 1 template.

```
services/email-templates/report.js
  → export function buildReportHtml(data, config) → string
```

Light's merkkleuren (#be1e2d rood, #2b2b2b donkergrijs, #f5f5f0 achtergrond) in de e-mail header. Minimaal, professioneel.

---

## Dashboard UI

### Nieuwe componenten

#### 1. Date range picker (vervangt huidige `<select>`)

```
RapportageDatePicker
├── Presets: "Deze week" / "Deze maand" / "Dit kwartaal"
├── Custom: twee date inputs (van / t/m)
└── Toepassen-knop bij custom range
```

Gebruik shadcn/ui `Popover` + `Calendar` component (al beschikbaar in het project).

#### 2. Widget toggles

```
RapportageWidgetConfig (dropdown/popover, rechts naast de date picker)
├── Checkbox per widget:
│   □ Vacature-tegels
│   □ Meest bekeken vacatures
│   □ Marketing-engagement
│   □ Publicaties per kanaal (bar chart)
│   □ Content per week (bar chart)
│   □ Engagement per kanaal
│   □ Kanaaldistributie (donut) ← NIEUW
│   □ Per-post prestaties ← NIEUW
│   □ Deze maand vs vorige maand ← NIEUW (issue #27)
│   □ Activiteitstijdlijn ← NIEUW (issue #27)
│   □ Website-tegels
│   □ Bezoekers per week
│   □ Populaire pagina's
│   └ Top verwijzingen
└── "Standaard herstellen" link
```

Opgeslagen via `PUT /api/rapportage/preferences`. Lege array = alles zichtbaar (backwards compatible).

#### 3. Per-post prestaties tabel (NIEUW)

```
PostMetricsTable
├── Kolommen: Titel | Kanaal | Gepubliceerd | Bereik | Likes | Reacties | Clicks | Shares
├── Sorteerbaar op elke kolom
├── Klikbaar: opent detail-popover met trend (als er historische snapshots zijn)
└── "Metrics verversen" knop per rij (triggert on-demand Buffer fetch)
```

Positie: onder de bestaande engagement-kaart in de Marketing-sectie.

#### 4. Deze maand vs vorige maand (NIEUW — issue #27)

```
MonthComparisonCard
├── Drie kolommen: Metric | Deze maand | Vorige maand | Verschil
├── Rijen: Posts gepubliceerd, Totaal bereik, Likes, Reacties, Clicks
├── Verschil als percentage met kleur (groen omhoog, rood omlaag)
└── Compacte weergave, past in een Card
```

#### 5. Kanaaldistributie donut (NIEUW — issue #27)

```
ChannelDistributionChart
├── Recharts PieChart / donut
├── Segmenten: LinkedIn / Facebook / Instagram
├── Waarde: aantal posts per kanaal in de geselecteerde periode
└── Hover: absoluut getal + percentage
```

Kleuren: LinkedIn blauw (#0077b5), Facebook blauw (#1877f2), Instagram gradient-paars (#c13584). Niet Light's huisstijl — platformkleuren zijn hier logischer.

#### 6. Activiteitstijdlijn (NIEUW — issue #27)

```
ActivityTimeline
├── Lijst van recente acties (laatste 20)
├── Hergebruikt formatActivityTitle() logica van dashboard.js
├── Per item: icoon + beschrijving + relatieve tijd
└── Optioneel: filter op type (publicatie, goedkeuring, concept)
```

Data komt van `activity_log` tabel (al aanwezig via migratie 020). Endpoint: voeg `activity.timeline` toe aan `GET /api/rapportage` response, of hergebruik `GET /api/dashboard/summary` data.

#### 7. E-mail rapport instellingen (owner only)

Onder "Merk instellingen" of als subsectie op de Rapportage-pagina:

```
EmailReportSettings
├── Frequentie: Maandelijks / Uitgeschakeld
├── Ontvangers: multi-input (email adressen)
├── Secties: checkboxes (Vacatures / Marketing / Website)
├── Dag van de maand: dropdown (1-28, default 28 = einde maand)
├── Tijd: dropdown (06:00 – 18:00, stappen van 1 uur)
├── AI-inzichten: toggle aan/uit (standaard aan)
├── "Test e-mail versturen" knop
└── "Opslaan" knop
```

### Layout aanpassingen

Huidige rapportage-grid layout blijft, maar:

1. **Controls-balk** wordt uitgebreid: `[DateRangePicker] [WidgetConfig] [RefreshButton] [StaleIndicator]`
2. **Secties** worden conditioneel gerenderd op basis van `visible_widgets`.
3. **Nieuwe widgets** worden ingevoegd op logische posities:
   - Maandvergelijking: boven de engagement-kaart
   - Per-post tabel: onder engagement per kanaal
   - Kanaaldistributie donut: naast "Publicaties per kanaal" bar chart
   - Activiteitstijdlijn: onderaan de pagina, voor alle secties

---

## Migratiepad

### Fase 1 — Per-post metrics (kleinste waarde, snelste win)

1. Fix `buffer_snapshotter.js`: schrijf genormaliseerde metrics naar `publications.metrics`.
2. Verhoog `MAX_API_CALLS` naar 15.
3. Voeg `perPost` array toe aan `GET /api/rapportage` response.
4. Bouw `PostMetricsTable` component.
5. Voeg on-demand per-post fetch endpoint toe.

Geschatte effort: 1-2 dagen.

### Fase 2 — Dashboard verbeteringen (issue #27)

1. Bouw `MonthComparisonCard` + backend logic voor `thisMonthVsLast`.
2. Bouw `ChannelDistributionChart` (PieChart).
3. Voeg `activity.timeline` toe aan rapportage endpoint.
4. Bouw `ActivityTimeline` component.

Geschatte effort: 1-2 dagen.

### Fase 3 — Aanpasbaar dashboard

1. Migratie 030 draaien.
2. Bouw preferences endpoints.
3. Bouw `RapportageDatePicker` (custom range).
4. Bouw `RapportageWidgetConfig` (toggle panel).
5. Conditionele rendering in `Rapportage.jsx`.

Geschatte effort: 1-2 dagen.

### Fase 4 — E-mailrapporten

1. Kies en configureer e-mail provider (Resend of SMTP).
2. Bouw `services/email.js` abstractie.
3. Bouw `services/email-templates/report.js` HTML template.
4. Bouw e-mail config endpoints + UI.
5. Bouw e-mail cron (aparte timer naast snapshotters).
6. DNS records (SPF/DKIM) voor deliverability.

Geschatte effort: 2-3 dagen.

### Totaal: ~6-9 dagen ontwikkeltijd

---

## Open vragen

1. **Buffer Free-tier per-post API**: is de `post(input: { id })` query beschikbaar op de Free tier, of alleen op betaalde plannen? De snapshotter gebruikt het al, maar het is niet expliciet geverifieerd. [VERIFY bij eerste productie-test.]

2. **Buffer metrics latency**: metrics komen 24-48 uur na publicatie beschikbaar. Moet de UI dit communiceren? Aanbeveling: toon "Metrics beschikbaar over ~24 uur" voor posts jonger dan 48 uur zonder metrics.

3. **E-mail provider keuze**: Resend (aanbevolen) of SMTP via bestaande provider? Resend vereist een account + domein-verificatie. Als Light al een zakelijke e-mail provider heeft (Microsoft 365, Google Workspace), kan die SMTP ook werken maar vereist een app-specifiek wachtwoord.

4. **Wie ontvangt het rapport?** Voorlopig hard naar `vacature@lightpersoneelsdiensten.nl`, maar Sandra en de eigenaar willen het misschien ook op persoonlijk adres. De `recipients` array in de config ondersteunt meerdere ontvangers.

5. **Hoeveel historische data voor maandvergelijking?** Buffer snapshotter loopt pas sinds task #3 live ging. Als er minder dan 30 dagen aan snapshots zijn, is de eerste maandvergelijking onvolledig. Oplossing: toon "Niet genoeg data voor vergelijking" als de vorige periode geen snapshots heeft.

6. **Widget-toggles scope**: per-user of globaal? Aanbeveling: per-user (Sandra wil andere widgets zien dan de eigenaar). De `user_dashboard_preferences` tabel ondersteunt dit.

7. **Rapportage-pagina vs dashboard — BESLUIT:** Maandoverzicht (MonthlyStats + MonthComparison) en kanaaldistributie worden op **beide** pagina's getoond. Per-post tabel, widget-toggles, custom date-range en email-instellingen alleen op `/rapportage`. Dashboard-versie is compact (pure CSS bars); rapportage-versie gebruikt Recharts (al aanwezig) voor rijkere interactie. Bouw de data-laag als gedeelde componenten, de presentatie per pagina.

8. **Rate limit monitoring**: als de Buffer API cap (3000/30d) nadert, moeten we waarschuwen. Bouw een simpele counter in `buffer_snapshotter.js` die het aantal calls per maand bijhoudt en een warning logt bij >2500.

---

## Addendum: Dashboard rapportage-uitbreiding (issue #27)

### Huidige staat dashboard

Het dashboard (`GET /api/dashboard/summary`) levert in een enkel JSON-antwoord:

| Sectie | Wat het toont |
|---|---|
| **Telkaarten** | Wacht op goedkeuring, Gepubliceerd deze week, Actieve vacatures, Feed gezondheid (owner) |
| **Team totaal** | Dezelfde drie tellers, team-breed (owner/manager) |
| **Openstaande concepten** | Goedkeuringswachtrij met inline goedkeuren/afwijzen (owner) of eigen concepten (recruiter) |
| **Recente activiteit** | Laatste 10 `activity_log`-entries met relatieve tijden |
| **Kanaalstatus** | Buffer connected/disconnected pill |
| **Mijn concepten** | Recruiter: eigen 5 recentste drafts |
| **Weekoverzicht** | Recruiter: ingediend/goedgekeurd/afgewezen deze week |
| **Weekoverzicht per teamlid** | Owner: tabel naam / ingediend / goedgekeurd / gepubliceerd |
| **Laatste publicaties** | Viewer: 5 recente published/actief drafts |

### Benodigde dashboard-widgets

#### 1. Maandprestaties-widget ("Prestaties deze maand")

Prominent bovenaan onder de telkaarten. Horizontale rij van compacte stat-blokken:
- Vacatures gepubliceerd, Marketingposts gepubliceerd, Blogs gepubliceerd, Totaal gegenereerd

**Label-voorbeeld:** "November 2026 — 12 vacatures, 8 posts, 3 blogs gepubliceerd"

#### 2. Maandvergelijking ("Deze maand vs. vorige maand")

Per content-type een regel met delta-indicator:
```
Vacatures    14  ▲ +3  (+27%)
Posts         6  ▼ -2  (-25%)
Blogs         3  ─  0  ( 0%)
```

#### 3. Kanaaldistributie ("Verdeling per kanaal")

Horizontale gestapelde balk (pure CSS) met legenda: XML Feed, LinkedIn, Facebook, Instagram.
Data uit `publications` tabel: `GROUP BY channel WHERE published_at` in huidige maand.

#### 4. Activiteitstijdlijn (30 dagen)

Rij van 30 verticale staafjes (dag-voor-dag), hoogte = aantal acties die dag. Hover toont datum + count. Eronder de bestaande activity-list (uitgebreid naar 15 items).

### API-uitbreiding

Voeg toe aan `GET /api/dashboard/summary` response:

```js
{
  monthlyStats: {
    current: { vacatures: 14, posts: 6, blogs: 3, totalGenerated: 31 },
    previous: { vacatures: 11, posts: 8, blogs: 3, totalGenerated: 28 },
    monthLabel: "november 2026"
  },
  channelDistribution: [
    { channel: "xml-feed", label: "XML Feed", count: 14 },
    { channel: "linkedin", label: "LinkedIn", count: 5 },
    { channel: "facebook", label: "Facebook", count: 4 },
    { channel: "instagram", label: "Instagram", count: 3 }
  ],
  dailyActivity: [
    { date: "2026-11-01", count: 3 },
    // ... 30 dagen
  ]
}
```

### Nieuwe componenten

```
Dashboard.jsx
├── <MonthlyStats stats={monthlyStats} />              // nieuw
├── <MonthComparison current={...} previous={...} />   // nieuw
├── <DashMetrics ... />                                // bestaand
├── <ChannelDistribution data={channelDistribution} /> // nieuw
├── <div className="dash-panels">                      // bestaand
│   ├── <ApprovalQueue ... />
│   └── <ActivityTimeline dailyActivity={...} recentActivity={...} />  // uitgebreid
├── <ChannelHealth ... />
└── role-specific panels

Nieuwe bestanden:
- frontend/src/components/dashboard/MonthlyStats.jsx
- frontend/src/components/dashboard/MonthComparison.jsx
- frontend/src/components/dashboard/ChannelDistribution.jsx
- frontend/src/components/dashboard/DailyActivityChart.jsx
```

Geen externe chart-libraries. Pure CSS (`display: flex` met proportionele `width%`). Kleuren uit bestaande design tokens.

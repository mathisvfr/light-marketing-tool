# Light Marketing Tool — CLAUDE.md

## Wat dit is
Een gehoste, multi-user marketing automation tool voor **Light Personeelsdiensten
B.V.**, een uitzendbureau in Rotterdam gespecialiseerd in logistiek-, productie-
en schoonmaakpersoneel (SNF- en Normec VRO-gecertificeerd). De eindgebruikers zijn
niet-technisch. Meerdere mensen met verschillende rollen gebruiken de tool via de
browser. De tool draait op een VPS en wordt lokaal ontwikkeld.

De tool genereert merk-consistente content en publiceert die naar meerdere kanalen,
altijd **na menselijke goedkeuring**. Niets gaat automatisch live. Controle is een
kernvereiste, geen bijzaak.

---

## Twee content-types (fundamenteel gescheiden houden)

**Type A — Vacatures (kandidaat-gericht)**
Gaan via een XML feed naar Jobit/Multiposter, die distribueert naar Indeed
(organisch), Nationale Vacaturebank, Werk.nl, Jobbird en 30+ boards, plus
vacatureposts op Light's eigen Facebook- en LinkedIn-pagina. Talen: NL en PL.

**Type B — Marketingposts (opdrachtgever-gericht / merkcontent)**
Gaan rechtstreeks via onze eigen integraties naar LinkedIn (Pages), Facebook en
Instagram. Dit is merk-/awareness-content gericht op bedrijven die personeel
zoeken. Geen vacatures. Taal: NL.

Deze twee mogen in code, database en UI nooit door elkaar lopen.

---

## Stack
- Frontend: React 19 + Vite + shadcn/ui + TanStack Query + Zustand
- Backend: Node.js + Express, volledig gescheiden in /backend
- Database: PostgreSQL via Supabase (MCP gekoppeld, gebruik bestaand project)
- Auth: JWT (jsonwebtoken) + bcrypt, httpOnly cookies
- AI: Anthropic Claude API (claude-sonnet-4-20250514)
- Beeld-rendering: Satori (HTML/JSX → PNG) voor branded social images
- Vacaturedistributie: Jobit/Multiposter via XML feed (wij hosten de feed)
- Deployment: Docker Compose + Caddy reverse proxy (auto-HTTPS)
- Alle UI-tekst: Nederlands. Gegenereerde content: NL, PL, of beide.

---

## Kanaal-architectuur

```
VACATURES (Type A)
  tool genereert gestructureerde NL/PL vacature
  → goedkeuren zet status 'actief'
  → vacature verschijnt in XML feed op vaste URL (/feeds/jobs.xml)
  → Jobit/Multiposter pullt de feed, distribueert naar boards + eigen pagina's
  → stats later terug te pullen (methode nog te bevestigen)

MARKETINGPOSTS (Type B)
  ├─ tekst         → LinkedIn Pages API        [zelf bouwen]
  ├─ tekst + beeld → Meta Graph API (FB + IG)  [zelf bouwen, na Meta review]
  └─ branded beeld → Satori render pipeline     [zelf bouwen, gedeeld]

WEBSITE / SEO
  → WordPress REST API                          [zelf bouwen]
  (kan ook Satori pipeline gebruiken voor og:images)

KWALITEITSCONTROLE
  → Criticus: 2e Claude-call die content toetst aan merkrichtlijnen vóór
    het de goedkeuringswachtrij in gaat
```

Zelfgebouwde integraties: **LinkedIn Pages, Meta Graph, WordPress, Satori-render,
XML feed.** Al het kandidaat-gerichte boardwerk loopt via Jobit/Multiposter.

---

## LET OP — vroege parallelle taken (long lead, start direct)

Deze blokkeren later de bouw als je ze tot het eind bewaart. Start ze op dag 1,
parallel aan het bouwen:

1. **Meta App Review** voor `instagram_content_publish` + page-publicatierechten.
   - Light's Instagram moet een Business-account zijn, gekoppeld aan hun
     Facebook-pagina.
   - Eén app dekt zowel Facebook als Instagram.
   - Review kost dagen tot weken, buiten onze controle.
   - [VERIFY huidige permissionnamen en reviewvereisten in Meta's docs.]
2. **LinkedIn Marketing Developer Platform** app-goedkeuring voor Pages-posten
   (lichter dan Meta, maar ook doorlooptijd).

De marketingpost-functies (Type B) kunnen pas live zodra deze goedkeuringen rond
zijn. Bouw de functionaliteit alvast, test op eigen accounts, schakel Light's
accounts in zodra goedgekeurd.

---

## Nog te bevestigen (blokkeren de bouw NIET)
- Jobit/Multiposter pull-interval (bepaalt UI-tekst "in feed, wordt opgehaald")
- Statistieken-methode (API/export/feed?) — bouw stats-dashboard als stub
- Veldcontrole vacaturetekst binnen hun templates (waarschijnlijk prima)

---

## Monorepo-structuur
```
light-marketing-tool/
├── CLAUDE.md
├── docker-compose.yml          # productie
├── docker-compose.dev.yml      # lokale dev overrides
├── Caddyfile                   # reverse proxy + auto HTTPS
├── .env.example
├── brand/
│   ├── brand-knowledge.md      # bron van waarheid, runtime ingeladen
│   ├── design-system/          # export uit Claude Design
│   └── docs/                   # ruwe referentiedocs uit Drive
├── backend/
│   ├── src/
│   │   ├── index.js
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT-verificatie + rolcheck
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js         # POST /login, /logout, GET /me
│   │   │   ├── drafts.js       # CRUD content drafts
│   │   │   ├── vacatures.js    # vacature-lifecycle + status
│   │   │   ├── publish.js      # marketingpost publicatie (LI/Meta/WP)
│   │   │   ├── brand.js        # GET/PUT merkinstellingen
│   │   │   ├── channels.js     # OAuth connect/status per kanaal
│   │   │   └── users.js        # owner-only gebruikersbeheer
│   │   ├── services/
│   │   │   ├── claude.js       # generatie + Criticus-check
│   │   │   ├── render.js       # Satori HTML→PNG
│   │   │   ├── feed.js         # XML feed generator
│   │   │   └── channels/
│   │   │       ├── linkedin.js # Pages API (Type B)
│   │   │       ├── meta.js     # Graph API, FB + IG (Type B)
│   │   │       └── wordpress.js
│   │   └── db/
│   │       ├── client.js       # Supabase client
│   │       └── migrations/
│   ├── prompts/
│   │   ├── vacature.md
│   │   ├── marketing-post.md
│   │   └── criticus.md
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── ui/             # shadcn
│   │   │   ├── layout/         # Sidebar, Header, PageWrapper
│   │   │   └── shared/         # StatusBadge, ChannelIndicator, ImagePreview
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── VacaturePlaatsen.jsx
│   │   │   ├── MarketingPost.jsx
│   │   │   ├── ContentWachtrij.jsx
│   │   │   ├── Gepubliceerd.jsx
│   │   │   ├── MerkInstellingen.jsx
│   │   │   └── Gebruikers.jsx
│   │   ├── hooks/
│   │   └── lib/
│   │       ├── api.js
│   │       └── constants.js
│   └── package.json
```

---

## Database-schema — migraties eerst draaien

```sql
-- 001_users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','recruiter','viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 002_drafts (beide content-types, type-veld scheidt ze)
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('vacature','marketing-post')),
  form_data JSONB NOT NULL,
  -- vacature gestructureerde velden:
  titel TEXT,
  plaats TEXT,
  omschrijving_nl TEXT,
  omschrijving_pl TEXT,
  functie_eisen TEXT,
  wat_wij_bieden TEXT,
  salaris TEXT,
  uren TEXT,
  contract TEXT,
  sollicitatie_url TEXT,
  -- marketingpost velden:
  linkedin_post TEXT,
  facebook_post TEXT,
  instagram_caption TEXT,
  image_path TEXT,            -- pad naar gerenderde/geüploade afbeelding
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','actief',
                      'published','expired','rejected')),
  criticus_passed BOOLEAN DEFAULT false,
  criticus_notes TEXT,
  created_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 003_publications (per-kanaal status voor Type B; Type A = feed)
CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id),
  channel TEXT NOT NULL,       -- 'linkedin','facebook','instagram','wordpress'
  status TEXT NOT NULL CHECK (status IN ('pending','success','failed')),
  external_id TEXT,
  error_message TEXT,
  published_at TIMESTAMPTZ
);

-- 004_channel_credentials (OAuth tokens, versleuteld opslaan)
CREATE TABLE channel_credentials (
  channel TEXT PRIMARY KEY,    -- 'linkedin','meta','wordpress'
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  status TEXT DEFAULT 'disconnected'
    CHECK (status IN ('connected','expiring','disconnected')),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 005_brand_settings
CREATE TABLE brand_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 006_agent_tables (LEEG, voor toekomstige Scout/Strategist fase — nu niet gebruiken)
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT,
  summary TEXT,
  source_links JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary TEXT,
  status TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Rollen — afdwingen op middleware-niveau, niet alleen in UI

| Rol | Mag |
|-----|-----|
| `owner` | Alles: goedkeuren, publiceren, gebruikers beheren, merkinstellingen |
| `recruiter` | Drafts maken, indienen ter goedkeuring. NIET publiceren |
| `viewer` | Alleen-lezen: gepubliceerde content, historie |

- Alle routes behalve POST /api/auth/login vereisen geldige JWT.
- JWT in httpOnly cookie, 8u geldig.
- `requireRole('owner')` middleware blokkeert recruiter en viewer.
- Elke DB-write loopt via de backend, nooit direct Supabase vanuit frontend.

---

## XML feed-specificatie (Jobit/Multiposter)

Wij hosten een feed op `GET /feeds/jobs.xml` met alle vacatures met status
'actief'. Veldnamen mogen vrij gekozen worden (Jobit mapt ze in hun UI), maar
houd ze schoon en consistent.

**Harde regels:**
1. **Elke tag in een CDATA-section.** Omschrijving bevat HTML; CDATA voorkomt
   dat de XML breekt.
2. **Plaats = exact één echte plaatsnaam** (bv. "Rotterdam"), nooit een regio of
   "omgeving X", anders werkt afstand-zoeken niet.
3. **Nummer = uniek en stabiel** per vacature (gebruik de draft-UUID).

**Verplichte velden:** Nummer (uniek), Datum, Titel, Plaats, Omschrijving.
**Optioneel (wel invullen voor betere plaatsing):** Functie, Functie-eisen, Wat
wij bieden, Opleiding, Carrièreniveau, Dienstverband, Loon/salaris, Aantal uur,
Contract (Fulltime/Parttime), Sollicitatie-URL, E-mailadres.

**Mapping DB → feed:**
```
id (UUID)               → Nummer (uniek)
created_at              → Datum
titel                   → Titel
plaats                  → Plaats        (valideer: één plaatsnaam!)
omschrijving_nl (HTML)  → Omschrijving  (in CDATA)
functie_eisen           → Functie-eisen
wat_wij_bieden          → Wat wij bieden
salaris                 → Loon/salaris  ("conform CAO" als leeg)
uren                    → Aantal uur
contract                → Contract
sollicitatie_url        → Sollicitatie URL
```

Een gesloten vacature (status != 'actief') valt uit de feed; Jobit haalt 'm dan
offline. Geen aparte expiry-call nodig.

---

## Bouwvolgorde

Bouw stap voor stap. Bevestig na elke stap wat gebouwd is en vraag voordat je
doorgaat. Bouw NIET alles in één keer.

### Stap 1 — Scaffold + database
- Backend met Express, Supabase-client via env-vars.
- Draai alle migraties tegen Supabase.
- Seed één owner (SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD uit env).
- Frontend met Vite + React, shadcn/ui geïnstalleerd en geconfigureerd.
- TanStack Query provider + Zustand auth-store.

### Stap 2 — Auth
- POST /api/auth/login, GET /api/auth/me, POST /api/auth/logout.
- Frontend: Login-pagina (NL labels), AuthContext, protected routes.
- Rol-bewuste navigatie (verberg Gebruikers voor niet-owners).

### Stap 3 — Layout + navigatie
- Sidebar met Light-branding + navitems.
- Topbar: gebruikersnaam + rol-badge + uitloggen.
- Navitems: Dashboard, Vacature plaatsen, Marketing post, Content wachtrij,
  Gepubliceerd, Merk instellingen, Gebruikers (owner only).

### Stap 4 — Dashboard
- Telkaarten: drafts in wachtrij, deze week gepubliceerd, actieve vacatures.
- Goedkeuringswachtrij-widget (owner): pending_approval met goedkeuren/afwijzen.
- Recente activiteit: laatste 10 statuswijzigingen.
- Kanaalstatus: laatst bekende status per kanaal (groen/amber/rood).

### Stap 5 — Vacature plaatsen (Type A)
Formulier: Functietitel, Locatie (default Rotterdam), Uren/week, Startdatum,
Korte omschrijving (max 400 tekens, teller), Taal (NL | NL+PL), Contract.
- POST /api/drafts (status 'draft') → POST /api/drafts/:id/generate.
- Claude genereert **gestructureerde velden** (niet één blob):
  omschrijving_nl, functie_eisen, wat_wij_bieden, en bij NL+PL ook
  omschrijving_pl, plus social_nl/social_pl voor de kandidaat-post.
- Skeleton-loading: "Concept wordt gegenereerd...".
- Criticus-check draait automatisch; toon resultaat.
- Tabbed preview, elk veld bewerkbaar.
- Knoppen: "Opslaan als concept" / "Indienen ter goedkeuring" (recruiter) /
  "Goedkeuren" (owner → status 'actief' → in feed).

### Stap 6 — Marketing post (Type B)
Formulier: Onderwerp, Type (Opdrachtgevers | Kandidaten), Kanalen (LinkedIn,
Facebook, Instagram).
- Claude genereert linkedin_post en/of facebook_post + instagram_caption.
- Bij Instagram/Facebook: render branded afbeelding via Satori (zie stap 11),
  met **upload-override**: owner kan eigen afbeelding uploaden i.p.v. template.
- Criticus-check. Preview met bewerkbare tekst + afbeeldingspreview.
- Goedkeuren (owner) → publiceren via LinkedIn/Meta (alleen als kanaal
  'connected' is).

### Stap 7 — Content wachtrij
Tabel van alle drafts. Kolommen: type-badge, titel, auteur, status-badge,
aangemaakt, kanalen. Filters: status, type, auteur.
Rolafhankelijke acties: owner (goedkeuren/afwijzen/bewerken),
recruiter (eigen drafts bewerken/verwijderen).

### Stap 8 — Gepubliceerd
- Type B: tabel met per-kanaal publicatiestatus (groen/rood/pending).
- Type A: lijst actieve vacatures met "Vacature sluiten" (status → expired,
  valt uit feed). Stats-kolom als stub tot Jobit-methode bekend is.

### Stap 9 — Merk instellingen (owner only)
Form-UI over brand_settings: Bedrijfsnaam, Tone of voice, Wat bieden wij
werknemers, Wat bieden wij opdrachtgevers, Doelgroep werknemers, Doelgroep
opdrachtgevers, Geconfigureerde kanalen.
Kanaal-sectie: connect-knoppen + tokenstatus per kanaal (verbonden / verloopt
binnenkort / opnieuw koppelen).

### Stap 10 — Gebruikers (owner only)
Tabel + "Gebruiker toevoegen" (modal: naam, email, tijdelijk wachtwoord, rol).
Inline rol wijzigen. Laatste owner kan niet verwijderd/gedegradeerd worden.

### Stap 11 — Backend services

**claude.js**
- loadBrandContext(): leest brand_settings uit DB → markdown-string.
- loadPrompt(name): leest /prompts/{name}.md.
- generate(type, formData): Anthropic-call, system = merkcontext + prompt,
  user = JSON van formData. Model retourneert ALLEEN geldige JSON. Parse,
  retry één keer bij parsefout.
- criticus(content): tweede Claude-call met /prompts/criticus.md die content
  toetst aan merkrichtlijnen. Retourneert { passed: bool, notes: string }.

**render.js (Satori)**
- renderSocialImage(template, fields): HTML/JSX met design-system-tokens →
  PNG. Geeft pad terug. [VERIFY: check of benodigde CSS door Satori
  ondersteund wordt; val terug op Puppeteer als een effect ontbreekt.]
- Opslag: VPS-schijf onder /uploads, of object-store. image_path in DB.

**feed.js**
- GET /feeds/jobs.xml: alle vacatures status 'actief' → XML per spec hierboven.
  CDATA om elke tag. Valideer Plaats = één plaatsnaam.

**channels/linkedin.js, meta.js, wordpress.js**
- Elk: publish(content, credentials) met try/catch, schrijft publications-rij.
- meta.js: twee-staps Instagram-flow (media container aanmaken → publiceren),
  vereist afbeelding. FB + IG via dezelfde Graph API.
- Token-refresh-logica; markeer channel_credentials.status bij naderende expiry.

### Stap 12 — Prompts

**prompts/vacature.md** — genereert gestructureerde velden voor een Nederlands
uitzendbureau in no-nonsense Rotterdamse toon. Retourneert ALLEEN JSON met keys:
omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, en bij PL ook
omschrijving_pl, social_pl. Verzin nooit salarissen ("salaris conform CAO" als
leeg). Noem transport/huisvesting als merkcontext die bevat.

**prompts/marketing-post.md** — Type B. Bij "Opdrachtgevers": professionele NL
LinkedIn-post voor HR/operations-managers in food/logistiek (150-200 woorden),
noem certificeringen (SNF, Normec VRO) waar relevant. Bij "Kandidaten":
informele NL Facebook-post. Retourneert ALLEEN JSON: linkedin_post,
facebook_post, instagram_caption.

**prompts/criticus.md** — toetst gegenereerde content aan merkrichtlijnen:
toon, geen verzonnen claims, geen verzonnen salarissen, juiste taal, CTA
aanwezig. Retourneert ALLEEN JSON: { passed: bool, notes: string }. Eén
revisieronde toegestaan.

### Stap 13 — Docker + deploy
- docker-compose.yml: backend (3001), frontend (Nginx, gebouwde dist), Caddy
  (reverse proxy, auto-HTTPS, /api/* → backend, /* → frontend).
- docker-compose.dev.yml: nodemon backend, Vite dev server, geen Caddy.
- .env.example met alle keys (zie onder).

```
# App
NODE_ENV=production
JWT_SECRET=
SEED_OWNER_EMAIL=
SEED_OWNER_PASSWORD=
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
# Anthropic
ANTHROPIC_API_KEY=
# LinkedIn (Type B)
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
# Meta (Type B, FB + IG)
META_APP_ID=
META_APP_SECRET=
# WordPress
WORDPRESS_URL=
WORDPRESS_USERNAME=
WORDPRESS_APP_PASSWORD=
# Domein (Caddy)
DOMAIN=
```

---

## Codestandaarden
- JavaScript (geen TypeScript voorlopig).
- shadcn/ui componenten uit registry, niet zelf bouwen.
- TanStack Query voor server-state, geen handmatige useEffect-fetches.
- Zustand alleen voor auth-state.
- Alle API-fouten retourneren { error: string } in het Nederlands.
- Datums in NL-locale (dd-MM-yyyy).
- Mobiel-responsive (eigenaar checkt vanaf telefoon).
- Geen console.log in productie (NODE_ENV-check).

---

## Nu NIET bouwen (latere fases)
- Scout/Strategist AI-agents (tabellen staan klaar, leeg laten).
- Analytics-grafieken.
- Google Mijn Bedrijf-integratie.
- SEO location-pages generator.
- E-mailnotificaties.
- Directe Indeed/Nationale Vacaturebank API's (loopt via Jobit/Multiposter).

## Definition of done (fase 1)
De eigenaar kan in de browser inloggen, een vacature-formulier in het Nederlands
invullen, binnen ~10s een gestructureerd concept zien (NL en optioneel PL), dit
bewerken, goedkeuren waarna het in de XML feed verschijnt, én een marketingpost
met branded afbeelding genereren, goedkeuren en (na kanaal-koppeling) publiceren
naar LinkedIn/Facebook/Instagram, met per-kanaal statusindicatie.
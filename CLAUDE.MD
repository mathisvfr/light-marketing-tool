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
Dit loopt NIET via Buffer.

**Type B — Marketingposts (opdrachtgever-gericht / merkcontent)**
Gaan via de **Buffer API** naar LinkedIn, Facebook en Instagram. Dit is
merk-/awareness-content gericht op bedrijven die personeel zoeken. Geen vacatures.
Taal: NL.

**Website / SEO — blogs en vacaturepagina's**
Gaan rechtstreeks via de **WordPress REST API**. Buffer kan NIET naar WordPress
publiceren; dat bouwen we zelf.

Deze drie sporen mogen in code, database en UI nooit door elkaar lopen.

---

## Stack
- Frontend: React 19 + Vite + shadcn/ui + TanStack Query + Zustand
- Backend: Node.js + Express, volledig gescheiden in /backend
- Database: PostgreSQL via Supabase (MCP gekoppeld, gebruik bestaand project)
- Auth: JWT (jsonwebtoken) + bcrypt, httpOnly cookies
- AI: Anthropic Claude API (claude-sonnet-4-20250514)
- Beeld-rendering: Satori (HTML/JSX → PNG) voor branded social images
- Social publicatie (Type B): **Buffer API (GraphQL)** — LinkedIn, Facebook, Instagram
- Vacaturedistributie (Type A): Jobit/Multiposter via XML feed (wij hosten de feed)
- Website (blogs/pagina's): WordPress REST API
- Deployment: Docker Compose + Caddy reverse proxy (auto-HTTPS)
- Alle UI-tekst: Nederlands. Gegenereerde content: NL, PL, of beide.

---

## Kanaal-architectuur

```
VACATURES (Type A)
  tool genereert gestructureerde NL/PL vacature
  → goedkeuren zet status 'actief'
  → vacature verschijnt in XML feed op vaste URL (feed.lightpersoneelsdiensten.nl/feeds/jobs.xml)
  → Jobit/Multiposter pullt de feed, distribueert naar boards + eigen pagina's
  → stats later terug te pullen (methode nog te bevestigen)

MARKETINGPOSTS (Type B)
  tool genereert tekst + (Satori) branded afbeelding
  → goedkeuren
  → Buffer API: createPost mutation per kanaal (LinkedIn/Facebook/Instagram)
  → Buffer regelt platform-publicatie + houdt platform-OAuth zelf bij

WEBSITE / SEO
  → WordPress REST API (zelf bouwen)
  (kan ook Satori pipeline gebruiken voor og:images)

KWALITEITSCONTROLE
  → Criticus: 2e Claude-call die content toetst aan merkrichtlijnen vóór
    het de goedkeuringswachtrij in gaat
```

Zelfgebouwde integraties: **Buffer-service (GraphQL), WordPress, Satori-render,
XML feed.** Geen directe LinkedIn/Meta-integratie meer — Buffer vervangt die en
houdt de platform-goedkeuringen zelf. Al het kandidaat-gerichte boardwerk loopt
via Jobit/Multiposter.

---

## Buffer-integratie (Type B) — belangrijk

- **Authenticatie:** persoonlijke Buffer API-key (NIET third-party OAuth). Er is
  precies één Buffer-account (dat van Light). De owner genereert de key in Buffer
  onder Settings → API. Key in .env als BUFFER_API_KEY.
- **Eén account, meerdere kanalen:** Light koppelt LinkedIn/Facebook/Instagram
  binnen Buffer's eigen UI (gewone consumer-OAuth, één keer klikken). Wij raken
  Meta's of LinkedIn's developer-portal nooit aan. GEEN Meta App Review nodig.
- **Publiceren:** GraphQL `createPost` mutation met text, channelId, en optioneel
  dueAt (ISO 8601 UTC) voor inplannen. Mode 'addToQueue' of 'customScheduled'.
- **Kanaal-IDs:** haal channelId's op via de channels-query bij setup, sla ze op
  in channel_credentials (zie schema) zodat we per kanaal kunnen posten.
- **Afbeeldingen:** gebruik het HUIDIGE assets-formaat (Buffer wijzigde dit
  25 mei 2026; oude format faalt). [VERIFY assets-formaat in Buffer docs bij bouw.]
- **Free tier let op:** levenslange cap van 8 kanaalkoppelingen ooit (niet actief).
  Niet loskoppelen/herkoppelen zonder reden. 3 kanalen = ruim binnen marge.
- [VERIFY bij setup] persoonlijke key mag posten naar alle 3 gekoppelde kanalen
  op de Free tier.

---

## LET OP — vroege parallelle taken (long lead, start direct)

1. **Buffer-account opzetten:** Light maakt Buffer-account, koppelt LinkedIn +
   Facebook + Instagram in Buffer's UI, owner genereert persoonlijke API-key.
   (Dit verving de Meta/LinkedIn App Reviews uit eerdere plannen — die zijn
   VERVALLEN, Buffer houdt die goedkeuringen.)
2. **Anbecom/hosting-beslissing:** waar draait de backend + feed. Bepaalt server-IP
   voor het DNS A-record op feed.lightpersoneelsdiensten.nl. Blokkeert launch,
   niet de bouw.
3. **Jobit/Multiposter follow-up:** pull-interval, stats-methode, veld-mapping
   bevestigen.

---

## Nog te bevestigen (blokkeren de bouw NIET)
- Jobit/Multiposter pull-interval (bepaalt UI-tekst "in feed, wordt opgehaald")
- Statistieken-methode (API/export/feed?) — bouw stats-dashboard als stub
- Buffer Free-tier API-posting naar alle 3 kanalen [VERIFY bij setup]
- Buffer huidige assets-formaat voor afbeeldingen [VERIFY bij bouw]

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
│   │   │   ├── publish.js      # Type B publicatie (Buffer) + WordPress
│   │   │   ├── brand.js        # GET/PUT merkinstellingen
│   │   │   ├── channels.js     # Buffer kanaal-status + WordPress-koppeling
│   │   │   └── users.js        # owner-only gebruikersbeheer
│   │   ├── services/
│   │   │   ├── claude.js       # generatie + Criticus-check
│   │   │   ├── render.js       # Satori HTML→PNG
│   │   │   ├── feed.js         # XML feed generator
│   │   │   ├── buffer.js       # Buffer GraphQL client (createPost etc.)
│   │   │   └── wordpress.js    # WordPress REST
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

-- 002_drafts (alle content-types, type-veld scheidt ze)
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('vacature','marketing-post','blog')),
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
  -- blog velden:
  blog_titel TEXT,
  blog_html TEXT,
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

-- 003_publications (per-kanaal status voor Type B + WordPress; Type A = feed)
CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id),
  channel TEXT NOT NULL,       -- 'linkedin','facebook','instagram','wordpress'
  via TEXT,                    -- 'buffer' of 'wordpress' of 'feed'
  status TEXT NOT NULL CHECK (status IN ('pending','scheduled','success','failed')),
  external_id TEXT,            -- Buffer post-id of WordPress post-id
  scheduled_for TIMESTAMPTZ,   -- als ingepland via Buffer dueAt
  error_message TEXT,
  published_at TIMESTAMPTZ
);

-- 004_channel_credentials
-- Voor Buffer: één key + de channelId's per platform.
-- Voor WordPress: app-password (versleuteld).
CREATE TABLE channel_credentials (
  channel TEXT PRIMARY KEY,    -- 'buffer:linkedin','buffer:facebook',
                               -- 'buffer:instagram','wordpress'
  buffer_channel_id TEXT,      -- Buffer channelId (voor de buffer:* rijen)
  secret TEXT,                 -- WordPress app-password (versleuteld)
  status TEXT DEFAULT 'disconnected'
    CHECK (status IN ('connected','disconnected')),
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

Wij hosten een feed op `GET /feeds/jobs.xml` (op subdomein
feed.lightpersoneelsdiensten.nl) met alle vacatures met status 'actief'.
Veldnamen mogen vrij gekozen worden (Jobit mapt ze in hun UI), maar houd ze
schoon en consistent.

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
- Kanaalstatus: Buffer-kanalen + WordPress (groen/rood).

### Stap 5 — Vacature plaatsen (Type A) [HOOGSTE WAARDE — eerst af]
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

### Stap 6 — XML feed (feed.js)
- GET /feeds/jobs.xml: alle vacatures status 'actief' → XML per spec hierboven.
  CDATA om elke tag. Valideer Plaats = één plaatsnaam.
- Lokaal testbaar in de browser; geen externe afhankelijkheid.

### Stap 7 — Content wachtrij
Tabel van alle drafts. Kolommen: type-badge, titel, auteur, status-badge,
aangemaakt, kanalen. Filters: status, type, auteur.
Rolafhankelijke acties: owner (goedkeuren/afwijzen/bewerken),
recruiter (eigen drafts bewerken/verwijderen).

### Stap 8 — Gepubliceerd
- Type A: lijst actieve vacatures met "Vacature sluiten" (status → expired,
  valt uit feed). Stats-kolom als stub tot Jobit-methode bekend is.
- Type B + blog: tabel met per-kanaal publicatiestatus (groen/rood/ingepland).

### Stap 9 — Satori render pipeline (render.js)
- renderSocialImage(template, fields): HTML/JSX met design-system-tokens → PNG.
  Geeft pad/URL terug. [VERIFY: check of benodigde CSS door Satori ondersteund
  wordt; val terug op Puppeteer als een effect ontbreekt.]
- Opslag: VPS-schijf onder /uploads (publiek bereikbaar zodat Buffer de
  afbeeldings-URL kan ophalen), of object-store. image_path in DB.
- Bouw en test geïsoleerd vóór koppeling aan de marketingpost-flow.

### Stap 10 — Marketing post (Type B) via Buffer
Formulier: Onderwerp, Type (Opdrachtgevers | Kandidaten), Kanalen (LinkedIn,
Facebook, Instagram).
- Claude genereert linkedin_post en/of facebook_post + instagram_caption.
- Render branded afbeelding via Satori, met **upload-override** (owner kan eigen
  afbeelding uploaden i.p.v. template).
- Criticus-check. Preview met bewerkbare tekst + afbeeldingspreview.
- Goedkeuren (owner) → buffer.js doet createPost per gekozen kanaal.
- Optie "nu publiceren" (addToQueue) of "inplannen" (customScheduled + dueAt).
- Schrijf per kanaal een publications-rij (via='buffer', external_id=Buffer post-id,
  status 'scheduled' of 'success').

### Stap 11 — WordPress (blogs/pagina's) (wordpress.js)
- Aparte content-flow type 'blog'. Claude genereert blog_titel + blog_html.
- Criticus-check. Owner keurt goed → POST naar WordPress REST /wp-json/wp/v2/posts.
- Optioneel: og:image via Satori.
- Schrijf publications-rij (via='wordpress').

### Stap 12 — Merk instellingen (owner only)
Form-UI over brand_settings: Bedrijfsnaam, Tone of voice, Wat bieden wij
werknemers, Wat bieden wij opdrachtgevers, Doelgroep werknemers, Doelgroep
opdrachtgevers.
Kanaal-sectie:
- Buffer: toon gekoppelde kanalen + channelId's (opgehaald via channels-query),
  status groen/rood. Knop "kanalen verversen" (her-fetch channelId's).
- WordPress: URL + app-password invoeren, testverbinding.

### Stap 13 — Gebruikers (owner only)
Tabel + "Gebruiker toevoegen" (modal: naam, email, tijdelijk wachtwoord, rol).
Inline rol wijzigen. Laatste owner kan niet verwijderd/gedegradeerd worden.

### Stap 14 — Backend services (detail)

**claude.js**
- loadBrandContext(): leest brand_settings uit DB → markdown-string.
- loadPrompt(name): leest /prompts/{name}.md.
- generate(type, formData): Anthropic-call, system = merkcontext + prompt,
  user = JSON van formData. Model retourneert ALLEEN geldige JSON. Parse,
  retry één keer bij parsefout.
- criticus(content): tweede Claude-call met /prompts/criticus.md. Retourneert
  { passed: bool, notes: string }. Eén revisieronde toegestaan.

**buffer.js**
- GraphQL-client tegen Buffer's endpoint, auth via Bearer BUFFER_API_KEY.
- listChannels(): haalt kanalen + channelId's op (setup + "verversen").
- createPost({ channelId, text, imageUrl, dueAt }): createPost mutation.
  mode 'addToQueue' (nu) of 'customScheduled' (met dueAt ISO 8601 UTC).
  Gebruik HUIDIG assets-formaat voor de afbeelding. [VERIFY format.]
- Map response naar publications (external_id = Buffer post-id).
- try/catch met NL-foutmelding; bij MutationError de message loggen.

**feed.js** — zie XML feed-specificatie hierboven.

**wordpress.js**
- publishPost({ title, html, imageUrl? }): POST /wp-json/wp/v2/posts met
  app-password basic auth. Map response naar publications.

### Stap 15 — Prompts

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
aanwezig. Retourneert ALLEEN JSON: { passed: bool, notes: string }.

### Stap 16 — Docker + deploy
- docker-compose.yml: backend (3001), frontend (Nginx, gebouwde dist), Caddy
  (reverse proxy, auto-HTTPS, /api/* → backend, /* → frontend, /feeds/jobs.xml →
  backend op feed-subdomein).
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
# Buffer (Type B social)
BUFFER_API_KEY=
# WordPress
WORDPRESS_URL=
WORDPRESS_USERNAME=
WORDPRESS_APP_PASSWORD=
# Domein (Caddy)
DOMAIN=
FEED_DOMAIN=feed.lightpersoneelsdiensten.nl
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
- Directe LinkedIn/Meta-integratie (loopt via Buffer).
- Directe Indeed/Nationale Vacaturebank API's (loopt via Jobit/Multiposter).

## Definition of done (fase 1)
De eigenaar kan in de browser inloggen, een vacature-formulier in het Nederlands
invullen, binnen ~10s een gestructureerd concept zien (NL en optioneel PL), dit
bewerken, goedkeuren waarna het in de XML feed verschijnt; én een marketingpost
met branded afbeelding genereren, goedkeuren en via Buffer publiceren/inplannen
naar LinkedIn/Facebook/Instagram; én een blog publiceren naar WordPress, met
per-kanaal statusindicatie.
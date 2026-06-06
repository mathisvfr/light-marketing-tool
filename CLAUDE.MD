# Light Marketing Tool — CLAUDE.md

## What this is
A hosted multi-user marketing automation tool for Light Personeelsdiensten B.V.,
a Rotterdam staffing agency. Non-technical end users. Multiple people with
different roles use this via browser. Deployed on a VPS, developed locally.

## Stack
- Frontend: React 19 + Vite + shadcn/ui + TanStack Query + Zustand
- Backend: Node.js + Express, fully separated in /backend
- Database: PostgreSQL via Supabase (MCP connected, use existing project)
- Auth: JWT (jsonwebtoken) + bcrypt, httpOnly cookies
- Orchestration: n8n Cloud (webhook-based, credentials in .env)
- AI: Anthropic Claude API (claude-sonnet-4-20250514)
- Deployment: Docker Compose + Caddy reverse proxy
- All UI text: Dutch. Generated content: NL, PL, or both.

## Monorepo structure
```
light-marketing-tool/
├── CLAUDE.md
├── docker-compose.yml          # production
├── docker-compose.dev.yml      # local dev overrides
├── Caddyfile                   # reverse proxy + auto HTTPS
├── .env.example
├── backend/
│   ├── src/
│   │   ├── index.js            # Express entry
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT verification + role guard
│   │   │   └── errorHandler.js
│   │   ├── routes/
│   │   │   ├── auth.js         # POST /login, POST /logout, GET /me
│   │   │   ├── drafts.js       # CRUD for content drafts
│   │   │   ├── publish.js      # trigger n8n webhooks
│   │   │   ├── brand.js        # GET/PUT brand settings
│   │   │   └── users.js        # owner-only user management
│   │   ├── services/
│   │   │   ├── claude.js       # Anthropic API calls
│   │   │   ├── n8n.js          # webhook dispatch + status polling
│   │   │   └── prompts.js      # loads and fills prompt templates
│   │   └── db/
│   │       ├── client.js       # Supabase JS client
│   │       └── migrations/     # SQL migration files
│   ├── prompts/
│   │   ├── vacature.md
│   │   └── marketing-post.md
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx             # router + auth context
│   │   ├── components/
│   │   │   ├── ui/             # shadcn components (auto-generated)
│   │   │   ├── layout/         # Sidebar, Header, PageWrapper
│   │   │   └── shared/         # StatusBadge, ChannelIndicator, etc.
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── VacaturePlaatsen.jsx
│   │   │   ├── MarketingPost.jsx
│   │   │   ├── ContentWachtrij.jsx
│   │   │   ├── Gepubliceerd.jsx
│   │   │   ├── MerkInstellingen.jsx
│   │   │   └── Gebruikers.jsx
│   │   ├── hooks/
│   │   │   ├── useAuth.js
│   │   │   └── useDraft.js
│   │   └── lib/
│   │       ├── api.js          # typed fetch wrapper, auto-attaches JWT
│   │       └── constants.js
│   ├── index.html
│   └── package.json
└── brand/
    └── brand-knowledge.md      # source of truth, loaded at runtime
```

## Database schema — run these migrations first

```sql
-- migration 001
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'recruiter', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('vacature', 'marketing-post')),
  form_data JSONB NOT NULL,
  content_nl TEXT,
  content_pl TEXT,
  social_nl TEXT,
  social_pl TEXT,
  linkedin_post TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','pending_approval','approved','published','expired')),
  created_by UUID REFERENCES users(id),
  reviewed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE publications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID REFERENCES drafts(id),
  channel TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','success','failed')),
  external_id TEXT,
  error_message TEXT,
  published_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ
);

CREATE TABLE brand_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Auth rules — enforce at middleware level, not just UI

- All routes except POST /api/auth/login require a valid JWT
- JWT stored in httpOnly cookie, 8h expiry
- Role guard middleware: requireRole('owner') blocks recruiter and viewer
- Recruiters: can create drafts, submit for approval. Cannot approve or publish.
- Owners: can do everything including approve, publish, manage users
- Viewers: GET requests only on drafts and publications

## Build order

### Step 1: Scaffold and database
- Initialize backend with Express, set up Supabase client using env vars
- Run SQL migrations against Supabase
- Seed one owner user (email+password from env SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD)
- Initialize frontend with Vite + React, install and configure shadcn/ui
- Set up TanStack Query provider in App.jsx
- Configure Zustand store for auth state (user object + role)

### Step 2: Auth system
- POST /api/auth/login: validate credentials, return JWT in httpOnly cookie
- GET /api/auth/me: return current user from token
- POST /api/auth/logout: clear cookie
- Frontend: Login page (email + wachtwoord, Dutch labels)
- Frontend: AuthContext + useAuth hook
- Frontend: Protected route wrapper that redirects to /login if no valid session
- Frontend: Role-aware nav (hide Gebruikers from non-owners)

### Step 3: Layout and navigation
Build the persistent shell:
- Left sidebar with Light's branding (logo placeholder + company name)
- Nav items: Dashboard, Vacature plaatsen, Marketing post, Content wachtrij,
  Gepubliceerd, Merk instellingen, Gebruikers (owner only)
- Top bar: current user name + role badge + logout button
- Main content area with page title slot

### Step 4: Dashboard page
Show:
- Count cards: drafts in wachtrij (pending approval), published this week,
  active vacatures
- Approval queue widget (owner only): list of pending_approval drafts with
  quick approve/reject buttons
- Recent activity feed: last 10 status changes across all drafts
- Channel health: last known status per channel (green/red dot)

### Step 5: Vacature plaatsen
Form:
- Functietitel (text, required)
- Locatie (text, default "Rotterdam")
- Uren per week (number, required)
- Startdatum (date picker, required)
- Korte omschrijving (textarea, max 400 chars, character counter)
- Taal (segmented control: "Nederlands" | "Nederlands + Pools")
- Kanalen (checkbox group: LinkedIn Jobs, Indeed, Facebook/Instagram, WordPress)
  Disable channels if not configured in brand settings.

On submit:
- POST /api/drafts with form data, status: 'draft'
- Then POST /api/drafts/:id/generate to trigger Claude
- Show skeleton loading state: "Concept wordt gegenereerd..."
- Display tabbed preview on success:
  Tab 1: Vacature tekst NL (editable textarea)
  Tab 2: Social post NL (editable textarea)
  Tab 3: Vacature tekst PL (if requested, editable textarea)
  Tab 4: Social post PL (if requested, editable textarea)
- "Opslaan als concept" button → saves edits, status stays 'draft'
- "Indienen ter goedkeuring" button (recruiter) → status: 'pending_approval'
- "Goedkeuren en publiceren" button (owner only) → POST /api/publish/:id

### Step 6: Marketing post
Same generate → preview → submit flow.
Form: Onderwerp (text), Type (radio: Opdrachtgevers | Kandidaten),
Kanalen (LinkedIn, Facebook/Instagram).
Preview tabs: LinkedIn post (editable), Facebook/Instagram post (editable).

### Step 7: Content wachtrij
Table view of all drafts. Columns: type badge, title, auteur, status badge,
aangemaakt, kanalen.
Filters: status (all/draft/pending/approved), type (vacature/marketing),
auteur.
Row actions (role-gated):
- Owner: Goedkeuren, Afwijzen (with optional comment), Bewerken
- Recruiter: Bewerken (own drafts only), Verwijderen (own drafts only)
Status badges: color-coded. Draft=gray, Wacht op goedkeuring=amber,
Goedgekeurd=blue, Gepubliceerd=green, Verlopen=muted.

### Step 8: Gepubliceerd
Table of published items with per-channel publication status.
Columns: titel, type, gepubliceerd op, kanalen with per-channel
green/red/pending indicators.
"Vacature sluiten" button on published vacatures → POST /api/publish/:id/expire
which fires n8n expiry webhook.

### Step 9: Merk instellingen (owner only)
Form UI over brand_settings table. Fields:
- Bedrijfsnaam
- Tone of voice (textarea: describe Light's tone)
- Wat bieden wij werknemers (textarea: transport, housing, CAO, etc.)
- Wat bieden wij opdrachtgevers (textarea: certifications, expertise)
- Doelgroep werknemers (textarea: Polish workers, Dutch blue-collar, Rotterdam)
- Doelgroep opdrachtgevers (textarea: food production, logistics, Rotterdam)
- Geconfigureerde kanalen (checkboxes: which channels are active)
- API status indicators: show green/red for each connected channel
Save button → PUT /api/brand (owner only)

### Step 10: Gebruikers (owner only)
Table: naam, email, rol, aangemaakt.
"Gebruiker toevoegen" button → modal with name, email, tijdelijk wachtwoord,
rol selector.
"Rol wijzigen" inline select per user.
Cannot delete or demote the last owner.

### Step 11: Backend services

**claude.js service:**
- loadBrandContext(): reads brand_settings from DB, formats as markdown string
- loadPrompt(name): reads /prompts/{name}.md
- generate(type, formData): calls Anthropic API with system prompt =
  brand context + prompt template, user message = JSON.stringify(formData)
- Model must return ONLY valid JSON. Parse response, throw on invalid JSON.
- Retry once on JSON parse failure before returning error.

**n8n.js service:**
- publish(draftId, channels, content): POST to N8N_WEBHOOK_VACATURE or
  N8N_WEBHOOK_MARKETING with full payload
- expire(draftId, externalIds): POST to N8N_WEBHOOK_EXPIRE
- n8n responds with per-channel results. Map to publications table.
- On n8n timeout (>15s): mark channels as 'pending', poll for status.

**prompts/vacature.md:**
You are a content writer for a Dutch staffing agency called Light
Personeelsdiensten. You write in a direct, no-nonsense Rotterdam tone.
You will receive brand context and a vacancy form submission.

Return ONLY a valid JSON object with these exact keys:
- vacature_nl: professional Dutch vacancy text, 300-400 words
- social_nl: short Facebook/Instagram post in Dutch, max 150 words, ends
  with a CTA, mentions transport and housing if brand context includes these
- vacature_pl: Polish translation of vacature_nl (only if form.taal includes
  Polish)
- social_pl: Polish version of social_nl (only if form.taal includes Polish)

Never invent salary figures. Write "salaris conform CAO" if not specified.
Never use "wij" and "jij" inconsistently. Pick one and use it throughout.

**prompts/marketing-post.md:**
You are a content writer for Light Personeelsdiensten, a Rotterdam staffing
agency specializing in logistics, production, and cleaning staff.

Return ONLY a valid JSON object with these exact keys:
- linkedin_post: if type is "Opdrachtgevers", a professional Dutch LinkedIn
  post targeting HR/operations managers, 150-200 words
- facebook_post: if type is "Kandidaten", an informal Dutch Facebook post
  targeting blue-collar workers in Rotterdam, 100-150 words

Include relevant certifications (SNF, Normec VRO) when appropriate for
Opdrachtgevers posts.

### Step 12: Docker setup

docker-compose.yml (production):
- backend service: Node.js, port 3001, mounts ./brand and ./backend/prompts
- frontend service: Nginx serving built React dist
- Caddy service: reverse proxy, auto HTTPS, routes /api/* to backend,
  /* to frontend
- All services load from .env

docker-compose.dev.yml (development override):
- backend: nodemon, hot reload, port 3001 exposed directly
- frontend: Vite dev server, port 5173 exposed directly
- No Caddy (direct access in dev)

.env.example:
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

# n8n webhooks
N8N_WEBHOOK_VACATURE=
N8N_WEBHOOK_MARKETING=
N8N_WEBHOOK_EXPIRE=

# Domain (for Caddy)
DOMAIN=
```

## Code standards
- JavaScript only (no TypeScript for now)
- shadcn/ui components from registry, not hand-rolled
- TanStack Query for all server state, no manual useEffect for data fetching
- Zustand only for auth state, nothing else
- All API errors return { error: string } in Dutch
- All dates displayed in Dutch locale (dd-MM-yyyy)
- Mobile responsive (Light's owner likely checks from phone)
- No console.log in production (use NODE_ENV check)
- Every database write goes through the backend, never direct Supabase
  from frontend

## Do not build yet
- SEO content engine / location pages (phase 2)
- Analytics charts (phase 2)
- Google Mijn Bedrijf integration (phase 2)
- Email notifications
- Nationale Vacaturebank integration
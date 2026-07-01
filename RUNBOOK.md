# Light Marketing Tool Runbook

## 1) Pre-flight checks

- Ensure Docker Desktop is running.
- Ensure `.env` exists in project root.
- Required `.env` values:
  - `JWT_SECRET`
  - `SEED_OWNER_EMAIL`
  - `SEED_OWNER_PASSWORD`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY`
  - `ANTHROPIC_API_KEY` (optional for fallback generation, recommended for production)
  - `BUFFER_API_KEY` (for marketing posts via Buffer)
  - `N8N_WEBHOOK_VACATURE`
  - `N8N_WEBHOOK_MARKETING`
  - `N8N_WEBHOOK_EXPIRE`
  - `DOMAIN` (production with Caddy)

## 2) Database schema check

The app expects these tables in Supabase public schema:
- users
- drafts
- publications
- brand_settings

If missing, apply `backend/src/db/migrations/001_init.sql` in Supabase SQL editor.

## 3) Seed owner account

From project root:

PowerShell:
- `Set-Location backend`
- `npm ci`
- `npm run seed:owner`

Expected result: owner user is inserted or upserted by email.

## 4) Local development (without Caddy)

From project root:
- `docker compose -f docker-compose.dev.yml up --build`

Services:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

Stop:
- `docker compose -f docker-compose.dev.yml down`

## 5) Production stack (with Caddy)

From project root:
- `docker compose -f docker-compose.yml up --build -d`

Check status:
- `docker compose -f docker-compose.yml ps`

View logs:
- `docker compose -f docker-compose.yml logs -f backend`
- `docker compose -f docker-compose.yml logs -f frontend`
- `docker compose -f docker-compose.yml logs -f caddy`

Stop:
- `docker compose -f docker-compose.yml down`

## 6) Smoke tests

- `GET /api/health` returns status ok.
- Login works with seeded owner.
- Create and generate a vacature concept.
- Submit/approve/publish flow updates statuses.
- Marketing post generate flow works.
- Content queue filters and actions work.
- Published page shows per-channel statuses.
- Brand settings save works for owner.
- User management add/update role works and blocks last owner demotion.

## 7) Troubleshooting

### Supabase from backend returns fetch failed
- Verify `SUPABASE_URL` is reachable from machine/container network.
- Check proxy/firewall/corporate DNS restrictions.
- Verify service role key belongs to same `SUPABASE_URL` project.

### Authentication issues
- Ensure `JWT_SECRET` is set and stable across restarts.
- Ensure browser allows cookies for your domain.

### n8n publishing issues
- Verify webhook URLs are non-empty and reachable.
- Check backend logs for timeout handling and pending statuses.

### Buffer publishing issues
- Verify `BUFFER_API_KEY` is valid or the Buffer token is saved under Merk instellingen.
- Ensure each connected social profile has its Buffer channel ID configured.
- For Instagram image posts, ensure `PUBLIC_APP_URL` or `APP_BASE_URL` resolves uploaded files publicly over HTTPS.

## 8) Recommended safety

- Rotate any key that appeared in terminal output or logs.
- Do not commit `.env` to git.
- Keep service role key only on backend side.

## 9) Multiposter XML feed koppelen (uitvoering)

Doel: vacatures met status `actief` inladen in Multiposter via de publieke XML feed.

### 9.1 Voorwaarden

- Productie stack draait en is extern bereikbaar via HTTPS.
- Feed endpoint werkt: `GET /feeds/jobs.xml`.
- Alleen vacatures met status `actief` staan in de feed.
- Verplichte XML velden aanwezig: Nummer, Datum, Titel, Plaats, Omschrijving.

### 9.2 Feed URL bepalen

- Productie URL is: `https://<jouwdomein>/feeds/jobs.xml`.
- Controleer in browser of met curl dat je XML terugkrijgt met status 200.

### 9.3 Optionele feed-auth configureren

- Standaard is de feed publiek.
- Voor Basic Auth zet je in `.env`:
  - `FEEDS_BASIC_AUTH_USERNAME`
  - `FEEDS_BASIC_AUTH_PASSWORD`
- Herstart backend na wijzigen van env-vars.

### 9.4 Multiposter wizard (zoals in screenshot)

Stap 1 - Feed gegevens:
- Feed naam: `Vacatures`
- Feed URL: `https://<jouwdomein>/feeds/jobs.xml`
- Authenticatie: uit of Basic (afhankelijk van 9.3)
- Medewerker: kies verantwoordelijke medewerker
- Vestiging: kies juiste vestiging (meestal Rotterdam)

Stap 2 - Selecteer vacature veld:
- Kies de herhalende vacature-node: `job`
- Controleer dat Multiposter meerdere records uit de feed detecteert

Stap 3 - Velden instellen:
- Koppel Multiposter-velden aan XML tags:
  - Nummer (uniek) -> `Nummer`
  - Datum -> `Datum`
  - Titel -> `Titel`
  - Plaats -> `Plaats`
  - Omschrijving -> `Omschrijving`
  - Functie -> `Functie`
  - Functie-eisen -> `FunctieEisen`
  - Wat wij bieden -> `WatWijBieden`
  - Opleiding -> `Opleiding`
  - Carriereniveau -> `CarriereNiveau`
  - Dienstverband -> `Dienstverband`
  - Loon/salaris -> `LoonSalaris`
  - Aantal uur -> `AantalUur`
  - Contract -> `Contract`
  - Sollicitatie URL -> `SollicitatieUrl`
  - E-mailadres -> `Email`

### 9.5 Validatie na koppelen

- Maak 2 testvacatures in de app en zet beide op `actief`.
- Controleer dat beide in de XML feed staan.
- Draai Multiposter import/sync en controleer dat beide vacatures zichtbaar zijn.
- Zet 1 testvacature op `expired` en verifieer dat deze verdwijnt na sync.

### 9.6 Bekende functionele regels

- Iedere XML tag gebruikt CDATA.
- `Plaats` bevat exact 1 plaatsnaam (geen regio/omgeving).
- `Nummer` blijft stabiel en uniek (UUID uit drafts).

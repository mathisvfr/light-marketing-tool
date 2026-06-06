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

## 8) Recommended safety

- Rotate any key that appeared in terminal output or logs.
- Do not commit `.env` to git.
- Keep service role key only on backend side.

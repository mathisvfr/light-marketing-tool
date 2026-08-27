# Plan: Coordination Loop + Trust Foundations

Status: DRAFT (in autoplan review)
Branch: `agents/todos-implementation-plan`
Author: mathisvfr
Date: 2026-08-27

## Problem

The publishing tool is now functionally complete: three content types (vacatures / marketing / blogs), Buffer scheduling with a calendar and recurring templates, Kalender, autosave, per-platform preview, media library, onboarding. But the **human coordination loop is empty**. When Sandra submits a draft, silence. When Luke approves, silence. When Buffer publishes on Thursday morning, silence. Users have no reason to come back to the tool between explicit tasks.

The design doc identified "abandoned in week 2" as the biggest adoption risk. The premise ("Luke/Sandra/Liza will maintain a weekly rhythm without prompts") is the most fragile one. Everything shipped so far assumes they'll self-motivate. This plan builds the pull.

Alongside, two trust foundations are missing:
- **Buffer status stays 'scheduled' forever** if a post fires (or fails to fire) at its scheduled time. Our DB and Buffer's DB drift.
- **Generation is destructive**: hitting Generate again overwrites the last version with no way to recover Sandra's edits.

## Users

- **Sandra (recruiter)** — daily creator of vacatures. Wants to know Luke saw her work + whether it went live.
- **Liza (recruiter)** — weekly creator of marketing posts. Same needs as Sandra plus wants to know what actually landed on LinkedIn/Facebook/Instagram.
- **Luke (owner/approver)** — reviews everything. Wants prompts when there's something to approve, without becoming a full-time app-checker.

## Goals

1. Every state transition that matters to another user triggers a notification.
2. Each user's Dashboard reflects their own work, not the tool's overall state.
3. Scheduled posts show honest status (published / failed / cancelled), reconciled with Buffer's reality.
4. Sandra can recover from an accidental regenerate without losing her manual edits.
5. Luke can approve from his phone in Content wachtrij and MarketingPost — no desktop assumption.
6. Users see what's working (engagement stats) so effort feels connected to outcome.
7. Sandra can find previously used images fast (search + tags in the bibliotheek).

## Non-goals

- **Chat / real-time messaging.** Email + in-app is enough.
- **Auto-publish based on stats.** All approvals stay manual per CLAUDE.md.
- **Multi-tenancy or multi-org.** One Buffer account.
- **Full analytics warehouse.** Just enough stats to feel the loop close.

## Scope (three batches, seven items)

### Batch A — Human coordination loop

#### Item 1: Email notifications

Wire the existing `services/notifications.js` stub into a real transport (Resend, EU region) and fire on 4 events:

| Event | Recipient | When |
|-------|-----------|------|
| `draft.submitted` | All owners | Recruiter submits for approval |
| `draft.approved` | Draft creator | Owner approves |
| `draft.rejected` | Draft creator | Owner rejects (with comment) |
| `publication.fired` | Owner | Buffer confirms a scheduled post went live (Batch B feeds this) |

Backend:
- `.env`: `NOTIFICATIONS_ENABLED=true`, `NOTIFICATION_TRANSPORT=resend`, `RESEND_API_KEY`
- Extend `services/notifications.js` with a `resend` transport branch
- Wire calls at the 4 state-transition points in existing routes (drafts submit/approve/reject; publications success in Batch B)
- Dutch email templates (per-event) with a "Bekijk in tool"-link back to the app
- Per-user preferences later (out of scope for MVP; every user gets every event that names them as recipient)

Frontend:
- Nothing in MVP. In-app notification center is post-MVP.

Deploy:
- Provider decision: **Resend** (EU region for GDPR, free tier fits Light's volume, simple SDK). Alternative: Postmark. Nodemailer + SMTP is too much operational surface for a solo dev.

#### Item 2: Creator-personalized dashboard

Current dashboard shows tool-wide counts (pendingApproval, publishedThisWeek, activeVacatures). Split into role-aware views:

- **Recruiter (Sandra/Liza) view:** "Jouw concepten in wachtrij", "Jouw gepubliceerd deze week", "Jouw ingepland deze week." Personal metrics.
- **Owner (Luke) view:** existing dashboard PLUS a "Wat je hebt goedgekeurd vandaag/deze week" strip.
- **Viewer:** existing dashboard (read-only, unchanged).

Backend:
- Extend `GET /dashboard/summary` to accept the caller's role automatically and return per-user metrics for recruiters. New query params: none (role from req.user).
- Query changes: add `.eq('created_by', userId)` filters for recruiter role.

Frontend:
- Conditional card renders in `Dashboard.jsx` based on role.
- Recent activity feed already exists; filter it to the user's own activity for recruiters.

### Batch B — Trust foundations

#### Item 3: Buffer post-fire status sync

Probe: does Buffer expose webhooks or do we poll? If webhooks: register at deploy time. If not: cron every 15 min queries Buffer for the status of every `scheduled` publication row.

Backend:
- Probe Buffer schema for `subscriptions`/`webhooks` field (like we probed `deletePost` for Slice 3 — same pattern, ~15 min)
- If webhook: `POST /webhooks/buffer` handler, HMAC-verified. Route: `routes/webhooks.js` (new file)
- If polling: `services/bufferSync.js` module + `setInterval` job in `index.js` (unref'd, no-op in tests). Query per-scheduled-publication with `getPost(id)`, reconcile status:
  - `queued` / `scheduled` → keep as-is
  - `sent` → `status='success'`, `published_at=<Buffer's sent_at>`
  - `error` / `failed` → `status='failed'`, `error_message=<Buffer's msg>`
- Fire `publication.fired` notification (Item 1) on transition to success

Tests:
- Unit: reconciler handles each Buffer status
- Integration: mock Buffer response, poll job updates DB, notification called

#### Item 6: Draft version history (undo generation)

Sandra hits Generate again by accident. Currently she loses her manual edits. Store the last 3 generation snapshots in a JSONB column and expose "Herstel vorige versie" in the preview panel.

Backend:
- Migration `012_drafts_version_history.sql`: `ALTER TABLE drafts ADD COLUMN generation_history JSONB DEFAULT '[]'::JSONB`
- On `POST /drafts/:id/generate`: before overwriting the generated fields, push the current state to `generation_history` (cap at 3, drop the oldest)
- New route: `POST /drafts/:id/restore-version` with `{ index }` body

Frontend:
- MarketingPost + VacaturePlaatsen preview: dropdown "Vorige versies" showing up to 3 entries (timestamp + first 40 chars of the primary field). Click → restore.
- Confirmation: "Huidige tekst wordt vervangen. Doorgaan?"

### Batch C — Polish + motivation

#### Item 4: Mobile pass on Content wachtrij + MarketingPost

Verify what breaks at 375px, fix. Concrete steps:
1. Boot the app, open both pages in a mobile viewport (real device or Chrome DevTools)
2. Note every element that overflows, is untappable (< 44px), or is horizontally scrollable when it shouldn't be
3. Fix each — probably: wachtrij table becomes a card list on <768px, MarketingPost preview tabs stack, form inputs full-width

Non-goal: rewriting either page. Just make them usable on 375px.

#### Item 5: Buffer engagement stats mini dashboard

Buffer's GraphQL exposes per-post engagement (likes, comments, reach) via `post.metrics` or similar (verify at probe time). Wire that into a small "Prestaties" strip on Gepubliceerd:

Backend:
- Extend Batch B's sync to also pull metrics on the same poll (or a slower one, e.g. every 6h — engagement takes time)
- Store on the `publications` row: `metrics JSONB` column (schema TBD after schema probe)

Frontend:
- Gepubliceerd marketingpublicaties table: add columns for likes/comments/reach where available
- Sort default: by publishedAt desc (unchanged)
- No new page; keep it a strip

Migration: `013_publications_metrics.sql` — additive JSONB column.

#### Item 8: Content bibliotheek search + tags

Sandra reuses images. Currently the `MediaPicker` component lists all uploads with no filter. Add:

Backend:
- Extend `GET /media` to accept `?search=<term>&tags=<comma-list>`
- Migration `014_media_library_tags.sql`: verify `tags TEXT[]` exists (from migration 005) — it does. Just expose in the API.

Frontend:
- `MediaPicker`: add search input + tag chips (top of picker). Filter reactive.
- Upload flow: add tag input on upload (owner + recruiter can tag their own uploads).

## Success criteria

1. Sandra submits a draft. Luke receives an email within 30 seconds and can approve directly from his phone.
2. Luke approves it. Sandra sees "Goedgekeurd door Luke" in her personalized dashboard on next login + gets an email.
3. Buffer fires a scheduled post at 09:00 Thursday. Within 15 minutes, Gepubliceerd shows status='success' with the Buffer sent_at timestamp.
4. Sandra hits Generate twice. She sees "Vorige versies" with 2 entries and can restore.
5. Luke opens Content wachtrij on his phone (375px). Every action button is tappable (≥44px), no horizontal scroll.
6. After a week, Luke sees per-post engagement counts on Gepubliceerd.
7. Sandra searches "Rotterdam" in MediaPicker; only images tagged/aliased Rotterdam show.

## Alternatives considered

### A. Ship all 7 items in one bundle (recommended)

Sequenced batches A → B → C with clear dependencies (Item 1's `publication.fired` depends on Item 3 landing; Item 5 reuses Item 3's sync infra). One session, 3 deploys.

- Effort: ~5.5h CC / ~7 human-days
- Risk: medium; multiple migrations + external service integration
- Reuses: existing notifications stub, existing GraphQL client, existing migration pattern

### B. Only ship Batch A (notifications + personalized dashboard), defer trust + polish

Fastest way to test the abandonment hypothesis. If notifications alone bring users back, the tool works; if not, the problem was never coordination.

- Effort: ~75m CC / ~1.5 days
- Risk: low
- Miss: Buffer status drift keeps growing, no rollback protection

**Rejected as the plan-wide choice** but valid as an early exit if Batch A takes longer than expected or if we learn something. Include as a "kill switch" on Batch B.

### C. Skip email, build only in-app notification center

A red dot on a bell icon in the header. Cheaper, no external provider, but requires the user to be logged in — which doesn't fight abandonment.

**Rejected:** the whole point is to *pull* users back. In-app notifications only work for users already there.

## Data model changes

| Migration | Purpose |
|-----------|---------|
| `012_drafts_version_history.sql` | `drafts.generation_history JSONB DEFAULT '[]'::JSONB` |
| `013_publications_metrics.sql` | `publications.metrics JSONB` |

That's it — everything else reuses existing schema. Item 8 uses `media_library.tags` (already migrated in 005). Item 1 stores nothing (fire-and-forget). Items 2 + 4 are frontend/backend read-side only. Item 3 mutates existing `publications.status`.

## API surface (delta)

New:
- `POST /webhooks/buffer` (if webhook path, unauthenticated but HMAC-verified) OR internal cron (no route)
- `POST /drafts/:id/restore-version` (owner + recruiter-own-draft)

Extended:
- `GET /dashboard/summary` — role-aware per-user metrics
- `GET /media?search=&tags=` — new query params
- `POST /media/upload` — accept `tags` array in body

## Testing

- `notifications.test.js` — 4 events fire, transport respects NOTIFICATIONS_ENABLED, template stubs render
- `bufferSync.test.js` — status reconciler for each Buffer state
- `drafts.test.js` — generate pushes to history (cap 3), restore-version endpoint
- `dashboard.test.js` — per-role metrics query
- `media.test.js` — search + tag filter
- E2E manual QA at 375px (Item 4) documented in `docs/qa/e2e-mobile-checklist.md`

## Risks

1. **Resend deliverability from a new domain.** Resend needs a verified sending domain. If Luke doesn't have `lightpersoneelsdiensten.nl` DNS access on hand, this blocks Item 1. Mitigation: probe DNS ownership first; fallback to Postmark's trial address if needed for the first pilot week.
2. **Buffer webhook may not exist.** Same as Slice 3's `deletePost` risk — probe first (~15 min) before scoping. Polling is the fallback and works fine at Light's scale.
3. **Engagement metrics may lag.** Buffer's stats endpoint may return zero for the first few hours after publication. UX must handle "geen data (nog)" gracefully.
4. **Version history JSONB growth.** Cap 3 keeps it bounded. If Sandra generates 100 times, we still store only the last 3.
5. **Mobile pass may reveal a bigger rewrite.** If Content wachtrij's table is fundamentally desktop-shaped, a "quick fix" might turn into a rewrite. Guard with a 60-min timebox on Item 4; escalate if bigger.

## What already exists

| Sub-problem | Existing code |
|-------------|---------------|
| Notifications skeleton | `services/notifications.js` (placeholder transport) |
| GraphQL client for Buffer | `services/channels/buffer.js` `callBuffer()` |
| Media library tags column | migration `005_media_library.sql` (unexposed) |
| Owner-only middleware | `middleware/auth.js` `requireRole('owner')` |
| Dashboard summary | `routes/dashboard.js` (tool-wide currently) |
| Media picker component | `components/shared/MediaPicker.jsx` |
| Migration idempotency pattern | 006, 008, 009, 010, 011 all use `IF NOT EXISTS` / DO-blocks |
| Autosave hook | `hooks/useAutosaveDraft.js` — reuse for version history save pattern |

## Deployment

Sequenced pushes, one per batch. Between batches: verify health + spot-check the shipped items in prod. Migrations 012 + 013 applied in Supabase editor before Batches B/C code deploys.

Batch A adds `.env` keys on the VPS: `NOTIFICATIONS_ENABLED=true`, `NOTIFICATION_TRANSPORT=resend`, `RESEND_API_KEY`. Domain verification is a separate operator task, not part of the code deploy.

## What we're deferring

- **In-app notification center** (bell + red dot). Post-MVP; email covers the abandonment loop.
- **Slack/Teams integration.** Client uses email primarily; Slack is not requested.
- **Per-user notification preferences.** MVP forces email on for all events. Post-MVP.
- **Cross-post analytics** (compare LinkedIn vs Facebook engagement side-by-side). Item 5 is per-post only.
- **WordPress blog flow (Release 2 completion).** Deferred by explicit user choice at ranking.
- **Recruiter self-schedule.** Recruiters submit; owner approves + schedules. Adding recruiter-schedule doubles the approval flow's complexity.

## GSTACK REVIEW REPORT

| Review | Trigger | Runs | Status | Findings |
|--------|---------|------|--------|----------|
| CEO Review | plan-ceo-review (single-voice, Codex unavailable) | 1 | ISSUES_OPEN | 6 findings (4 critical/high). Scope cathedral for one hypothesis; premise (notifications pull users back) unvalidated; Item 5 = analytics-before-engagement; Items 4+5 duplicate Buffer's own mobile app. Recommendation: ship Batch A only, instrument, hold B/C until data. |
| Design Review | plan-ceo-review inline design lens | 1 | ISSUES_OPEN | 11 findings. 1 CRITICAL em-dash violation (fixed in plan). Missing email template spec, missing GDPR unsubscribe (Resend requires List-Unsubscribe), mobile multi-select undefined for card list, MarketingPost stacked-block scroll fatigue on 375px, tag source (free-form vs preset) undefined. |
| Eng Review | plan-ceo-review inline eng lens | 1 | ISSUES_OPEN | 12 findings. 3 HIGH: notification transactional ordering (fire after commit), notification idempotency (need notification_log table + UNIQUE index), silent Resend failure logging. MEDIUM: webhook secret rotation, Buffer bulk-query preference over per-post polling, mobile timebox not enforceable. LOW: version history race (fixable with atomic UPDATE), payload size, N+1 non-issue. |

**VERDICT:** SCOPE_OVERRIDDEN — user chose to ship full 7-item bundle over the CEO subagent's Batch-A-only recommendation. All subagent findings apply as inline fixes to individual items. Em-dash violation already fixed. Behavioral success metric still undefined and must be added before Item 1 ships (out of scope for this doc, but flagged).

NO UNRESOLVED DECISIONS

# Plan: Publish Scheduling v2 — Calendar + Recurring + Reschedule

Status: DRAFT (in autoplan review)
Branch: `agents/todos-implementation-plan`
Author: mathisvfr
Date: 2026-08-27

## Problem

Publish scheduling v1 (shipped in Batch B today) lets Luke pick a single datetime per marketing post via a `datetime-local` picker. That works for a one-off "publish Thursday at 9" but does not support the actual behavior we want: **a weekly publishing rhythm**.

Concretely, Luke's stated intent is "post on LinkedIn every Tuesday and Thursday at 9:00, Facebook every Wednesday at 12:00, Instagram every Sunday at 18:00." Doing that today requires:
- Approving each post individually
- Manually picking each datetime for each post
- No visibility into what's coming this week or next
- No way to say "reschedule to Friday" without re-approving the whole publish flow

Three of Light's five design-doc success criteria measure adoption over 2 weeks. A publishing rhythm is what turns "the tool works" into "Luke uses it every Tuesday morning" — the habit lock-in the design doc names as the biggest risk (Premise #4).

## Users

- **Luke (owner)** — the approver, and the one thinking about publishing cadence. Primary user of this feature. Sometimes approves from his phone.
- **Sandra (recruiter)** — creates vacatures. Not directly affected but sees scheduled marketing posts in Gepubliceerd.
- **Liza (recruiter)** — creates marketing posts. Wants to know "when will this go live?" without asking Luke. Secondary user.

## Goals

1. Luke can see, at a glance, what's queued for the next 7 and 14 days across LinkedIn / Facebook / Instagram.
2. Luke can save recurring templates ("LinkedIn every Tuesday at 09:00") and apply them to approved marketing posts in one click.
3. Any scheduled post can be rescheduled or cancelled from Gepubliceerd without losing history.

## Non-goals

- **Cross-account scheduling.** Only Light's one Buffer account.
- **Auto-publish without approval.** Approval remains mandatory (CLAUDE.md hard rule).
- **Auto-content-generation on a schedule.** Templates schedule *approved posts*, they don't generate content.
- **Analytics.** Stats dashboard remains a stub until Multiposter method is confirmed.

## Scope (three shippable slices)

### Slice 1 — Calendar view

A new page/tab **Gepubliceerd → Kalender** with a weekly grid:
- Columns: Ma / Di / Wo / Do / Vr / Za / Zo
- Rows: hours 06:00 → 22:00 (16 slots, one per hour)
- Each cell shows scheduled channel chips (LinkedIn / Facebook / Instagram) for that timeslot
- Clicking a chip opens the source draft in a side panel with title + preview + reschedule/cancel buttons
- Toggle: "Deze week" vs "Volgende week" vs "Beide"
- Empty-state: "Nog niets ingepland. Ga naar Marketing post om iets te plannen."

Read-only for recruiters; write actions gated to owner.

### Slice 2 — Recurring templates

New page **Merk instellingen → Publicatiepatronen** (owner only). List of named templates:

| Template | Kanaal | Weekdag(en) | Tijd | Actief? |
|----------|--------|-------------|------|---------|
| LinkedIn ochtend | LinkedIn | Di, Do | 09:00 | ✅ |
| Facebook lunch  | Facebook | Wo       | 12:00 | ✅ |
| Instagram avond | Instagram| Zo       | 18:00 | ⏸️ |

Templates never fire on their own. They provide a **quick-schedule shortcut** on approved marketing posts: when Luke opens an approved post, a "Plan in via patroon" dropdown shows all active templates that match the post's channels; picking one resolves the next matching datetime and calls the existing `/publish/:id` with `dueAt` set.

### Slice 3 — Reschedule / cancel from Gepubliceerd

Each scheduled row in the "Ingepland via Buffer" section (shipped today) gets two actions:
- **Plan wijzigen** — opens datetime picker; on submit, calls a new `POST /publications/:id/reschedule` that (a) cancels the Buffer post via mutation, (b) re-schedules with the new dueAt, (c) updates `publications.scheduled_for`
- **Annuleren** — calls a new `POST /publications/:id/cancel` that cancels the Buffer post, sets `publications.status = 'failed'`, `error_message = 'Handmatig geannuleerd'`

## Success criteria

1. From a fresh approved post, Luke can schedule via a template in ≤ 3 clicks (open post → dropdown → confirm).
2. Kalender loads in < 500ms with up to 50 scheduled items.
3. Rescheduling from Kalender or Gepubliceerd never orphans a Buffer post (cancel-then-reschedule is atomic-enough for our scale).
4. Recruiter role never sees write actions; viewer role never sees Merk instellingen at all.
5. Migration is idempotent and adds no user-visible downtime.

## Alternatives considered

### A. Frontend-only calendar (recommended)

Kalender reads from the existing `GET /publish/` (which already returns `scheduledItems`). Add templates as a new table + minimal CRUD. Reschedule/cancel are two new small routes.

- Effort: human ~3d / CC ~2.5h
- Risk: low; additive
- Reuses: existing publish route, existing scheduled_for column, existing owner-gate middleware

### B. Full scheduler service

Introduce a job queue (BullMQ or similar), track our own schedule, sync with Buffer. More resilient to Buffer downtime but ~10× the surface area.

- Effort: human ~2 weeks / CC ~1d
- Risk: high; new infra (Redis or DB queue), monitoring, retry logic
- Reuses: little

**Rejected:** overkill for one Buffer account and three users. Buffer's own reliability handles this. Revisit only if Buffer becomes flaky in production.

### C. Buffer's native templates only

Point Luke at Buffer's own Publishing Schedule UI in Buffer.com. No template UI in our tool at all.

- Effort: 0
- Risk: none
- Reuses: everything

**Rejected:** defeats the purpose of the tool. The design doc explicitly names the value of "one place to approve and schedule." Sending Luke to Buffer.com breaks the workflow.

## Data model changes

### New table `publication_patterns`

```sql
CREATE TABLE publication_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('linkedin', 'facebook', 'instagram')),
  weekdays SMALLINT[] NOT NULL,  -- ISO 1..7 (Mon..Sun)
  time_of_day TIME NOT NULL,     -- 09:00, 12:00, etc
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_publication_patterns_active ON publication_patterns (is_active) WHERE is_active;
```

### No changes to `publications` — reuses today's shipped schema

`scheduled_for` and `status='scheduled'` (both landed today in migration 008) are the ground truth.

## API surface

- `GET /patterns` (auth) → list patterns
- `POST /patterns` (owner) → create pattern
- `PUT /patterns/:id` (owner) → update
- `DELETE /patterns/:id` (owner) → delete
- `GET /patterns/:id/next-slot` (owner) → returns next matching ISO datetime
- `POST /publications/:id/reschedule` (owner) — body `{ dueAt }` — cancels + recreates in Buffer
- `POST /publications/:id/cancel` (owner) — cancels in Buffer

## Frontend surface

- New page `Kalender.jsx` (route `/kalender`) — nav item under Gepubliceerd
- New page `Publicatiepatronen.jsx` in Merk instellingen (owner-only tab)
- Extend MarketingPost preview: dropdown "Plan in via patroon" (owner + channel-matched active patterns)
- Extend Gepubliceerd Ingepland table: Plan wijzigen + Annuleren buttons

## Testing

- Backend: `patterns.test.js`, `reschedule.test.js`, `cancel.test.js`
- Pattern edge cases: weekday=Sat/Sun DST transition, empty weekdays, past time_of_day today (skip to tomorrow)
- Reschedule mid-flight: Buffer cancel returns 404 (already published) → fail closed, don't create duplicate
- Cancel of already-live post: 400 with Dutch error
- Kalender: 0 items empty state; 50 items no scroll jank

## Deployment

- Migration `010_publication_patterns.sql` (new table, safe additive)
- No downtime, no feature flag needed (owner-only UI, others don't see it)
- Ship in one push. Follow existing ship pattern: branch → main → VPS `git pull && docker compose up --build -d`

## What already exists

| Sub-problem | Existing code |
|-------------|---------------|
| Buffer scheduling | `services/channels/buffer.js` `createPost({dueAt})` — shipped today |
| scheduled_for storage | migration 008, `publications.scheduled_for` |
| Owner-only routes | `middleware/auth.js` `requireRole('owner')` |
| Cancel via Buffer | New — Buffer's GraphQL `deletePost` mutation |
| Datetime picker | `MarketingPost.jsx` — reuse the same input for Kalender |
| Media library pattern (CRUD + owner-gate) | `routes/media.js`, `routes/users.js` — mirror for patterns |

## What we're deferring

- **Recruiter self-schedule.** Recruiters can suggest a datetime in the draft form; owner still approves. Post-MVP.
- **Skip weekends / holidays.** Pattern skips can be added later; MVP treats every matching weekday equally.
- **Team notifications** when a scheduled post fires. Post-MVP; Buffer emails on success.
- **Multi-timezone.** Everything is Europe/Amsterdam. Post-MVP if the tool ever goes multi-region.

## Risks

1. **Buffer's `deletePost` mutation may not exist / may be shaped differently than `createPost`.** Concrete probe needed before Slice 3. If it doesn't exist, cancel becomes "mark as cancelled in our DB, the Buffer post still fires." Ugly. Investigate first.
2. **Timezone bugs.** `datetime-local` input returns a local wall clock. DST transitions in March/October could shift a Tuesday-09:00 post by an hour. Test in October explicitly.
3. **Race condition on reschedule.** If Buffer fires the post between our cancel and our re-create, we get a duplicate. Accept for MVP given cadence (one post per channel per day).

# TODOS

## Open

### Harden users table with RLS

**What:** Add Row Level Security to the `users` table to prevent anon key reads of `password_hash` and `email`. Currently the website's anon Supabase key has unrestricted read access to all tables without RLS.

**Why:** Security exposure discovered during blog pipeline eng review. The blog pipeline avoids this by storing author info in `form_data`, but the underlying exposure remains for any future code using the anon key.

**Context:** The `drafts` table has RLS enabled (policy `anon_read_public_vacatures`). The `users` table does not. Adding a blanket deny-all policy for anon on `users` is the simplest fix. Verify no other anon-key code paths depend on reading the users table first.

**Depends on:** Nothing. Can be done independently of the blog pipeline.

**Effort:** S -- **Priority:** P2

### Document deployment ordering for cross-repo changes

**What:** Document the required deployment sequence when changes span both the marketing tool and website repos (e.g., the blog pipeline).

**Why:** The blog pipeline requires: (1) marketing tool migration runs first (adds columns, seeds data), (2) website template changes deploy after data exists. If the website deploys first, the 9 existing blogs break because the template expects HTML from Supabase but the data isn't there yet.

**Context:** Both repos deploy via Docker Compose on the same VPS. The backend migration runs on container startup. In practice, `docker-compose up --build` rebuilds both containers, and the backend starts first (website depends on it). But this ordering is implicit, not documented.

**Depends on:** Blog pipeline implementation.

**Effort:** S -- **Priority:** P3

## Completed

### Image upload before generation ✅

**What:** Allow users to upload their own image before AI generation, not just as an override after generation. Also fix Instagram visual not being shown in preview.

**Resolved:** Optional "Eigen afbeelding" upload added to both the marketing post and vacature forms (reuses `/media/upload`, persists `image_path` before generation). The generate background task now skips Satori render when an image is already attached, for both content types. Instagram preview fixed: render now prefers the square 1080×1080 `statement` template whenever Instagram is selected, the preview image poll is decoupled from the criticus result (no manual reload needed), and `object-fit: contain` prevents cropping. LinkedIn now also receives an image via Buffer.

**Effort:** M · **Priority:** P1

### Full test coverage ✅

**What:** Write tests for the untested code paths identified in the eng review coverage diagram.

**Resolved:** Added `node --test` suites on a shared harness (`backend/test-helpers/harness.js`) covering all 27 paths: drafts routes/RBAC/edge cases (`drafts.test.js`), publish route + service partial-failure/retry (`publish.test.js`, `publication.test.js`), auth + rate limiting (`auth.test.js`, `authRateLimit.test.js`), XML feed edge cases (`feed.test.js`), and services — claude retry, buffer mapping, render validation (`services.test.js`). Also fixed the pre-existing smoke test that asserted the now-background criticus synchronously. 44 tests pass.

**Effort:** L · **Priority:** P2

### End-to-end flow verification (marketing + vacatures) ✅

**What:** Test the entire flow from creation → generation → editing → concepting → accepting → publishing for both marketing posts and vacatures.

**Resolved:** Automated integration test `backend/test/flow.test.js` drives both full chains through the real routes and asserts every status transition (vacature → `actief` → XML feed → close → gone; marketing → `approved` → publish → `published`). Manual walkthrough captured in `docs/qa/e2e-flow-checklist.md`, including status-badge / Content wachtrij / Gepubliceerd assertions and role-behaviour checks.

**Effort:** M · **Priority:** P1

### Full workflow review with end users ✅ (guide prepared)

**What:** Review the complete workflow for marketing posts, vacature plaatsing, dashboard, content wachtrij, and gepubliceerd with Luke/Sandra/Liza.

**Resolved:** Facilitation guide prepared at `docs/workflow-review-guide.md` — a structured interview script (one section per workflow) plus capture tables and a "resulting tickets" table to feed findings back here. Running the actual sessions with Luke/Sandra/Liza remains a human step.

**Effort:** M · **Priority:** P1

### Image uploads disk cleanup ✅

**What:** Add a cleanup mechanism for old rendered images in `/uploads/social/` and `/uploads/library/`.

**Resolved:** New `backend/src/services/cleanup.js` — deletes rendered/override social images older than a 90-day retention window that are not referenced by any `draft.image_path`, and removes orphaned library files (no `media_library` row); curated library images are never TTL-expired. Wired into `index.js` as an unref'd weekly job that is a no-op under tests. Covered by `backend/test/cleanup.test.js`.

**Effort:** S · **Priority:** P3

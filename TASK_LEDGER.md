# TASK_LEDGER

Shared claim log for concurrent Claude Code sessions and subagents working on
this repo. **Every task must append a row here (with `Status: in-progress` and
the files it will edit) before opening a file for edit.** No agent edits a file
listed in another agent's live in-progress row.

Statuses: `todo` | `in-progress` | `blocked` | `done` | `abandoned`.

When a task closes, update its row rather than deleting it — the history is
useful for the next agent picking up work. Move fully-completed rows below the
`## Archive` line once they're older than a week.

## Active

| # | Task | Branch / Worktree | Status | Files claimed | Owner | Notes |
|---|------|-------------------|--------|---------------|-------|-------|
| 1 | Fix regressed backend tests (`flow.test.js`, `publish.test.js`) | `fix/verification-gate-baseline` | done (2026-09-08) | `backend/test/flow.test.js`, `backend/test/publish.test.js` | claude (this session) | Root cause: both tests were fighting `index.js`'s `dotenv.config({ override: true })`. Harness comment at `backend/test-helpers/harness.js:143-144` documents the pattern — env deletes must run AFTER `setup()`. `publish.test.js` deleted `BUFFER_API_KEY` before `setup()`; `flow.test.js` never cleared `FEEDS_BASIC_AUTH_*` at all. Route code (`publish.js`, `feeds.js`) unchanged. Fix: moved the delete in publish.test.js to after `setup()`, added the same-shape delete for `FEEDS_BASIC_AUTH_USERNAME`/`FEEDS_BASIC_AUTH_PASSWORD` in flow.test.js. Verified: `cd backend && npm test` → 62/62 pass, 0 fail. |
| 2 | Fix regressed frontend lint | tbd | todo | `frontend/src/components/shared/PlatformPreview.jsx`, `frontend/src/components/shared/StatusBadge.jsx`, `frontend/src/components/shared/Toast.jsx`, `frontend/src/pages/BlogAanmaken.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/MarketingPost.jsx`, `frontend/src/pages/VacaturePlaatsen.jsx`, `frontend/vite.config.js` | — | `npm run lint` in `frontend/` reports 10 errors + 3 warnings at HEAD. Errors: two `no-useless-escape` in PlatformPreview.jsx L10, two `react-refresh/only-export-components` (StatusBadge, Toast) — move constants to a separate file, four `no-unused-vars` (BlogAanmaken StatusBadge import, Dashboard CardBody, MarketingPost handleUploadOverride), two `no-undef 'process'` in `vite.config.js` (add `/* eslint-env node */` or configure eslint for the Vite config file). Warnings: 3× `react-hooks/exhaustive-deps` (Toast, MarketingPost, VacaturePlaatsen) — refactor per hook rule or annotate. Fixing this unblocks the frontend half of the verification gate. |

## Archive

<!-- Move completed rows here once older than a week. Nothing yet. -->

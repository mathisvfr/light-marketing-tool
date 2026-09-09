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
| 2 | Fix regressed frontend lint | `fix/verification-gate-baseline` | done (2026-09-08) | `frontend/src/components/shared/PlatformPreview.jsx`, `frontend/src/components/shared/StatusBadge.jsx`, `frontend/src/components/shared/Toast.jsx`, `frontend/src/components/shared/GenerationProgress.jsx`, `frontend/src/pages/BlogAanmaken.jsx`, `frontend/src/pages/Dashboard.jsx`, `frontend/src/pages/MarketingPost.jsx`, `frontend/src/pages/VacaturePlaatsen.jsx`, `frontend/vite.config.js` | claude (this session) | Fixed 10 errors + 3 warnings + 1 cascade error that surfaced after the initial fixes. Details: PlatformPreview `[\w\-]` → `[\w-]` in hashtag regex. StatusBadge/Toast `getStatusLabel` + `useToast` kept in-file with inline `eslint-disable-next-line react-refresh/only-export-components` (moving them out would break the many callers verified via grep). Toast useEffect cleanup captures `timersRef.current` into a local `timers` const at effect-run time (react-hooks/exhaustive-deps). BlogAanmaken: dropped unused `StatusBadge` import. Dashboard: dropped `CardBody` from destructure (still exported for other consumers). MarketingPost: removed unused `handleUploadOverride` (30 lines, dead code); moved `kanalen` computation inside the `useMemo` and swapped dep to `form.kanalen`. VacaturePlaatsen: wrapped `selectedLangs` in its own `useMemo` (it's used in 6 places outside the tabs memo so can't inline). vite.config.js: added `import process from 'node:process'` (portable across eslint flat-config vs legacy). GenerationProgress: added a scoped `eslint-disable-next-line react-hooks/set-state-in-effect` on the reset-on-prop-toggle-off pattern (this rule surfaced only after the initial 13 were fixed). Verified: `cd frontend && npm run lint` → clean, `npm run build` → 555ms green. |

## Archive

<!-- Move completed rows here once older than a week. Nothing yet. -->

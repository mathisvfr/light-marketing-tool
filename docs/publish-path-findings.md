# Findings: social publish path reconciliation (Task 1)

Status: **investigation only, no code removed.** Awaiting confirmation before any deletion.

## Question

`RUNBOOK.md` requires `N8N_WEBHOOK_*` env vars *and* `BUFFER_API_KEY`.
`CLAUDE.md` says the social lane is Buffer-only with no direct integrations.
`routes/publish.js` imports `../services/n8n`, while `services/channels/buffer.js`
contains a full Buffer GraphQL `createPost`. Do Type B posts go through n8n
webhooks, through Buffer, or both?

## Traced runtime flow (Type B marketing post)

```
POST /api/publish/:id            routes/publish.js
  -> n8n.publish(draftId, type, channels, contentPayload)   services/n8n.js
       -> publishDraft(draft, channels)                     services/publication.js
            -> publishChannel(channel, draft)               services/publication.js
                 -> bufferChannel.publish(draft, channel)   services/channels/buffer.js
                      -> createPost(...) GraphQL mutation    -> https://api.buffer.com
```

Expire flow:

```
POST /api/publish/:id/expire     routes/publish.js
  -> n8n.expire(draftId, externalIds)                       services/n8n.js
       -> expirePublishedDraft(...)                          services/publication.js  (DB-only no-op)
```

### What `services/n8n.js` actually is

Despite the name, `services/n8n.js` **does not call any n8n webhook**. It is a thin
pass-through wrapper whose only job is to reshape arguments and delegate to
`services/publication.js` (`publishDraft` / `expirePublishedDraft`). There is no
`fetch` to `N8N_WEBHOOK_*` anywhere in the module.

### Where the n8n env vars are actually used

`grep` for `N8N_WEBHOOK` across the codebase:

- `routes/brand.js` reads `N8N_WEBHOOK_VACATURE` and `N8N_WEBHOOK_MARKETING`
  **only to compute boolean channel-status flags** shown in the UI. They gate no
  publishing.
- `N8N_WEBHOOK_EXPIRE` is listed in `RUNBOOK.md` but is **not read anywhere in the
  code**.
- No module ever performs an HTTP request to any n8n webhook URL.

## Conclusion

| Path | State |
|------|-------|
| Buffer (`services/channels/buffer.js`) | **LIVE.** Real GraphQL `createPost` reached via `publication.js` for `linkedin` / `facebook` / `instagram` / `facebook_instagram`. |
| WordPress (`services/channels/wordpress.js`) | Live for `wordpress` channel. |
| Indeed (`services/indeed.js`) + Google Mijn Bedrijf (in `publication.js`) | Live-ish (config-gated), out of the documented three lanes. |
| n8n webhooks | **DEAD.** No webhook is ever called. Only the module *name* and two status booleans in `brand.js` reference n8n. |

The two implementations do **not** both run. `n8n.js` is a misleadingly named
adapter in front of the Buffer/WordPress path; the actual social publish is Buffer,
exactly as `CLAUDE.md` states. `RUNBOOK.md` is the document that is out of date.

### Overlap / confusion points

1. The module name `services/n8n.js` implies a webhook integration that does not exist.
2. `RUNBOOK.md` section 1 and 7 present `N8N_WEBHOOK_*` as required and as a real
   publishing mechanism with "webhook URLs ... reachable".
3. `routes/brand.js` derives channel-status flags from the n8n env vars, so leaving
   them unset makes the UI report channels as unavailable even though Buffer is what
   actually publishes.

## Recommendation

**Standardize on Buffer and retire the n8n naming/vars.** Reasons:

- It matches `CLAUDE.md` (the stated source of truth for architecture).
- The live code already publishes through Buffer/WordPress; n8n calls nothing.
- Keeping the n8n name/vars is pure drift that misleads operators (they will set
  webhook URLs that do nothing).

### Proposed changes (NOT yet executed — need your go-ahead)

1. Rename `services/n8n.js` -> `services/publishGateway.js` (or fold its two
   functions directly into `routes/publish.js`) and update the import.
2. In `routes/brand.js`, base social channel-status on Buffer credentials
   (`getCredential('buffer')` / `BUFFER_API_KEY` + channel IDs) instead of
   `N8N_WEBHOOK_*`.
3. Remove `N8N_WEBHOOK_VACATURE/MARKETING/EXPIRE` from `RUNBOOK.md` required vars
   and the "n8n publishing issues" troubleshooting section.

### Alternative (if you actually plan to use n8n)

Keep the vars, but then `services/n8n.js` must be made to really POST to the
webhooks, and `CLAUDE.md` must be updated to document n8n as a publishing lane.
This contradicts the current architecture doc, so I do **not** recommend it.

## Note on this PR

Because Task 1 forbids deletions until confirmed, this branch does **not** remove
the n8n module or vars. To avoid the operator-confusion trap in the meantime,
`.env.example` documents `N8N_WEBHOOK_*` as **legacy / status-flag only** with a
pointer to this findings doc, and `RUNBOOK.md` is corrected for the parts that are
unambiguous drift (feed URL + migration order).

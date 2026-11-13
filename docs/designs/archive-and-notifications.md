# Archiveren en notificaties -- design spec

**Issue:** #26
**Status:** ontwerp
**Datum:** 2026-11-13

---

## Samenvatting

De Content Wachtrij toont momenteel alle drafts in `draft`, `pending_approval`,
`approved` en `rejected` status. Na weken gebruik raakt de lijst vervuild met
oude afgewezen en verlaten concepten. Deze spec voegt drie dingen toe:

1. **`archived` status** -- handmatig archiveren en de-archiveren van drafts.
2. **Auto-archive** -- oude `draft`/`rejected` items worden automatisch
   gearchiveerd na een waarschuwingsperiode.
3. **Archive-notificaties** via het bestaande in-app notificatiesysteem
   (tabel `in_app_notifications`, SSE stream, `NotificationBell`).

De Content Wachtrij verbergt gearchiveerde items standaard en biedt een toggle
om ze te tonen.

---

## DB-wijzigingen

### Migratie 031_archived_status.sql

```sql
-- 031_archived_status.sql
--
-- Voegt 'archived' toe aan de drafts status CHECK constraint en
-- een archived_at timestamp voor auto-archive tracking.

DO $$
BEGIN
  -- Drop + recreate constraint (idempotent patroon uit 004)
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'drafts_status_check'
  ) THEN
    ALTER TABLE drafts DROP CONSTRAINT drafts_status_check;
  END IF;

  ALTER TABLE drafts
    ADD CONSTRAINT drafts_status_check
    CHECK (
      status IN (
        'draft',
        'pending_approval',
        'approved',
        'actief',
        'published',
        'expired',
        'rejected',
        'archived'
      )
    );
END
$$;

-- Tijdstip waarop het item gearchiveerd is (handmatig of automatisch).
-- NULL = niet gearchiveerd. Wordt teruggezet naar NULL bij de-archiveren.
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- De vorige status voordat het item gearchiveerd werd, zodat de-archiveren
-- de draft terugzet naar de oorspronkelijke status.
ALTER TABLE drafts
  ADD COLUMN IF NOT EXISTS pre_archive_status TEXT;

-- Index voor de auto-archive cron: vindt snel oude draft/rejected items.
CREATE INDEX IF NOT EXISTS idx_drafts_stale
  ON drafts(status, updated_at)
  WHERE status IN ('draft', 'rejected');
```

Geen nieuwe tabellen nodig. Het bestaande `in_app_notifications`-schema
(migratie 025) en `notification_preferences` (migratie 027) worden hergebruikt.

---

## Backend

### Nieuwe endpoints

#### POST /api/drafts/:id/archive

Zet een draft naar `archived`. Slaat de huidige status op in
`pre_archive_status` zodat de-archiveren weet waarnaar terug te keren.

```
Rollen: owner, manager, recruiter (eigen drafts)
Body: (geen)
Response: { draft: { id, status, archived_at } }
```

Validatie:
- Alleen statussen `draft`, `pending_approval`, `approved`, `rejected` mogen
  gearchiveerd worden. `actief`, `published` en `expired` niet -- die horen
  in Gepubliceerd en mogen niet verdwijnen.
- Recruiter mag alleen eigen drafts archiveren.

Implementatie:
```js
const ARCHIVABLE = new Set(['draft', 'pending_approval', 'approved', 'rejected']);

// In de route handler:
if (!ARCHIVABLE.has(draft.status)) {
  return res.status(400).json({
    error: 'Alleen concepten, ingediende, goedgekeurde of afgewezen items kunnen gearchiveerd worden.'
  });
}

await supabase.from('drafts').update({
  pre_archive_status: draft.status,
  status: 'archived',
  archived_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}).eq('id', draft.id);
```

#### POST /api/drafts/:id/unarchive

Zet de draft terug naar `pre_archive_status` (of `draft` als die ontbreekt).

```
Rollen: owner, manager, recruiter (eigen drafts)
Body: (geen)
Response: { draft: { id, status } }
```

Validatie:
- Alleen `archived` status mag ge-de-archiveerd worden.

Implementatie:
```js
const restoreStatus = draft.pre_archive_status || 'draft';

await supabase.from('drafts').update({
  status: restoreStatus,
  pre_archive_status: null,
  archived_at: null,
  updated_at: new Date().toISOString(),
}).eq('id', draft.id);
```

#### POST /api/drafts/bulk-archive

Bulkversie. Zelfde patroon als `bulk-approve`/`bulk-reject`.

```
Rollen: owner, manager
Body: { ids: string[] }
Response: { succeededCount, skippedCount, succeeded, skipped }
```

#### POST /api/drafts/bulk-unarchive

Bulkversie van de-archiveren.

```
Rollen: owner, manager
Body: { ids: string[] }
Response: { succeededCount, skippedCount, succeeded, skipped }
```

### Wijziging GET /api/drafts

De huidige lijst-query filtert standaard op
`['draft', 'pending_approval', 'approved', 'rejected']`. Voeg een
`includeArchived` query-parameter toe:

```
GET /api/drafts?includeArchived=true   -- toont ook archived
GET /api/drafts?status=archived        -- toont alleen archived
```

Zonder `includeArchived=true` en zonder expliciete `status=archived` filter
worden gearchiveerde items uitgesloten uit de default-set. Dit houdt de
wachtrij standaard schoon.

### Auto-archive cron job

Nieuwe service: `backend/src/services/autoArchive.js`

Draait als `setInterval` (zelfde patroon als `cleanup.js` en
`bufferSync.js`). Interval: eenmaal per dag (24u). Timer wordt `.unref()`'d
en is no-op onder `NODE_ENV=test`.

**Logica (dagelijks):**

```
1. Vind alle drafts met:
   - status IN ('draft', 'rejected')
   - updated_at < NOW() - INTERVAL '14 days'
   - updated_at >= NOW() - INTERVAL '21 days'
   --> Stuur waarschuwingsnotificatie (als niet al gestuurd)

2. Vind alle drafts met:
   - status IN ('draft', 'rejected')
   - updated_at < NOW() - INTERVAL '21 days'
   --> Archiveer automatisch + stuur archiveer-notificatie
```

**Waarschuwingsnotificatie (dag 14-21):**
- Event type: `draft.archive_warning`
- Naar: `created_by` gebruiker
- Tekst: "Je concept '[titel]' wordt over een week automatisch gearchiveerd
  als je er niets mee doet."
- Link: deep-link naar de draft in de wachtrij
- Idempotentie: gebruik `in_app_notifications` -- check of er al een
  `draft.archive_warning` notificatie bestaat voor deze draft + user
  in de afgelopen 7 dagen. Zo ja, skip.

**Auto-archiveer-notificatie (dag 21+):**
- Event type: `draft.auto_archived`
- Naar: `created_by` gebruiker
- Tekst: "Je concept '[titel]' is automatisch gearchiveerd. Je kunt het
  altijd terugzetten vanuit het archief."
- Link: deep-link naar wachtrij met `?status=archived`

**Implementatie-schets:**

```js
const DAY_MS = 24 * 60 * 60 * 1000;
const WARN_AFTER_DAYS = 14;
const ARCHIVE_AFTER_DAYS = 21;

async function runAutoArchive() {
  const now = new Date();
  const warnCutoff = new Date(now - WARN_AFTER_DAYS * DAY_MS).toISOString();
  const archiveCutoff = new Date(now - ARCHIVE_AFTER_DAYS * DAY_MS).toISOString();

  // 1. Auto-archiveer (21+ dagen)
  const { data: toArchive } = await supabase
    .from('drafts')
    .select('id, status, form_data, created_by')
    .in('status', ['draft', 'rejected'])
    .lt('updated_at', archiveCutoff);

  for (const draft of (toArchive || [])) {
    await supabase.from('drafts').update({
      pre_archive_status: draft.status,
      status: 'archived',
      archived_at: now.toISOString(),
      updated_at: now.toISOString(),
    }).eq('id', draft.id);

    // In-app notificatie
    if (draft.created_by) {
      await supabase.from('in_app_notifications').insert({
        user_id: draft.created_by,
        type: 'draft.auto_archived',
        title: `Automatisch gearchiveerd: ${getDraftTitle(draft.form_data)}`,
        message: 'Dit concept is automatisch gearchiveerd omdat er 3 weken niets mee is gedaan. Je kunt het terugzetten vanuit het archief.',
        link: '/content-wachtrij?status=archived',
      });
    }
  }

  // 2. Waarschuwingen (14-21 dagen)
  const { data: toWarn } = await supabase
    .from('drafts')
    .select('id, status, form_data, created_by')
    .in('status', ['draft', 'rejected'])
    .lt('updated_at', warnCutoff)
    .gte('updated_at', archiveCutoff);

  for (const draft of (toWarn || [])) {
    if (!draft.created_by) continue;

    // Idempotentie: skip als al gewaarschuwd in de afgelopen 7 dagen
    const recentCutoff = new Date(now - 7 * DAY_MS).toISOString();
    const { count } = await supabase
      .from('in_app_notifications')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', draft.created_by)
      .eq('type', 'draft.archive_warning')
      .like('link', `%draft=${draft.id}%`)
      .gt('created_at', recentCutoff);

    if ((count || 0) > 0) continue;

    await supabase.from('in_app_notifications').insert({
      user_id: draft.created_by,
      type: 'draft.archive_warning',
      title: `Wordt binnenkort gearchiveerd: ${getDraftTitle(draft.form_data)}`,
      message: 'Dit concept wordt over een week automatisch gearchiveerd als je er niets mee doet.',
      link: `/content-wachtrij?draft=${draft.id}`,
    });
  }
}

function startAutoArchiveSchedule() {
  if (process.env.NODE_ENV === 'test') return null;

  // Eerste run na 1 minuut (wacht tot DB-connectie stabiel is)
  setTimeout(() => {
    runAutoArchive().catch((err) =>
      console.error('[auto-archive] eerste run mislukt:', err?.message || err)
    );
  }, 60_000);

  const timer = setInterval(() => {
    runAutoArchive().catch((err) =>
      console.error('[auto-archive] mislukt:', err?.message || err)
    );
  }, DAY_MS);

  if (typeof timer.unref === 'function') timer.unref();
  return timer;
}
```

Registreren in `index.js` naast de bestaande `startCleanupSchedule()` call.

---

## Notificatiesysteem

Het notificatiesysteem bestaat al volledig:

| Component | Status | Wijziging nodig |
|-----------|--------|-----------------|
| `in_app_notifications` tabel | Bestaat (025) | Nee |
| `notification_preferences` tabel | Bestaat (027) | Optioneel: kolom `in_app_archive_warnings` toevoegen |
| `GET /api/notifications` | Bestaat | Nee |
| `GET /api/notifications/unread-count` | Bestaat | Nee |
| `GET /api/notifications/stream` (SSE) | Bestaat | Nee |
| `NotificationBell` component | Bestaat | Nee |
| `notify()` / `notifyAfterCommit()` | Bestaat | Nee (auto-archive schrijft direct naar `in_app_notifications`) |

De auto-archive cron schrijft direct in `in_app_notifications` in plaats van
via `notify()`, omdat:
- Er geen `draft_id` context nodig is voor de `notification_log` (geen
  email-transport voor archive warnings in v1).
- De cron draait buiten een request-context, dus `notifyAfterCommit` is niet
  van toepassing.
- Simpeler: geen email voor archive-meldingen (zou spam zijn).

**Later optioneel:** voeg `email_archive_warning` kolom toe aan
`notification_preferences` als gebruikers email-notificaties willen voor
archive-waarschuwingen.

---

## Frontend

### Content Wachtrij UI-wijzigingen

#### 1. Archief-toggle

Voeg een toggle/checkbox toe boven de filtertoolbar:

```jsx
<label className="queue-archive-toggle">
  <input
    type="checkbox"
    checked={showArchived}
    onChange={(e) => setShowArchived(e.target.checked)}
  />
  Toon gearchiveerd ({archivedCount})
</label>
```

Wanneer `showArchived` is `true`, wordt `includeArchived=true` meegegeven aan
de API. Het aantal gearchiveerde items (`archivedCount`) komt uit een aparte
lightweight count-query of uit de response metadata.

#### 2. Status-filter uitbreiden

Voeg "Gearchiveerd" toe aan het status-filter dropdown:

```jsx
<option value="archived">Gearchiveerd</option>
```

#### 3. Archiveer-actie per rij

In de actie-knoppen van elke rij (voor owner/manager en recruiter-eigen):

```jsx
{ARCHIVABLE_STATUSES.includes(draft.status) && (
  <button onClick={() => handleArchive(draft.id)}>
    Archiveren
  </button>
)}

{draft.status === 'archived' && (
  <button onClick={() => handleUnarchive(draft.id)}>
    Terugzetten
  </button>
)}
```

Geen bevestigingsdialoog nodig -- archiveren is omkeerbaar (anders dan
verwijderen).

#### 4. Bulk-archiveer actie

In de bulk-actiebalk, wanneer `selectionStatus` gelijk is aan `draft` of
`rejected`:

```jsx
{['draft', 'rejected'].includes(selectionStatus) && (
  <button onClick={handleBulkArchive} disabled={isMutating}>
    Archiveren
  </button>
)}
```

En wanneer `selectionStatus === 'archived'`:

```jsx
{selectionStatus === 'archived' && (
  <button onClick={handleBulkUnarchive} disabled={isMutating}>
    Terugzetten
  </button>
)}
```

#### 5. StatusBadge uitbreiden

Voeg `archived` toe aan de fallback-meta en het meta-endpoint:

```js
// StatusBadge.jsx FALLBACK_META
archived: { label: 'Gearchiveerd', tone: 'muted' },

// meta.js LIFECYCLE_STATUSES
archived: { label: 'Gearchiveerd', tone: 'muted', order: 8 },

// LIFECYCLE_ICONS
archived: '⊘',
```

#### 6. Visuele behandeling gearchiveerde rijen

Gearchiveerde rijen krijgen verminderde opacity (`opacity: 0.5`) en een
subtiel gestreept achtergrondpatroon, vergelijkbaar met de huidige
`_optimistic`-stijl maar permanenter:

```css
.queue-table tr.archived-row {
  opacity: 0.55;
}
```

---

## Status-machine

Toegestane transities naar en vanuit `archived`:

```
draft            --> archived    (handmatig + auto na 21 dagen)
pending_approval --> archived    (handmatig)
approved         --> archived    (handmatig)
rejected         --> archived    (handmatig + auto na 21 dagen)

archived         --> draft              (de-archiveer, als pre_archive_status = draft)
archived         --> pending_approval   (de-archiveer, als pre_archive_status = pending_approval)
archived         --> approved           (de-archiveer, als pre_archive_status = approved)
archived         --> rejected           (de-archiveer, als pre_archive_status = rejected)
```

**Niet archiveerbaar:**
- `actief` -- vacature staat live in de XML feed. Sluiten (-> expired) moet
  eerst.
- `published` -- marketingpost is live. Geen reden om te archiveren.
- `expired` -- al afgelopen, staat in Gepubliceerd-tab.

**Gearchiveerde items kunnen:**
- Ge-de-archiveerd worden (terug naar vorige status)
- Permanent verwijderd worden (bestaande delete-functionaliteit)
- Gedupliceerd worden (bestaande duplicate-functionaliteit)

**Gearchiveerde items kunnen NIET:**
- Goedgekeurd, afgewezen of gepubliceerd worden. Eerst de-archiveren.

---

## Migratiepad

### Fase 1 (deze PR)

1. Draai migratie `031_archived_status.sql`.
2. Backend: nieuwe endpoints (archive, unarchive, bulk variants).
3. Backend: wijzig `GET /api/drafts` default-filter.
4. Backend: `autoArchive.js` service + registratie in `index.js`.
5. Frontend: StatusBadge + meta.js uitbreiden.
6. Frontend: archief-toggle en knoppen in ContentWachtrij.
7. Backend: voeg `archived` toe aan `meta.js` LIFECYCLE_STATUSES.
8. Tests: unit tests voor archive/unarchive endpoints, auto-archive logica.

### Fase 2 (optioneel, later)

- Email-notificaties voor archive-waarschuwingen (voeg preference-kolom toe).
- Dashboard-widget: "X concepten worden binnenkort gearchiveerd".
- Archief als aparte pagina i.p.v. toggle (als de lijst te lang wordt).

### Bestaande data

Er zijn geen bestaande `archived` drafts, dus de migratie is puur additief.
Oude `draft`/`rejected` items ouder dan 21 dagen worden bij de eerste cron-run
automatisch gearchiveerd. Dit is gewenst gedrag -- het is precies het doel van
de feature.

**Eerste-run notificatiestorm voorkomen:** als de eerste auto-archive run meer
dan 5 items archiveert, stuur dan één gebundelde notificatie ("X oude concepten
zijn automatisch gearchiveerd") in plaats van een notificatie per item. Dit
voorkomt dat de NotificationBell opeens 50+ ongelezen meldingen toont.

### Activity log entries

Voeg `draft.archived` en `draft.unarchived` toe aan de activity log, consistent
met de bestaande events (`draft.approved`, `draft.rejected`, `draft.published`,
etc.). Update `formatActivityTitle()` in `dashboard.js` met nieuwe case
branches. Dit geldt voor zowel handmatig als automatisch archiveren.

### Gedeelde `getDraftTitle()` utility

De functie `getDraftTitle(form_data)` bestaat al in `dashboard.js` en
`drafts.js`. Extraheer naar `backend/src/services/draftUtils.js` en importeer
vanuit alle drie de locaties (dashboard, drafts, autoArchive) om duplicatie te
voorkomen.

---

## Open vragen

1. **Moeten `pending_approval` items ook auto-archiveren?** Het huidige
   ontwerp archiveert alleen `draft` en `rejected` automatisch.
   `pending_approval` items wachten actief op een review -- auto-archiveren
   zou ze onzichtbaar maken voor de owner. Voorstel: nee, niet automatisch.
   De owner kan ze handmatig archiveren als ze verouderd zijn.

2. **Archief-retentie?** Moeten gearchiveerde items ooit permanent verwijderd
   worden? Voorstel: nee in v1. Ze kosten weinig opslagruimte (geen images,
   alleen tekst/JSON). De owner kan ze handmatig verwijderen.

3. **Notification preference granulariteit?** Moet er een aparte toggle komen
   voor archive-waarschuwingen in de notificatie-voorkeuren? Voorstel: v1
   volgt de bestaande `in_app_enabled` master-toggle. Aparte toggle alleen
   toevoegen als gebruikers erom vragen.

4. **De-archiveren naar `pending_approval`?** Als een recruiter een concept
   de-archiveert dat eerder `pending_approval` was, komt het terug in de
   goedkeuringswachtrij. Is dat gewenst of moet het terug naar `draft`?
   Voorstel: terug naar de oorspronkelijke status (via `pre_archive_status`).
   De recruiter kan het daarna zelf terugtrekken als dat nodig is.

const express = require('express');

const router = express.Router();

// Bron-van-waarheid voor status-labels + tones. Frontend haalt dit op zodat
// STATUS_META niet per pagina/consumer opnieuw gemapt wordt. Wanneer we een
// status hernoemen of een nieuwe toevoegen, hoeft alleen deze file te muteren
// en refetcht elke consumer via TanStack Query.
//
// `tone` correspondeert 1-op-1 met de CSS-class-suffix in
// `frontend/src/components/shared/status-strip.css`
// (bijv. tone='neutral' → `.status-badge-neutral`).
//
// `icon` blijft in de frontend-component om zo lettertype-onafhankelijk te
// blijven — dit endpoint is puur data (label + tone + optionele volgorde).

const LIFECYCLE_STATUSES = {
  draft:            { label: 'Concept',     tone: 'neutral',   order: 1 },
  pending_approval: { label: 'Ingediend',   tone: 'attention', order: 2 },
  approved:         { label: 'Goedgekeurd', tone: 'success',   order: 3 },
  actief:           { label: 'Actief',      tone: 'live',      order: 4 },
  published:        { label: 'Gepubliceerd', tone: 'live',     order: 5 },
  expired:          { label: 'Verlopen',    tone: 'muted',     order: 6 },
  rejected:         { label: 'Afgewezen',   tone: 'danger',    order: 7 },
};

// Kanaal-publicatiestatus (Buffer + eigen website). Separate namespace omdat
// de semantiek anders is dan draft-lifecycle: dit gaat over de status van één
// publicatiepoging naar één kanaal.
const CHANNEL_STATUSES = {
  scheduled: { label: 'Ingepland',   tone: 'attention', order: 1 },
  success:   { label: 'Geplaatst',   tone: 'success',   order: 2 },
  failed:    { label: 'Mislukt',     tone: 'danger',    order: 3 },
  pending:   { label: 'Bezig',       tone: 'neutral',   order: 4 },
  cancelled: { label: 'Geannuleerd', tone: 'muted',     order: 5 },
};

// Integratie-connectiviteit (Buffer/website-koppelingen). Losstaand
// omdat het geen lifecycle en geen kanaal-actie is, maar systeem-koppeling.
const INTEGRATION_STATUSES = {
  connected:    { label: 'Gekoppeld',    tone: 'success',   order: 1 },
  expiring:     { label: 'Verloopt',     tone: 'attention', order: 2 },
  disconnected: { label: 'Niet gekoppeld', tone: 'muted',   order: 3 },
  error:        { label: 'Fout',         tone: 'danger',    order: 4 },
};

// Gebruikersrollen. Frontend Header.jsx toont ze als badge; deze catalogus
// vervangt de hardcoded ROLE_BADGE-map inline aldaar.
const ROLES = {
  owner:     { label: 'Eigenaar',   tone: 'live'    },
  recruiter: { label: 'Recruiter',  tone: 'neutral' },
  viewer:    { label: 'Lezer',      tone: 'muted'   },
};

// GET /api/meta/statuses — alle catalogi in één response. Frontend cachet
// dit via TanStack Query (staleTime: Infinity is prima; hernoemen vereist
// een deploy).
router.get('/statuses', (_req, res) => {
  return res.json({
    lifecycle: LIFECYCLE_STATUSES,
    channels: CHANNEL_STATUSES,
    integrations: INTEGRATION_STATUSES,
    roles: ROLES,
  });
});

module.exports = router;

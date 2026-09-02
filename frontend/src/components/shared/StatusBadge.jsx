import useStatusMeta from '../../hooks/useStatusMeta';

// Draft-lifecycle pill. Voor kanaal-status gebruik <ChannelStatus>, voor
// gebruikers-rollen <RoleBadge>. Alle drie delen dezelfde CSS-base
// (.pill-base + .pill-tone-*).
//
// Meta (label + tone) komt van /api/meta/statuses via useStatusMeta. Bij
// loading of unknown status vallen we terug op FALLBACK_META zodat de UI
// nooit leeg blijft — hoogstens verouderde labels tijdens de eerste render.

const FALLBACK_META = {
  draft:            { label: 'Concept',     tone: 'neutral' },
  pending_approval: { label: 'Ingediend',   tone: 'attention' },
  approved:         { label: 'Goedgekeurd', tone: 'success' },
  actief:           { label: 'Actief',      tone: 'live' },
  published:        { label: 'Gepubliceerd', tone: 'live' },
  expired:          { label: 'Verlopen',    tone: 'muted' },
  rejected:         { label: 'Afgewezen',   tone: 'danger' },
};

// Icoontjes blijven in de component (zijn puur UI, hoeven niet uit de
// backend). Non-color-only per a11y-baseline.
const LIFECYCLE_ICONS = {
  draft: '○',
  pending_approval: '◑',
  approved: '✓',
  actief: '●',
  published: '●',
  expired: '◌',
  rejected: '✕',
};

export default function StatusBadge({ status, className = '' }) {
  const { data } = useStatusMeta();
  const serverMeta = data?.lifecycle?.[status];
  const meta = serverMeta || FALLBACK_META[status] || { label: status, tone: 'neutral' };
  const icon = LIFECYCLE_ICONS[status] || '';

  return (
    <span
      className={`pill-base pill-tone-${meta.tone} ${className}`.trim()}
      aria-label={`Status: ${meta.label}`}
    >
      {icon ? (
        <span className="pill-base-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      {meta.label}
    </span>
  );
}

export function getStatusLabel(status) {
  return (FALLBACK_META[status] || { label: status }).label;
}

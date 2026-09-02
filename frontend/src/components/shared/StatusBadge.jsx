// Gedeelde status-pill voor draft-statussen. Icon + tekst i.p.v. alleen kleur
// zodat kleurenblinden en screen-readers dezelfde info krijgen.
const STATUS_META = {
  draft: { label: 'Concept', icon: '○', tone: 'neutral' },
  pending_approval: { label: 'Ingediend', icon: '◑', tone: 'attention' },
  approved: { label: 'Goedgekeurd', icon: '✓', tone: 'success' },
  actief: { label: 'Actief', icon: '●', tone: 'live' },
  published: { label: 'Gepubliceerd', icon: '●', tone: 'live' },
  expired: { label: 'Verlopen', icon: '◌', tone: 'muted' },
  rejected: { label: 'Afgewezen', icon: '✕', tone: 'danger' },
};

export default function StatusBadge({ status, className = '' }) {
  const meta = STATUS_META[status] || { label: status, icon: '', tone: 'neutral' };
  return (
    <span
      className={`status-badge status-badge-${meta.tone} ${className}`.trim()}
      aria-label={`Status: ${meta.label}`}
    >
      <span className="status-badge-icon" aria-hidden="true">
        {meta.icon}
      </span>
      {meta.label}
    </span>
  );
}

export function getStatusLabel(status) {
  return (STATUS_META[status] || { label: status }).label;
}

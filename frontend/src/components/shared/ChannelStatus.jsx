import useStatusMeta from '../../hooks/useStatusMeta';

// Publicatie-status van één kanaal-actie (Buffer post naar LinkedIn etc.) OF
// integratie-connectiviteit (Buffer-koppeling). Semantisch verschillend maar
// visueel dezelfde pill; namespace-prop bepaalt welke catalogus wordt gelezen.
//
// - namespace="channels" (default) — scheduled/success/failed/pending/cancelled
// - namespace="integrations"       — connected/expiring/disconnected/error
//
// `compact` variant toont alleen de tone-dot + aria-label — voor tabellen waar
// tekst-labels te veel ruimte kosten.

const FALLBACK_META = {
  channels: {
    scheduled: { label: 'Ingepland',   tone: 'attention' },
    success:   { label: 'Geplaatst',   tone: 'success' },
    failed:    { label: 'Mislukt',     tone: 'danger' },
    pending:   { label: 'Bezig',       tone: 'neutral' },
    cancelled: { label: 'Geannuleerd', tone: 'muted' },
  },
  integrations: {
    connected:    { label: 'Gekoppeld',     tone: 'success' },
    expiring:     { label: 'Verloopt',      tone: 'attention' },
    disconnected: { label: 'Niet gekoppeld', tone: 'muted' },
    error:        { label: 'Fout',          tone: 'danger' },
  },
};

const ICONS = {
  scheduled: '⏱',
  success: '●',
  failed: '✕',
  pending: '⟳',
  cancelled: '◌',
  connected: '●',
  expiring: '⚠',
  disconnected: '○',
  error: '✕',
};

export default function ChannelStatus({ status, namespace = 'channels', compact = false, className = '' }) {
  const { data } = useStatusMeta();
  const serverMeta = data?.[namespace]?.[status];
  const meta = serverMeta || FALLBACK_META[namespace]?.[status] || { label: status, tone: 'neutral' };
  const icon = ICONS[status] || '';

  if (compact) {
    return (
      <span
        className={`pill-dot pill-tone-${meta.tone} ${className}`.trim()}
        aria-label={meta.label}
        title={meta.label}
      />
    );
  }

  return (
    <span
      className={`pill-base pill-tone-${meta.tone} ${className}`.trim()}
      aria-label={meta.label}
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

import useStatusMeta from '../../hooks/useStatusMeta';

// Gebruikers-rol pill (owner/recruiter/viewer). Semantisch een identiteit,
// geen status of health — vandaar aparte component en aparte aria-label
// ("Rol:" prefix). Deelt CSS-base met StatusBadge/ChannelStatus.

const FALLBACK_META = {
  owner:     { label: 'Eigenaar',  tone: 'live' },
  recruiter: { label: 'Recruiter', tone: 'neutral' },
  viewer:    { label: 'Lezer',     tone: 'muted' },
};

export default function RoleBadge({ role, className = '' }) {
  const { data } = useStatusMeta();
  const serverMeta = data?.roles?.[role];
  const meta = serverMeta || FALLBACK_META[role] || { label: role, tone: 'neutral' };

  return (
    <span
      className={`pill-base pill-tone-${meta.tone} ${className}`.trim()}
      aria-label={`Rol: ${meta.label}`}
    >
      {meta.label}
    </span>
  );
}

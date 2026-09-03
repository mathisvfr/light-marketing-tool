// Content type-pill: vacature (red) vs marketing-post (muted grey). Deelt
// pill-base CSS met StatusBadge/ChannelStatus/RoleBadge zodat de tool één
// visuele pill-taal spreekt.

export default function TypeBadge({ type, className = '' }) {
  const isMarketing = type === 'marketing-post' || type === 'marketing';
  const tone = isMarketing ? 'muted' : 'danger';
  const label = isMarketing ? 'Marketing' : 'Vacature';
  return (
    <span className={`pill-base pill-tone-${tone} ${className}`.trim()}>
      {label}
    </span>
  );
}

import React from 'react';

function TagIcon({ name, size = 18, color, onClick, style = {} }) {
  if (!name) return null;
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current;
    if (!el || !window.lucide) return;
    el.innerHTML = '<i data-lucide="' + name + '"></i>';
    try { window.lucide.createIcons(); } catch (e) { /* noop */ }
    const svg = el.querySelector('svg');
    if (svg) { svg.setAttribute('width', size); svg.setAttribute('height', size); }
  }, [name, size]);
  return React.createElement('span', {
    ref, onClick, 'aria-hidden': true,
    style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color, flex: 'none', ...style },
  });
}

/**
 * Light Personeelsdiensten — Tag
 * Neutral filter/keyword chip. Optional selected + removable states.
 */
export function Tag({ selected = false, removable = false, onRemove, children, onClick, style = {} }) {
  const [hover, setHover] = React.useState(false);
  return (
    <span
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 13.5,
        padding: '6px 12px', borderRadius: 'var(--radius-pill)',
        border: '1px solid',
        borderColor: selected ? 'var(--light-red)' : (hover ? 'var(--border-color-strong, var(--color-border-strong))' : 'var(--color-border)'),
        background: selected ? 'var(--light-red)' : (hover ? 'var(--grey-50)' : 'var(--color-bg)'),
        color: selected ? '#fff' : 'var(--color-text)',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all var(--dur-fast) var(--ease-out)',
        ...style,
      }}
    >
      {children}
      {removable && (
        <TagIcon
          name="x"
          size={14}
          onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }}
          style={{ cursor: 'pointer', opacity: 0.8 }}
        />
      )}
    </span>
  );
}

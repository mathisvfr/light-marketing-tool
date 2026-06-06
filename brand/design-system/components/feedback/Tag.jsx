import React from 'react';

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
        <i
          data-lucide="x"
          onClick={(e) => { e.stopPropagation(); onRemove && onRemove(); }}
          style={{ width: 14, height: 14, cursor: 'pointer', opacity: 0.8 }}
        />
      )}
    </span>
  );
}

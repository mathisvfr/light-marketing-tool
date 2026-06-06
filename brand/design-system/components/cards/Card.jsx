import React from 'react';

/**
 * Light Personeelsdiensten — Card
 * White surface, 1px border, soft shadow that lifts on hover and gains a
 * faint red border. Optional image header with a subtle zoom on hover.
 */
export function Card({
  image = null,
  imageAlt = '',
  imageHeight = 180,
  interactive = false,
  padding = 24,
  children,
  style = {},
  onClick,
}) {
  const [hover, setHover] = React.useState(false);
  const active = interactive && hover;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: 'var(--color-bg)',
        border: '1px solid',
        borderColor: active ? 'var(--light-red-300)' : 'var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: active ? 'var(--shadow-md)' : 'var(--shadow-xs)',
        overflow: 'hidden',
        cursor: interactive ? 'pointer' : 'default',
        transition: 'box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)',
        transform: active ? 'translateY(-2px)' : 'none',
        ...style,
      }}
    >
      {image && (
        <div style={{ height: imageHeight, overflow: 'hidden' }}>
          <img
            src={image}
            alt={imageAlt}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              transition: 'transform var(--dur-slow) var(--ease-out)',
              transform: active ? 'scale(1.04)' : 'scale(1)',
            }}
          />
        </div>
      )}
      <div style={{ padding }}>{children}</div>
    </div>
  );
}

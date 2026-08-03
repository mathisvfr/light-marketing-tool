import React from 'react';

/**
 * Safe Lucide icon for React: renders a <span> wrapper that React manages,
 * and injects the Lucide <svg> imperatively as the span's innerHTML. Because
 * React never manages the swapped node, re-renders (hover/press) can't trigger
 * the "removeChild: node is not a child" crash that global lucide.createIcons()
 * causes when it replaces React-rendered <i data-lucide> elements.
 */
function BtnIcon({ name, size = 18, color, style = {} }) {
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
    ref,
    'aria-hidden': true,
    style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color, flex: 'none', ...style },
  });
}

/**
 * Light Personeelsdiensten — Button
 * Industrial, confident CTAs. Primary = brand red; the "notch" variant
 * applies the logo's cut-corner silhouette.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  notch = false,
  icon = null,
  iconRight = null,
  disabled = false,
  type = 'button',
  onClick,
  children,
  style = {},
}) {
  const [hover, setHover] = React.useState(false);
  const [press, setPress] = React.useState(false);

  const sizes = {
    sm: { fontSize: 13, padding: '8px 14px', gap: 6, icon: 16 },
    md: { fontSize: 15, padding: '12px 22px', gap: 8, icon: 18 },
    lg: { fontSize: 17, padding: '15px 30px', gap: 10, icon: 20 },
  };
  const s = sizes[size] || sizes.md;

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: s.fontSize,
    letterSpacing: '0.005em',
    padding: s.padding,
    border: '2px solid transparent',
    borderRadius: notch ? 0 : 'var(--radius-md)',
    clipPath: notch ? 'var(--clip-notch)' : 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
    lineHeight: 1.1,
    textDecoration: 'none',
    whiteSpace: 'nowrap',
  };

  const fill = (rest, hov, prs) => press ? prs : (hover ? hov : rest);

  const variants = {
    primary: {
      background: fill('var(--color-primary)', 'var(--color-primary-hover)', 'var(--color-primary-press)'),
      color: 'var(--color-on-primary)',
      boxShadow: hover && !disabled ? 'var(--shadow-red)' : 'none',
    },
    secondary: {
      background: fill('var(--grey-800)', 'var(--grey-900)', '#000'),
      color: '#fff',
    },
    outline: {
      background: hover ? 'var(--color-primary-soft)' : 'transparent',
      color: 'var(--color-primary)',
      borderColor: 'var(--color-primary)',
    },
    ghost: {
      background: hover ? 'var(--grey-100)' : 'transparent',
      color: 'var(--color-text)',
    },
  };

  const Icon = ({ name, sz }) =>
    name ? <BtnIcon name={name} size={sz} /> : null;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPress(false); }}
      onMouseDown={() => setPress(true)}
      onMouseUp={() => setPress(false)}
      style={{ ...base, ...(variants[variant] || variants.primary), ...style }}
    >
      <Icon name={icon} sz={s.icon} />
      {children}
      <Icon name={iconRight} sz={s.icon} />
    </button>
  );
}

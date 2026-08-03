import React from 'react';

function BadgeIcon({ name, size = 18, color, style = {} }) {
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
    ref, 'aria-hidden': true,
    style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, color, flex: 'none', ...style },
  });
}

/**
 * Light Personeelsdiensten — Badge
 * Small status pill. "tone" sets the colour; "solid" fills it.
 */
export function Badge({ tone = 'red', solid = false, icon = null, children, style = {} }) {
  const tones = {
    red:     { fg: 'var(--light-red)',  bg: 'var(--light-red-50)',  solidBg: 'var(--light-red)' },
    grey:    { fg: 'var(--grey-700)',   bg: 'var(--grey-100)',      solidBg: 'var(--grey-700)' },
    green:   { fg: 'var(--green)',      bg: '#e7f3ec',              solidBg: 'var(--green)' },
    amber:   { fg: 'var(--amber)',      bg: '#f7eed9',              solidBg: 'var(--amber)' },
    blue:    { fg: 'var(--blue)',       bg: '#e4eef5',              solidBg: 'var(--blue)' },
    dark:    { fg: '#fff',              bg: 'var(--grey-800)',      solidBg: 'var(--grey-800)' },
  };
  const t = tones[tone] || tones.red;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11.5,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: 'var(--radius-pill)',
      color: solid ? '#fff' : t.fg,
      background: solid ? t.solidBg : t.bg,
      whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <BadgeIcon name={icon} size={13} />}
      {children}
    </span>
  );
}

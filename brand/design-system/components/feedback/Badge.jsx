import React from 'react';

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
      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11.5,
      letterSpacing: '0.05em', textTransform: 'uppercase',
      padding: '4px 10px', borderRadius: 'var(--radius-pill)',
      color: solid ? '#fff' : t.fg,
      background: solid ? t.solidBg : t.bg,
      whiteSpace: 'nowrap', ...style,
    }}>
      {icon && <i data-lucide={icon} style={{ width: 13, height: 13 }} />}
      {children}
    </span>
  );
}

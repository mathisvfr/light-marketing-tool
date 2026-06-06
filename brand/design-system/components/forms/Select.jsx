import React from 'react';

/**
 * Light Personeelsdiensten — Select (dropdown)
 * Native select styled to match Input, with a Lucide chevron.
 */
export function Select({ label, options = [], value, defaultValue, onChange, required = false, id, style = {} }) {
  const [focus, setFocus] = React.useState(false);
  const selId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const norm = options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label htmlFor={selId} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5, color: 'var(--color-text)' }}>
          {label}{required && <span style={{ color: 'var(--light-red)' }}> *</span>}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        <select
          id={selId}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            appearance: 'none',
            WebkitAppearance: 'none',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--color-text)',
            padding: '11px 38px 11px 14px',
            background: 'var(--color-bg)',
            border: `1.5px solid ${focus ? 'var(--light-red)' : 'var(--color-border-strong)'}`,
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
            boxShadow: focus ? '0 0 0 3px var(--color-focus-ring)' : 'none',
            cursor: 'pointer',
            transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
          }}
        >
          {norm.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <i data-lucide="chevron-down" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--color-text-subtle)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

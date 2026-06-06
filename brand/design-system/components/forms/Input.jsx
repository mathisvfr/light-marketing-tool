import React from 'react';

/**
 * Light Personeelsdiensten — Input (text field)
 * Label + field with red focus ring. Optional leading Lucide icon.
 */
export function Input({
  label,
  type = 'text',
  placeholder = '',
  value,
  defaultValue,
  onChange,
  icon = null,
  hint = null,
  error = null,
  required = false,
  id,
  style = {},
}) {
  const [focus, setFocus] = React.useState(false);
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);
  const borderColor = error ? 'var(--light-red)' : (focus ? 'var(--light-red)' : 'var(--color-border-strong)');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      {label && (
        <label htmlFor={inputId} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5, color: 'var(--color-text)' }}>
          {label}{required && <span style={{ color: 'var(--light-red)' }}> *</span>}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <i data-lucide={icon} style={{ position: 'absolute', left: 12, width: 17, height: 17, color: 'var(--color-text-subtle)' }} />
        )}
        <input
          id={inputId}
          type={type}
          placeholder={placeholder}
          value={value}
          defaultValue={defaultValue}
          onChange={onChange}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            color: 'var(--color-text)',
            padding: icon ? '11px 14px 11px 38px' : '11px 14px',
            background: 'var(--color-bg)',
            border: `1.5px solid ${borderColor}`,
            borderRadius: 'var(--radius-sm)',
            outline: 'none',
            boxShadow: focus ? '0 0 0 3px var(--color-focus-ring)' : 'none',
            transition: 'border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out)',
          }}
        />
      </div>
      {(hint || error) && (
        <span style={{ fontFamily: 'var(--font-body)', fontSize: 12.5, color: error ? 'var(--light-red)' : 'var(--color-text-muted)' }}>
          {error || hint}
        </span>
      )}
    </div>
  );
}

// Inline form-feedback banner. Vervangt ruwe <p className="*-error"> tags
// door één consistent visueel patroon met icoon + tone (non-color-only).
//
// Variants: error | success | attention | info
// Return null bij lege children — parent hoeft geen conditional te schrijven.
//
// Voor floating/global-scope notifications gebruik <Toast> via useToast().
// FormMessage is voor inline feedback naast een form-veld of onder een
// section (bijv. "Kon merk instellingen niet laden").

const ICONS = {
  error: '✕',
  success: '✓',
  attention: '⚠',
  info: 'ⓘ',
};

export default function FormMessage({ variant = 'error', children, className = '' }) {
  if (!children) {
    return null;
  }

  return (
    <p
      className={`form-message form-message-${variant} ${className}`.trim()}
      role={variant === 'error' ? 'alert' : 'status'}
    >
      <span className="form-message-icon" aria-hidden="true">
        {ICONS[variant] || ''}
      </span>
      <span className="form-message-body">{children}</span>
    </p>
  );
}

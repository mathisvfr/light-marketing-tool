// Gedeelde Card-container voor content-blokken op elke pagina. Vervangt de
// page-specifieke .dashboard-card / .integration-card / .patronen-form-card /
// .published-panel etc. zodat spacing, borders en shadows overal identiek zijn.
//
// API:
//   <Card tone="emphasized" padding="lg" scrollable>
//     <CardHeader title="X" action={<Button/>} />
//     <CardBody>...</CardBody>
//     <CardFooter>...</CardFooter>
//   </Card>
//
//   <CardLoading />                                // skeleton met "Laden..."
//   <CardEmpty message="Geen data" action={...} /> // gecentreerd, muted
//
// Missing-states matrix: zie docs/design/missing-states-matrix.md — deze
// component tikt de acht Card-states af.

function classNames(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Card({
  tone = 'neutral',
  padding = 'md',
  scrollable = false,
  className = '',
  children,
  ...rest
}) {
  return (
    <div
      className={classNames(
        'card',
        `card-tone-${tone}`,
        `card-padding-${padding}`,
        scrollable && 'card-scrollable',
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

// Header met title + optionele action-slot rechts. Title in font-display.
export function CardHeader({ title, action, className = '', children }) {
  return (
    <div className={classNames('card-header', className)}>
      {title ? <h3 className="card-header-title">{title}</h3> : null}
      {children ? <div className="card-header-body">{children}</div> : null}
      {action ? <div className="card-header-action">{action}</div> : null}
    </div>
  );
}

// Body: default padding + optional scrollable content. Padding valt onder
// Card-level padding-prop.
export function CardBody({ className = '', children }) {
  return <div className={classNames('card-body', className)}>{children}</div>;
}

// Footer met border-top scheidings-lijn. Voor actions (Opslaan/Annuleren) of
// meta (last-updated timestamp).
export function CardFooter({ className = '', children }) {
  return <div className={classNames('card-footer', className)}>{children}</div>;
}

// Loading placeholder — vervangt losse `<p>Laden...</p>` op Dashboard etc.
// Skeleton-styling gedeeld met vacature-plaatsen `.skeleton` (dashed border).
export function CardLoading({ message = 'Laden...', className = '' }) {
  return (
    <div className={classNames('card-loading', className)} role="status" aria-live="polite">
      <div className="card-loading-skeleton">{message}</div>
    </div>
  );
}

// Empty-state — gecentreerd, muted. Optionele action-knop voor "Voeg toe"
// of "Ververs".
export function CardEmpty({ message, action, className = '' }) {
  return (
    <div className={classNames('card-empty', className)}>
      <p className="card-empty-message">{message}</p>
      {action ? <div className="card-empty-action">{action}</div> : null}
    </div>
  );
}

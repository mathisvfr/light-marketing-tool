// Modal = dunne branded wrapper om @radix-ui/react-dialog. Radix regelt:
// focus-trap, escape-close, portal-render, aria-modal, scroll-lock, restore
// focus. Wij leggen alleen de branded CSS + size/mobile-behavior bovenop.
//
// Rationale (autoplan-review UC2): zelf implementeren met inert-polyfill is
// een 2-weken tar-pit voor focus-trap edge-cases in nested selects, iframes
// en portals. Radix Dialog staat al in deps en wordt al gebruikt door de
// Shadcn dialog-wrapper — bewuste uitzondering op de Radix-purge in PR 3.
//
// API:
//   <Modal open={isOpen} onOpenChange={setOpen} title="..." size="md"
//          onCloseAttempt={() => confirmClose()}>
//     {body}
//   </Modal>
//
// Props:
//   - open (bool)           — controlled state
//   - onOpenChange (fn)     — Radix callback bij open/close
//   - onCloseAttempt (fn?)  — als gezet, wordt ipv onOpenChange(false)
//                             gecalled bij escape/outside-click. Parent
//                             beslist dan of een confirm-dialog opent.
//   - title (string)        — visueel header + aria-label
//   - description (string?) — subtekst onder titel, ook aria-describedby
//   - size ('sm'|'md'|'lg') — max-width. Default 'md'.
//   - children              — modal body (footer via aparte div is jouw keuze)
//
// Missing-states matrix: zie docs/design/missing-states-matrix.md.

import * as DialogPrimitive from '@radix-ui/react-dialog';

export default function Modal({
  open,
  onOpenChange,
  onCloseAttempt,
  title,
  description,
  size = 'md',
  children,
}) {
  // Als de parent een custom close-attempt-handler wil (bijv. voor
  // dirty-form-confirm), gebruiken we die i.p.v. de default close.
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen && typeof onCloseAttempt === 'function') {
      onCloseAttempt();
      return;
    }
    onOpenChange?.(nextOpen);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="modal-overlay" />
        <DialogPrimitive.Content
          className={`modal-content modal-size-${size}`}
          aria-describedby={description ? 'modal-description' : undefined}
        >
          <div className="modal-header">
            <DialogPrimitive.Title className="modal-title">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description id="modal-description" className="modal-description">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <div className="modal-body">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ModalFooter — flex-row met sticky-bottom positioning. Voor action-knoppen.
// Optioneel; content kan ook los in modal-body eindigen.
export function ModalFooter({ children, className = '' }) {
  return <div className={`modal-footer ${className}`.trim()}>{children}</div>;
}

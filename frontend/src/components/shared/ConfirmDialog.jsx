// ConfirmDialog = kleine wrapper om Modal voor bevestiging-flows. Vervangt
// window.confirm() (7× in de tool) met een branded, keyboard-accessible
// dialog die async onConfirm-handlers ondersteunt.
//
// API:
//   <ConfirmDialog
//     open={isOpen}
//     onOpenChange={setOpen}
//     title="Verwijder gebruiker"
//     message="Sandra wordt permanent verwijderd. Dit kan niet ongedaan."
//     confirmLabel="Verwijderen"
//     cancelLabel="Annuleren"
//     variant="destructive"           // 'normal' | 'destructive'
//     onConfirm={async () => { await deleteMutation.mutateAsync(id); }}
//   />
//
// Loading-state: `submitting` blijft true totdat onConfirm-promise settled.
// Bij succes sluit de dialog automatisch; bij reject blijft de dialog open
// zodat de parent een error kan tonen (bijv. inline in message).

import { useState } from 'react';
import Modal, { ModalFooter } from './Modal';

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Bevestigen',
  cancelLabel = 'Annuleren',
  variant = 'normal',
  onConfirm,
}) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (typeof onConfirm !== 'function') {
      onOpenChange?.(false);
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange?.(false);
    } finally {
      setSubmitting(false);
    }
  }

  function handleCancel() {
    if (submitting) return;
    onOpenChange?.(false);
  }

  return (
    <Modal
      open={open}
      onOpenChange={submitting ? undefined : onOpenChange}
      title={title}
      size="sm"
    >
      <p className="confirm-dialog-message">{message}</p>
      <ModalFooter>
        {/* Focus start op cancel — destructive-veilig per missing-states matrix.
            autoFocus zet keyboard-focus na open. */}
        <button
          type="button"
          className="confirm-btn-cancel"
          onClick={handleCancel}
          disabled={submitting}
          autoFocus
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          className="confirm-btn-primary"
          onClick={handleConfirm}
          disabled={submitting}
          data-variant={variant}
        >
          {submitting ? 'Bezig...' : confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}

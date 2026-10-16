// StickyFooter houdt de primaire actie-knoppen (Opslaan / Indienen /
// Goedkeuren) zichtbaar terwijl de recruiter door een lange preview scrollt.
// Desktop-only: op mobiel valt het terug op inline (via CSS media-query) om
// iOS-Safari keyboard-issues te vermijden. Autosave-status rechts inline zodat
// er één plek is voor "wordt opgeslagen"-feedback.

export default function StickyFooter({ children, autosaveLabel, autosaveError, onManualSave }) {
  return (
    <div className="sticky-footer" role="group" aria-label="Concept-acties">
      <div className="sticky-footer-actions">{children}</div>
      {autosaveError ? (
        <div className="sticky-footer-autosave has-error" role="alert">
          <span>Wijzigingen niet opgeslagen: {autosaveError}</span>
          {onManualSave ? (
            <button
              type="button"
              className="manual-save-btn"
              onClick={onManualSave}
            >
              Opslaan
            </button>
          ) : null}
        </div>
      ) : autosaveLabel ? (
        <div className="sticky-footer-autosave">{autosaveLabel}</div>
      ) : null}
    </div>
  );
}

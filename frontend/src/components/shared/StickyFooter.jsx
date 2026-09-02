// StickyFooter houdt de primaire actie-knoppen (Opslaan / Indienen /
// Goedkeuren) zichtbaar terwijl de recruiter door een lange preview scrollt.
// Desktop-only: op mobiel valt het terug op inline (via CSS media-query) om
// iOS-Safari keyboard-issues te vermijden. Autosave-status rechts inline zodat
// er één plek is voor "wordt opgeslagen"-feedback.

export default function StickyFooter({ children, autosaveLabel, autosaveError }) {
  return (
    <div className="sticky-footer" role="group" aria-label="Concept-acties">
      <div className="sticky-footer-actions">{children}</div>
      {autosaveLabel || autosaveError ? (
        <div className={`sticky-footer-autosave${autosaveError ? ' has-error' : ''}`}>
          {autosaveError || autosaveLabel}
        </div>
      ) : null}
    </div>
  );
}

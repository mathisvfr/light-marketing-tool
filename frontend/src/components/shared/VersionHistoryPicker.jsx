import { useState } from 'react';
import { api } from '../../lib/api';
import './version-history-picker.css';

// Compact "Vorige versies" dropdown + confirmation modal. Restores generated
// content only (form_data + image are preserved). Design review: modal must
// show WHICH version is being restored (timestamp + snippet) so the user is
// never surprised by what replaces their current text.

function formatSnippet(entry, type) {
  if (!entry?.content) return '';
  const c = entry.content;
  const primary =
    type === 'marketing-post'
      ? c.linkedin_post || c.social_nl || c.instagram_caption
      : c.omschrijving_nl || c.social_nl;
  if (!primary) return '(leeg)';
  const s = String(primary).replace(/\s+/g, ' ').trim();
  return s.length > 60 ? s.slice(0, 60) + '...' : s;
}

function formatWhen(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function VersionHistoryPicker({ draftId, history, draftType, onRestored }) {
  const [selectedIndex, setSelectedIndex] = useState('');
  const [confirming, setConfirming] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!Array.isArray(history) || history.length === 0) {
    return null;
  }

  function openConfirm(indexStr) {
    setSelectedIndex(indexStr);
    if (!indexStr) return;
    const idx = Number(indexStr);
    const entry = history[idx];
    setConfirming({ index: idx, entry });
  }

  async function performRestore() {
    if (confirming == null) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/drafts/${draftId}/restore-version`, {
        method: 'POST',
        body: JSON.stringify({ index: confirming.index }),
      });
      setConfirming(null);
      setSelectedIndex('');
      if (typeof onRestored === 'function') onRestored(result?.draft);
    } catch (err) {
      setError(err?.message || 'Herstellen mislukt.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="version-history">
      <label>
        Vorige versies
        <select
          value={selectedIndex}
          onChange={(event) => openConfirm(event.target.value)}
          disabled={busy}
        >
          <option value="">Kies een versie...</option>
          {history.map((entry, index) => (
            <option key={index} value={index}>
              {formatWhen(entry.at)} · {formatSnippet(entry, draftType)}
            </option>
          ))}
        </select>
      </label>

      {confirming ? (
        <div className="version-history-modal-backdrop" onClick={() => setConfirming(null)}>
          <div
            className="version-history-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-label="Versie herstellen"
          >
            <h4>Versie herstellen</h4>
            <p>
              Je huidige tekst wordt overschreven met de versie van{' '}
              <strong>{formatWhen(confirming.entry?.at)}</strong>. Deze actie kun je ongedaan
              maken via Vorige versies.
            </p>
            {error ? <p className="version-history-error">{error}</p> : null}
            <div className="version-history-actions">
              <button type="button" onClick={() => setConfirming(null)} disabled={busy}>
                Annuleren
              </button>
              <button
                type="button"
                className="version-history-danger"
                onClick={performRestore}
                disabled={busy}
              >
                {busy ? 'Herstellen...' : 'Ja, vervangen'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

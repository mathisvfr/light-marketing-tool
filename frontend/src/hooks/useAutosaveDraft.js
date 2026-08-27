import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

// Debounced autosave of a draft's form_data. Skips the first render and any
// render before a draftId exists (a new draft is only created on Generate).
// Uses PATCH /drafts/:id/form-data so unrelated fields (criticus, generated
// content) are never touched.
export function useAutosaveDraft(draftId, form, { delay = 1500 } = {}) {
  const [savedAt, setSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const timerRef = useRef(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!draftId) {
      return undefined;
    }

    // Skip the very first render after draftId shows up (loaded draft, no edits yet).
    if (!initializedRef.current) {
      initializedRef.current = true;
      return undefined;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(async () => {
      setIsSaving(true);
      setError('');
      try {
        await api(`/drafts/${draftId}/form-data`, {
          method: 'PATCH',
          body: JSON.stringify({ formData: form }),
        });
        setSavedAt(new Date());
      } catch (err) {
        setError(err?.message || 'Automatisch opslaan mislukt.');
      } finally {
        setIsSaving(false);
      }
    }, delay);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [draftId, form, delay]);

  return { savedAt, isSaving, error };
}

export function formatSavedAt(date) {
  if (!date) return '';
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return 'Zojuist opgeslagen';
  if (seconds < 60) return `Opgeslagen ${seconds}s geleden`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Opgeslagen ${minutes}m geleden`;
  return `Opgeslagen om ${date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`;
}

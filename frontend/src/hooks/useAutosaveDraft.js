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
  // Track the last-saved form JSON so we skip PATCH-calls when the object
  // reference changed but the underlying data didn't. Zonder deze check ontstaat
  // een feedback-loop met de per-3s poll: refetch → nieuwe loadedDraft-reference
  // → nieuwe form-useMemo → autosave-effect vuurt → PATCH → updated_at wijzigt
  // → volgende poll ziet weer nieuwe data → herhaal.
  const lastSavedRef = useRef('');

  // Serialize once per effect run. JSON.stringify is O(n) op form-grootte,
  // in praktijk 200-500 tekens — nauwelijks meetbaar.
  const formJson = JSON.stringify(form || {});

  useEffect(() => {
    if (!draftId) {
      return undefined;
    }

    // Skip the very first render after draftId shows up (loaded draft, no edits yet).
    // Onthoud meteen de huidige inhoud zodat de daadwerkelijke user-edit een
    // change is t.o.v. de begintoestand, niet t.o.v. leeg.
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedRef.current = formJson;
      return undefined;
    }

    // Feedback-loop-guard: alleen PATCHen wanneer de form-data daadwerkelijk
    // afwijkt van wat we laatst opgeslagen hebben.
    if (formJson === lastSavedRef.current) {
      return undefined;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    const targetJson = formJson;
    timerRef.current = setTimeout(async () => {
      setIsSaving(true);
      setError('');
      try {
        await api(`/drafts/${draftId}/form-data`, {
          method: 'PATCH',
          body: JSON.stringify({ formData: JSON.parse(targetJson) }),
        });
        // Onthoud pas na succes zodat een gefaalde PATCH bij de volgende
        // change opnieuw geprobeerd wordt.
        lastSavedRef.current = targetJson;
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
  }, [draftId, formJson, delay]);

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

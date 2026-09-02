import { useState } from 'react';

// Encapsuleert de override→server reconciliatie voor het imagePath-veld op
// drafts. Zowel VacaturePlaatsen als MarketingPost hadden hetzelfde patroon
// inline staan: een lokale override die voorrang heeft op de server-waarde,
// zodat we geen render-phase setState hoeven te doen om de server-waarde in
// te laden (React 19 warning).
//
// - `undefined` override = geen keuze gemaakt → toon `loadedDraft.image_path`.
// - `''` override = expliciet leeggemaakt door de gebruiker.
// - string override = lokale keuze (upload of bibliotheek).
export default function useImagePath(loadedDraft) {
  const [override, setOverride] = useState(undefined);
  const imagePath =
    typeof override === 'string' ? override : loadedDraft?.image_path || '';
  return [imagePath, setOverride];
}

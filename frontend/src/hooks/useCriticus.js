import { useState } from 'react';

// Zelfde reconciliatie-patroon als useImagePath: lokale override wint van de
// server-waarde tot de query re-fetch de override overschrijft. Voorkomt dat
// een net binnengekomen criticus-resultaat direct terugflipt bij een re-render.
//
// setOverride({ passed, notes }) — beide velden verplicht wanneer je overschrijft.
// Retourneert twee gedeprecatede waardes voor eenvoudig gebruik in JSX:
// - passed: true|false|null
// - notes: string
export default function useCriticus(loadedDraft) {
  const [override, setOverride] = useState({ passed: undefined, notes: undefined });

  const passed =
    typeof override.passed === 'boolean'
      ? override.passed
      : typeof loadedDraft?.criticus_passed === 'boolean'
      ? loadedDraft.criticus_passed
      : null;

  const notes =
    typeof override.notes === 'string'
      ? override.notes
      : loadedDraft?.criticus_notes || '';

  return { passed, notes, setOverride };
}

// Gedeelde datum/tijd-utils. Alles server- en client-tz-normaliseerd naar
// Europe/Amsterdam (per autoplan UC8: één tz doorheen de tool voorkomt
// DST-verrassingen).

const DUTCH_TZ = 'Europe/Amsterdam';

// Format een ISO-datum als `<datetime-local>`-input waarde in NL-tz. Gebruikt
// door de reschedule-modal in Gepubliceerd en de scheduling-picker in
// MarketingPost. Retourneert '' voor null/undefined/lege input.
export function isoToLocalInput(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: DUTCH_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

// Format een ISO-datum als leesbare NL-datum+tijd. "-" bij null/leeg.
export function formatDateTime(iso) {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: DUTCH_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

// Alleen de datum, geen tijd. "Onbekend" bij null (rest van tool gebruikt
// die term historisch — behouden voor consistentie).
export function formatDate(value) {
  if (!value) return 'Onbekend';
  return new Intl.DateTimeFormat('nl-NL', {
    timeZone: DUTCH_TZ,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

// True als de gegeven ISO-tijd in de toekomst ligt.
export function isFutureIso(iso) {
  if (!iso) return false;
  return new Date(iso).getTime() > Date.now();
}

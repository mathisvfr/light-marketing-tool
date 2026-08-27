// Pure next-slot resolver for publication_patterns. Given a pattern with a
// channel, ISO weekdays, and a wall-clock time_of_day in Europe/Amsterdam,
// return the next ISO instant (UTC) that matches, starting from `now`.
//
// Kept as a pure module so it can be unit-tested independently of HTTP or DB.
// DST behavior:
//   - Spring forward (last Sunday of March, 02:00 → 03:00 local): if the
//     pattern is 02:30 on that Sunday, the local time doesn't exist; we fall
//     forward to 03:30 by using date-fns-tz which is deterministic about the
//     nonexistent hour (returns the "after" instant).
//   - Fall back (last Sunday of October, 03:00 → 02:00 local): 02:30 exists
//     twice. fromZonedTime returns the FIRST occurrence deterministically.
//     Matches Buffer's expected behavior (schedule for the earlier instant).

const { fromZonedTime } = require('date-fns-tz');

const APP_TIMEZONE = 'Europe/Amsterdam';

function pad2(n) {
  return String(n).padStart(2, '0');
}

// Convert a JS Date into a Europe/Amsterdam wall-clock parts object using
// Intl (no external calendar library needed). Returns { y, m, d, day }
// where `day` is ISO 1..7 (Mon..Sun).
function localParts(date) {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  return {
    y: Number(parts.year),
    m: Number(parts.month),
    d: Number(parts.day),
    day: weekdayMap[parts.weekday],
  };
}

function nextSlot(pattern, now = new Date()) {
  const weekdays = new Set(pattern.weekdays);
  if (weekdays.size === 0) {
    throw new Error('Pattern has no weekdays.');
  }

  // time_of_day may arrive as 'HH:MM' or 'HH:MM:SS' from Postgres.
  const timeStr = String(pattern.time_of_day || '').trim();
  const match = timeStr.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) {
    throw new Error(`Invalid time_of_day: ${timeStr}`);
  }
  const hh = Number(match[1]);
  const mm = Number(match[2]);

  // Walk forward up to 14 Amsterdam-local days. Iterating by +24h UTC would
  // skip a day across DST boundaries (23h and 25h day-lengths). Instead we
  // increment the local calendar day directly and reprobe the weekday.
  const startParts = localParts(now);
  let y = startParts.y;
  let m = startParts.m;
  let d = startParts.d;

  for (let offset = 0; offset < 14; offset += 1) {
    // Compute the local weekday for this local date via a noon anchor
    // (12:00 exists in every zone regardless of DST).
    const noonAnchor = fromZonedTime(
      `${y}-${pad2(m)}-${pad2(d)}T12:00`,
      APP_TIMEZONE
    );
    const parts = localParts(noonAnchor);

    if (weekdays.has(parts.day)) {
      const wall = `${parts.y}-${pad2(parts.m)}-${pad2(parts.d)}T${pad2(hh)}:${pad2(mm)}`;
      const asUtc = fromZonedTime(wall, APP_TIMEZONE);
      if (asUtc.getTime() > now.getTime() + 60_000) {
        return asUtc;
      }
    }

    // Advance one local calendar day using UTC arithmetic on a date-only
    // struct — safe because we only care about the year/month/day, not TZ.
    const advanced = new Date(Date.UTC(y, m - 1, d + 1));
    y = advanced.getUTCFullYear();
    m = advanced.getUTCMonth() + 1;
    d = advanced.getUTCDate();
  }

  throw new Error('No matching weekday found within 14 days.');
}

module.exports = { nextSlot, APP_TIMEZONE };

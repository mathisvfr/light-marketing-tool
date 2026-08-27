const { test } = require('node:test');
const assert = require('node:assert/strict');
const { nextSlot } = require('../src/services/patternScheduler');

// Reference dates (all pinned to eliminate flakiness):
// - Aug 27 2026 (Thu, CEST/UTC+2)
// - Oct 25 2026 (Sun, DST fall-back day — the plan flagged this as the
//   concrete fixture to test)
// - March 29 2026 (Sun, DST spring-forward day)

test('nextSlot picks the next matching weekday after now', () => {
  // Thu Aug 27 2026 10:00 UTC (12:00 Amsterdam CEST). Pattern: Tue 09:00.
  const now = new Date('2026-08-27T10:00:00Z');
  const pattern = { weekdays: [2], time_of_day: '09:00' };
  const slot = nextSlot(pattern, now);
  // Next Tue is Sep 1 2026, 09:00 Amsterdam = 07:00Z (still CEST).
  assert.equal(slot.toISOString(), '2026-09-01T07:00:00.000Z');
});

test('nextSlot returns today if the wall-clock time is still in the future', () => {
  // Thu Aug 27 2026 06:00 UTC (08:00 Amsterdam). Pattern Thu 09:00 Amsterdam.
  const now = new Date('2026-08-27T06:00:00Z');
  const pattern = { weekdays: [4], time_of_day: '09:00' };
  const slot = nextSlot(pattern, now);
  // Today Aug 27 09:00 Amsterdam = 07:00Z.
  assert.equal(slot.toISOString(), '2026-08-27T07:00:00.000Z');
});

test('nextSlot skips today if the wall-clock time already passed', () => {
  // Thu Aug 27 2026 09:00 UTC (11:00 Amsterdam). Pattern Thu 09:00.
  const now = new Date('2026-08-27T09:00:00Z');
  const pattern = { weekdays: [4], time_of_day: '09:00' };
  const slot = nextSlot(pattern, now);
  // Should skip to next Thu Sep 3 09:00 Amsterdam = 07:00Z.
  assert.equal(slot.toISOString(), '2026-09-03T07:00:00.000Z');
});

test('nextSlot handles the fall-back DST transition (Oct 25 2026)', () => {
  // Sat Oct 24 2026 23:00 UTC (Sun Oct 25 01:00 Amsterdam, still CEST).
  // Pattern Sun 09:00.
  const now = new Date('2026-10-24T23:00:00Z');
  const pattern = { weekdays: [7], time_of_day: '09:00' };
  const slot = nextSlot(pattern, now);
  // Sunday Oct 25 has DST fall-back at 03:00 → 02:00. 09:00 is unambiguous.
  // Oct 25 09:00 Amsterdam (post-fallback = CET = UTC+1) → 08:00Z.
  assert.equal(slot.toISOString(), '2026-10-25T08:00:00.000Z');
});

test('nextSlot handles the spring-forward DST transition (Mar 29 2026)', () => {
  // Sat Mar 28 2026 22:00 UTC (Sun Mar 29 00:00 Amsterdam pre-DST = CET).
  // Pattern Sun 09:00.
  const now = new Date('2026-03-28T22:00:00Z');
  const pattern = { weekdays: [7], time_of_day: '09:00' };
  const slot = nextSlot(pattern, now);
  // Sun Mar 29 09:00 post-DST = CEST = UTC+2 → 07:00Z.
  assert.equal(slot.toISOString(), '2026-03-29T07:00:00.000Z');
});

test('nextSlot with multiple weekdays picks the earliest matching', () => {
  // Sun Aug 30 2026 20:00 UTC (Sun 22:00 Amsterdam). Pattern Tue+Thu 09:00.
  const now = new Date('2026-08-30T20:00:00Z');
  const pattern = { weekdays: [2, 4], time_of_day: '09:00' };
  const slot = nextSlot(pattern, now);
  // Next matching is Tue Sep 1 09:00 Amsterdam = 07:00Z.
  assert.equal(slot.toISOString(), '2026-09-01T07:00:00.000Z');
});

test('nextSlot throws when weekdays is empty', () => {
  const pattern = { weekdays: [], time_of_day: '09:00' };
  assert.throws(() => nextSlot(pattern, new Date()), /no weekdays/i);
});

test('nextSlot throws when time_of_day is malformed', () => {
  const pattern = { weekdays: [1], time_of_day: 'nope' };
  assert.throws(() => nextSlot(pattern, new Date()), /Invalid time_of_day/);
});

test('nextSlot accepts HH:MM:SS from Postgres TIME column', () => {
  const now = new Date('2026-08-27T06:00:00Z');
  const pattern = { weekdays: [4], time_of_day: '09:00:00' };
  const slot = nextSlot(pattern, now);
  assert.equal(slot.toISOString(), '2026-08-27T07:00:00.000Z');
});

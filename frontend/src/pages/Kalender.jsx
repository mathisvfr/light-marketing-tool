import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import './kalender.css';

const APP_TIMEZONE = 'Europe/Amsterdam';
const WEEKDAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const CHANNEL_LABEL = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' };
const CHANNEL_CLASS = { linkedin: 'ch-li', facebook: 'ch-fb', instagram: 'ch-ig' };

// Weeks are Monday-first (ISO). Given a Date, return the Monday of that ISO week.
function startOfIsoWeek(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isoDay(date) {
  // ISO 1..7 (Mon..Sun) from JS Sun..Sat 0..6.
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function formatDateHeader(date) {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function formatWeekRange(monday) {
  const sunday = addDays(monday, 6);
  const fmt = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'short',
    timeZone: APP_TIMEZONE,
  });
  return `${fmt.format(monday)} — ${fmt.format(sunday)}`;
}

function formatTime(date) {
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(date);
}

// Group scheduled items into a { dayIndex(0-6) → [{time, channel, title, id}] } map,
// clipped to the requested Monday…Sunday window.
function groupByDay(scheduledItems, monday, includeWeeks) {
  const start = monday.getTime();
  const end = addDays(monday, includeWeeks * 7).getTime();
  const buckets = Array.from({ length: includeWeeks * 7 }, () => []);

  for (const item of scheduledItems || []) {
    for (const channel of item.channels || []) {
      if (channel.status !== 'scheduled' || !channel.scheduledFor) continue;
      const when = new Date(channel.scheduledFor);
      const ms = when.getTime();
      if (ms < start || ms >= end) continue;
      const dayIndex = Math.floor((ms - start) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex >= buckets.length) continue;
      buckets[dayIndex].push({
        id: `${item.id}-${channel.channel}`,
        draftId: item.id,
        title: item.title,
        channel: channel.channel,
        when,
      });
    }
  }

  for (const bucket of buckets) {
    bucket.sort((a, b) => a.when.getTime() - b.when.getTime());
  }

  return buckets;
}

export default function Kalender() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [includeNext, setIncludeNext] = useState(false);
  const [selected, setSelected] = useState(null);

  const publishedQuery = useQuery({
    queryKey: ['published-items'],
    queryFn: () => api('/publish'),
  });

  const monday = useMemo(() => {
    const base = startOfIsoWeek(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const includeWeeks = includeNext ? 2 : 1;

  const buckets = useMemo(
    () => groupByDay(publishedQuery.data?.scheduledItems, monday, includeWeeks),
    [publishedQuery.data, monday, includeWeeks]
  );

  const totalItems = buckets.reduce((sum, bucket) => sum + bucket.length, 0);

  if (publishedQuery.isLoading) {
    return (
      <div className="kalender-layout">
        <p className="kalender-loading">Kalender wordt geladen...</p>
      </div>
    );
  }

  if (publishedQuery.isError) {
    return (
      <div className="kalender-layout">
        <p className="kalender-error">Kon kalender niet laden. Probeer opnieuw.</p>
      </div>
    );
  }

  return (
    <div className="kalender-layout">
      <div className="kalender-toolbar">
        <div className="kalender-nav">
          <button type="button" onClick={() => setWeekOffset((w) => w - 1)}>
            ← Vorige week
          </button>
          <strong className="kalender-range">{formatWeekRange(monday)}</strong>
          <button type="button" onClick={() => setWeekOffset((w) => w + 1)}>
            Volgende week →
          </button>
          {weekOffset !== 0 ? (
            <button type="button" onClick={() => setWeekOffset(0)}>
              Deze week
            </button>
          ) : null}
        </div>

        <label className="kalender-toggle">
          <input
            type="checkbox"
            checked={includeNext}
            onChange={(event) => setIncludeNext(event.target.checked)}
          />
          Ook 2e week tonen
        </label>
      </div>

      <p className="kalender-tz-note">Tijden in Europe/Amsterdam. {totalItems} ingepland.</p>

      {totalItems === 0 ? (
        <div className="kalender-empty">
          <p>Nog niets ingepland in deze week.</p>
          <p>
            Ga naar <Link to="/marketing-post">Marketing post</Link> om een post te plannen
            of naar <Link to="/gepubliceerd">Gepubliceerd</Link> voor het volledige overzicht.
          </p>
        </div>
      ) : (
        <div className={`kalender-grid ${includeWeeks === 2 ? 'two-weeks' : ''}`}>
          {buckets.map((bucket, index) => {
            const date = addDays(monday, index);
            const dayLabel = WEEKDAY_LABELS[isoDay(date) - 1];
            const isEmpty = bucket.length === 0;
            return (
              <section
                key={index}
                className={`kalender-day ${isEmpty ? 'is-empty' : ''}`}
                aria-label={`${dayLabel} ${formatDateHeader(date)}`}
              >
                <header>
                  <span className="kalender-day-name">{dayLabel}</span>
                  <span className="kalender-day-date">{formatDateHeader(date)}</span>
                </header>
                {isEmpty ? (
                  <p className="kalender-day-empty">—</p>
                ) : (
                  <ul>
                    {bucket.map((chip) => (
                      <li
                        key={chip.id}
                        className={`kalender-chip ${CHANNEL_CLASS[chip.channel] || ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => setSelected(chip)}
                          aria-label={`${CHANNEL_LABEL[chip.channel]} ${formatTime(chip.when)} — ${chip.title}`}
                        >
                          <span className="kalender-chip-time">{formatTime(chip.when)}</span>
                          <span className="kalender-chip-channel">{CHANNEL_LABEL[chip.channel]}</span>
                          <span className="kalender-chip-title">{chip.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selected ? (
        <aside className="kalender-side" role="dialog" aria-label="Details ingeplande post">
          <button
            type="button"
            className="kalender-side-close"
            onClick={() => setSelected(null)}
            aria-label="Sluiten"
          >
            ×
          </button>
          <h3>{selected.title}</h3>
          <p>
            <strong>{CHANNEL_LABEL[selected.channel]}</strong> — {formatTime(selected.when)}
          </p>
          <p className="kalender-side-note">
            Ingepland via Buffer. Om te wijzigen of te annuleren: ga naar Gepubliceerd (v2 slice 3).
          </p>
          <Link to="/gepubliceerd" className="kalender-side-link">
            Open in Gepubliceerd
          </Link>
        </aside>
      ) : null}
    </div>
  );
}

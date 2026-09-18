import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import FormMessage from '../components/shared/FormMessage';
import './kalender.css';

const APP_TIMEZONE = 'Europe/Amsterdam';
const WEEKDAY_LABELS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const WEEKDAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const CHANNEL_LABEL = { linkedin: 'LinkedIn', facebook: 'Facebook', instagram: 'Instagram' };
const CHANNEL_ICON = { linkedin: 'in', facebook: 'f', instagram: 'ig' };

function startOfIsoWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
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
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function isToday(date) {
  const now = new Date();
  return date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();
}

function formatDateNum(date) {
  return date.getDate();
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat('nl-NL', {
    month: 'long',
    year: 'numeric',
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat('nl-NL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function groupByDay(scheduledItems, marketingItems, monday) {
  const start = monday.getTime();
  const end = addDays(monday, 7).getTime();
  const buckets = Array.from({ length: 7 }, () => []);

  // Scheduled items (future)
  for (const item of scheduledItems || []) {
    for (const channel of item.channels || []) {
      if (channel.status !== 'scheduled' || !channel.scheduledFor) continue;
      const when = new Date(channel.scheduledFor);
      const ms = when.getTime();
      if (ms < start || ms >= end) continue;
      const dayIndex = Math.floor((ms - start) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex >= 7) continue;
      buckets[dayIndex].push({
        id: `sched-${item.id}-${channel.channel}`,
        title: item.title,
        channel: channel.channel,
        when,
        type: 'scheduled',
      });
    }
  }

  // Published items (past — show on the day they were published)
  for (const item of marketingItems || []) {
    for (const channel of item.channels || []) {
      if (channel.status !== 'success' || !channel.publishedAt) continue;
      const when = new Date(channel.publishedAt);
      const ms = when.getTime();
      if (ms < start || ms >= end) continue;
      const dayIndex = Math.floor((ms - start) / (24 * 60 * 60 * 1000));
      if (dayIndex < 0 || dayIndex >= 7) continue;
      buckets[dayIndex].push({
        id: `pub-${item.id}-${channel.channel}`,
        title: item.title,
        channel: channel.channel,
        when,
        type: 'published',
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
  const [selected, setSelected] = useState(null);

  const publishedQuery = useQuery({
    queryKey: ['published-items'],
    queryFn: () => api('/publish'),
  });

  const monday = useMemo(() => {
    const base = startOfIsoWeek(new Date());
    return addDays(base, weekOffset * 7);
  }, [weekOffset]);

  const buckets = useMemo(
    () => groupByDay(
      publishedQuery.data?.scheduledItems,
      publishedQuery.data?.marketingItems,
      monday
    ),
    [publishedQuery.data, monday]
  );

  const totalItems = buckets.reduce((sum, b) => sum + b.length, 0);

  if (publishedQuery.isLoading) {
    return <div className="kal-layout"><p className="kal-loading">Laden...</p></div>;
  }
  if (publishedQuery.isError) {
    return <div className="kal-layout"><FormMessage variant="error">Kon kalender niet laden.</FormMessage></div>;
  }

  return (
    <div className="kal-layout">
      {/* Header */}
      <div className="kal-header">
        <div className="kal-nav">
          <button type="button" className="kal-nav-btn" onClick={() => setWeekOffset((w) => w - 1)}>‹</button>
          <button type="button" className="kal-nav-btn" onClick={() => setWeekOffset((w) => w + 1)}>›</button>
          {weekOffset !== 0 && (
            <button type="button" className="kal-today-btn" onClick={() => setWeekOffset(0)}>Vandaag</button>
          )}
        </div>
        <h2 className="kal-month">{formatMonthYear(monday)}</h2>
        <span className="kal-count">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
      </div>

      {/* Week grid */}
      <div className="kal-grid">
        {/* Day headers */}
        {Array.from({ length: 7 }, (_, i) => (
          <div key={`head-${i}`} className="kal-day-header">
            <span className="kal-day-header-full">{WEEKDAY_LABELS[i]}</span>
            <span className="kal-day-header-short">{WEEKDAY_SHORT[i]}</span>
          </div>
        ))}

        {/* Day cells */}
        {buckets.map((bucket, index) => {
          const date = addDays(monday, index);
          const today = isToday(date);
          return (
            <div
              key={index}
              className={`kal-day${today ? ' is-today' : ''}${bucket.length === 0 ? ' is-empty' : ''}`}
            >
              <span className={`kal-day-num${today ? ' today' : ''}`}>{formatDateNum(date)}</span>
              <div className="kal-day-items">
                {bucket.map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`kal-chip ${chip.type} ch-${chip.channel}`}
                    onClick={() => setSelected(chip)}
                    title={`${CHANNEL_LABEL[chip.channel]} — ${chip.title}`}
                  >
                    <span className="kal-chip-icon">{CHANNEL_ICON[chip.channel]}</span>
                    <span className="kal-chip-time">{formatTime(chip.when)}</span>
                    <span className="kal-chip-title">{chip.title}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="kal-detail-overlay" onClick={() => setSelected(null)}>
          <aside className="kal-detail" onClick={(e) => e.stopPropagation()}>
            <div className="kal-detail-header">
              <span className={`kal-detail-badge ch-${selected.channel}`}>
                {CHANNEL_LABEL[selected.channel]}
              </span>
              <span className={`kal-detail-type ${selected.type}`}>
                {selected.type === 'scheduled' ? 'Ingepland' : 'Gepubliceerd'}
              </span>
              <button type="button" className="kal-detail-close" onClick={() => setSelected(null)}>×</button>
            </div>
            <h3 className="kal-detail-title">{selected.title}</h3>
            <p className="kal-detail-time">{formatTime(selected.when)}</p>
            <Link to="/gepubliceerd" className="kal-detail-link">Bekijk in Gepubliceerd →</Link>
          </aside>
        </div>
      )}
    </div>
  );
}

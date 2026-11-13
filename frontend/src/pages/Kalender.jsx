import { useCallback, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { queryKeys } from '../lib/queryKeys';
import { useAuth } from '../hooks/useAuth';
import FormMessage from '../components/shared/FormMessage';
import { CardLoading } from '../components/shared/Card';
import './kalender.css';

// ── Constants ──────────────────────────────────────────────────────
const APP_TIMEZONE = 'Europe/Amsterdam';
const WEEKDAY_LABELS = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag'];
const WEEKDAY_SHORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

const TYPE_FILTERS = [
  { key: 'all', label: 'Alles' },
  { key: 'vacature', label: 'Vacatures' },
  { key: 'marketing-post', label: 'Marketing' },
  { key: 'blog', label: 'Blogs' },
];

const CHIP_CONFIG = {
  'marketing-post': {
    linkedin:  { bg: '#dbeafe', text: '#1e40af', icon: 'in', label: 'LinkedIn' },
    facebook:  { bg: '#e0e7ff', text: '#3730a3', icon: 'f', label: 'Facebook' },
    instagram: { bg: '#f0e6fa', text: '#7c3aed', icon: 'ig', label: 'Instagram', border: '#c13584' },
  },
  vacature: {
    feed: { bg: '#fef3c7', text: '#92400e', icon: 'V', label: 'Vacature' },
  },
  blog: {
    website: { bg: '#d1fae5', text: '#065f46', icon: 'B', label: 'Blog' },
  },
};

function getChipStyle(type, channel) {
  return CHIP_CONFIG[type]?.[channel] || { bg: '#f3f4f6', text: '#374151', icon: '?', label: channel };
}

// ── Date helpers ───────────────────────────────────────────────────
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

function formatFullDate(date) {
  return new Intl.DateTimeFormat('nl-NL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Get the Monday of the week containing the 1st of the month
function monthGridStart(date) {
  const first = startOfMonth(date);
  return startOfIsoWeek(first);
}

// Get the Sunday of the week containing the last day of the month
function monthGridEnd(date) {
  const last = endOfMonth(date);
  const day = last.getDay();
  const diff = day === 0 ? 0 : 7 - day;
  return addDays(last, diff);
}

// ── Data grouping ──────────────────────────────────────────────────

function groupItemsByDay(items) {
  const map = new Map();
  for (const item of items) {
    const when = item.scheduledFor ? new Date(item.scheduledFor) : item.publishedAt ? new Date(item.publishedAt) : null;
    if (!when) continue;
    const key = toISODate(when);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ ...item, when });
  }
  // Sort each day's items by time
  for (const [, bucket] of map) {
    bucket.sort((a, b) => a.when.getTime() - b.when.getTime());
  }
  return map;
}

// ── CalendarChip ───────────────────────────────────────────────────

function CalendarChip({ item, compact, onClick }) {
  const style = getChipStyle(item.type, item.channel);
  const isPublished = item.status === 'published' || item.status === 'actief';

  const chipStyle = {
    background: style.bg,
    color: style.text,
    borderLeft: style.border ? `3px solid ${style.border}` : undefined,
  };

  if (compact) {
    return (
      <button
        type="button"
        className={`kal-chip kal-chip-compact${isPublished ? ' published' : ''}`}
        style={chipStyle}
        onClick={onClick}
        title={`${style.label} — ${item.title}`}
      >
        <span className="kal-chip-icon">{style.icon}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`kal-chip${isPublished ? ' published' : ''}`}
      style={chipStyle}
      onClick={onClick}
      title={`${style.label} — ${item.title}`}
    >
      <span className="kal-chip-icon">{style.icon}</span>
      <span className="kal-chip-time">{formatTime(item.when)}</span>
      <span className="kal-chip-title">{item.title}</span>
    </button>
  );
}

// ── KalenderHeader ─────────────────────────────────────────────────

function KalenderHeader({
  view, onViewChange, onPrev, onNext, onToday,
  showToday, monthLabel, totalItems, typeFilter, onTypeFilterChange,
}) {
  return (
    <div className="kal-header">
      <div className="kal-header-top">
        <div className="kal-nav">
          <button type="button" className="kal-nav-btn" onClick={onPrev} aria-label="Vorige">&#8249;</button>
          <button type="button" className="kal-nav-btn" onClick={onNext} aria-label="Volgende">&#8250;</button>
          {showToday && (
            <button type="button" className="kal-today-btn" onClick={onToday}>Vandaag</button>
          )}
        </div>
        <h2 className="kal-month">{monthLabel}</h2>
        <div className="kal-header-right">
          <div className="kal-view-toggle">
            <button
              type="button"
              className={`kal-view-btn${view === 'week' ? ' active' : ''}`}
              onClick={() => onViewChange('week')}
            >Week</button>
            <button
              type="button"
              className={`kal-view-btn${view === 'month' ? ' active' : ''}`}
              onClick={() => onViewChange('month')}
            >Maand</button>
          </div>
          <span className="kal-count">{totalItems} item{totalItems !== 1 ? 's' : ''}</span>
        </div>
      </div>
      <div className="kal-filters">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`kal-filter-btn${typeFilter === f.key ? ' active' : ''}`}
            onClick={() => onTypeFilterChange(f.key)}
          >{f.label}</button>
        ))}
      </div>
    </div>
  );
}

// ── WeekView ───────────────────────────────────────────────────────

function WeekView({ monday, itemsByDay, onChipClick, onDrop }) {
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  return (
    <div className="kal-grid kal-grid-week">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={`head-${i}`} className="kal-day-header">
          <span className="kal-day-header-full">{WEEKDAY_LABELS[i]}</span>
          <span className="kal-day-header-short">{WEEKDAY_SHORT[i]}</span>
        </div>
      ))}
      {Array.from({ length: 7 }, (_, index) => {
        const date = addDays(monday, index);
        const today = isToday(date);
        const key = toISODate(date);
        const bucket = itemsByDay.get(key) || [];
        return (
          <div
            key={key}
            className={`kal-day${today ? ' is-today' : ''}${bucket.length === 0 ? ' is-empty' : ''}`}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              e.preventDefault();
              const draftId = e.dataTransfer.getData('text/plain');
              if (draftId) onDrop(draftId, date);
            }}
          >
            <span className={`kal-day-num${today ? ' today' : ''}`}>{formatDateNum(date)}</span>
            <div className="kal-day-items">
              {bucket.map((item) => (
                <CalendarChip
                  key={`${item.id}-${item.channel}`}
                  item={item}
                  compact={false}
                  onClick={() => onChipClick(item)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── MonthView ──────────────────────────────────────────────────────

function MonthView({ referenceDate, itemsByDay, onChipClick, onDayClick }) {
  const gridStart = monthGridStart(referenceDate);
  const gridEnd = monthGridEnd(referenceDate);
  const currentMonth = referenceDate.getMonth();

  const days = [];
  let d = new Date(gridStart);
  while (d <= gridEnd) {
    days.push(new Date(d));
    d = addDays(d, 1);
  }

  const MAX_CHIPS = 3;

  return (
    <div className="kal-grid kal-grid-month">
      {WEEKDAY_SHORT.map((label) => (
        <div key={label} className="kal-day-header kal-day-header-month">{label}</div>
      ))}
      {days.map((date) => {
        const key = toISODate(date);
        const today = isToday(date);
        const isOtherMonth = date.getMonth() !== currentMonth;
        const bucket = itemsByDay.get(key) || [];
        const visible = bucket.slice(0, MAX_CHIPS);
        const overflow = bucket.length - MAX_CHIPS;

        return (
          <div
            key={key}
            className={`kal-day kal-day-month${today ? ' is-today' : ''}${isOtherMonth ? ' is-other-month' : ''}`}
            onClick={() => onDayClick(date)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onDayClick(date); }}
          >
            <span className={`kal-day-num${today ? ' today' : ''}`}>{formatDateNum(date)}</span>
            <div className="kal-day-dots">
              {visible.map((item) => (
                <CalendarChip
                  key={`${item.id}-${item.channel}`}
                  item={item}
                  compact
                  onClick={(e) => { e.stopPropagation(); onChipClick(item); }}
                />
              ))}
              {overflow > 0 && (
                <span className="kal-day-overflow">+{overflow}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── CalendarDetailPanel ────────────────────────────────────────────

const STATUS_LABELS = {
  scheduled: 'Ingepland',
  published: 'Gepubliceerd',
  actief: 'Actief',
};

const TYPE_LABELS = {
  'marketing-post': 'Marketing-post',
  vacature: 'Vacature',
  blog: 'Blog',
};

const CHANNEL_LABELS = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  feed: 'XML feed',
  website: 'Website',
};

function CalendarDetailPanel({ item, onClose, onReschedule, onCancel, canManage }) {
  const style = getChipStyle(item.type, item.channel);

  return (
    <div className="kal-detail-overlay" onClick={onClose}>
      <aside className="kal-detail kal-detail-slide" onClick={(e) => e.stopPropagation()}>
        <div className="kal-detail-header">
          <span className="kal-detail-badge" style={{ background: style.bg, color: style.text }}>
            {CHANNEL_LABELS[item.channel] || item.channel}
          </span>
          <span className={`kal-detail-type ${item.status}`}>
            {STATUS_LABELS[item.status] || item.status}
          </span>
          <button type="button" className="kal-detail-close" onClick={onClose}>&times;</button>
        </div>

        <h3 className="kal-detail-title">{item.title}</h3>

        {item.when && (
          <p className="kal-detail-time">
            {formatFullDate(item.when)}, {formatTime(item.when)}
          </p>
        )}

        <div className="kal-detail-meta">
          <div className="kal-detail-row">
            <span className="kal-detail-label">Type</span>
            <span>{TYPE_LABELS[item.type] || item.type}</span>
          </div>
          <div className="kal-detail-row">
            <span className="kal-detail-label">Kanaal</span>
            <span>{CHANNEL_LABELS[item.channel] || item.channel}</span>
          </div>
          <div className="kal-detail-row">
            <span className="kal-detail-label">Status</span>
            <span>{STATUS_LABELS[item.status] || item.status}</span>
          </div>
        </div>

        <div className="kal-detail-actions">
          <Link to="/content-wachtrij" className="kal-detail-link">Bekijk concept</Link>
          {canManage && item.status === 'scheduled' && (
            <>
              <button type="button" className="kal-detail-action-btn" onClick={() => onReschedule(item)}>
                Plan wijzigen
              </button>
              <button type="button" className="kal-detail-action-btn kal-detail-action-danger" onClick={() => onCancel(item)}>
                Annuleren
              </button>
            </>
          )}
        </div>

        {item.type === 'blog' && item.status === 'scheduled' && canManage && (
          <CrossPostOption draftId={item.id} />
        )}

        {item.parentDraftId && (
          <div className="kal-detail-crosspost-note">
            Aangemaakt vanuit een blog-publicatie
          </div>
        )}
      </aside>
    </div>
  );
}

// ── CrossPostOption (#11) ──────────────────────────────────────────

function CrossPostOption({ draftId }) {
  const [checked, setChecked] = useState(false);
  const queryClient = useQueryClient();

  const crossPostMutation = useMutation({
    mutationFn: () => api(`/calendar/drafts/${draftId}/cross-post`, {
      method: 'POST',
      body: JSON.stringify({ channels: ['linkedin', 'facebook'], type: 'Opdrachtgevers' }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
    },
  });

  return (
    <div className="kal-crosspost">
      <label className="kal-crosspost-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
        />
        Maak ook een social post aan
      </label>
      {checked && (
        <button
          type="button"
          className="kal-crosspost-btn"
          disabled={crossPostMutation.isPending}
          onClick={() => crossPostMutation.mutate()}
        >
          {crossPostMutation.isPending ? 'Bezig...' : 'Social post aanmaken'}
        </button>
      )}
      {crossPostMutation.isSuccess && (
        <p className="kal-crosspost-success">Social post concept aangemaakt.</p>
      )}
      {crossPostMutation.isError && (
        <p className="kal-crosspost-error">{crossPostMutation.error.message}</p>
      )}
    </div>
  );
}

// ── ScheduleSidePanel ──────────────────────────────────────────────

function ScheduleSidePanel({ onSmartSchedule, onManualSchedule }) {
  const { data, isLoading } = useQuery({
    ...queryKeys.drafts.list({ status: 'approved' }),
    queryFn: () => api('/drafts?status=approved'),
  });

  // Filter out drafts that already have a scheduled_for
  const unscheduled = useMemo(() => {
    if (!data?.drafts) return [];
    return data.drafts.filter((d) => !d.scheduledFor && !d.scheduled_for);
  }, [data]);

  if (isLoading) {
    return (
      <aside className="kal-side-panel">
        <h3 className="kal-side-title">Klaar om in te plannen</h3>
        <p className="kal-side-loading">Laden...</p>
      </aside>
    );
  }

  if (unscheduled.length === 0) {
    return (
      <aside className="kal-side-panel">
        <h3 className="kal-side-title">Klaar om in te plannen</h3>
        <p className="kal-side-empty">Geen goedgekeurde concepten om in te plannen.</p>
      </aside>
    );
  }

  return (
    <aside className="kal-side-panel">
      <h3 className="kal-side-title">Klaar om in te plannen</h3>
      <div className="kal-side-items">
        {unscheduled.map((draft) => (
          <ScheduleCard
            key={draft.id}
            draft={draft}
            onSmartSchedule={onSmartSchedule}
            onManualSchedule={onManualSchedule}
          />
        ))}
      </div>
    </aside>
  );
}

function ScheduleCard({ draft, onSmartSchedule, onManualSchedule }) {
  const [showPicker, setShowPicker] = useState(false);
  const [dateTime, setDateTime] = useState('');
  const typeStyle = getChipStyle(
    draft.type,
    draft.type === 'vacature' ? 'feed' : draft.type === 'blog' ? 'website' : 'linkedin'
  );
  const typeLabel = draft.type === 'vacature' ? 'VAC' : draft.type === 'blog' ? 'BLOG' : 'MKT';

  return (
    <div
      className="kal-side-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', draft.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
    >
      <div className="kal-side-card-header">
        <span className="kal-side-type-badge" style={{ background: typeStyle.bg, color: typeStyle.text }}>
          {typeLabel}
        </span>
        <span className="kal-side-card-title">{draft.titel || draft.title || draft.form_data?.titel || 'Zonder titel'}</span>
      </div>
      <div className="kal-side-card-actions">
        <button
          type="button"
          className="kal-side-btn kal-side-btn-primary"
          onClick={() => onSmartSchedule(draft.id)}
        >Volgend moment</button>
        <button
          type="button"
          className="kal-side-btn"
          onClick={() => setShowPicker(!showPicker)}
        >Plan in &#9662;</button>
      </div>
      {showPicker && (
        <div className="kal-side-picker">
          <input
            type="datetime-local"
            className="kal-side-datetime"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
          />
          <button
            type="button"
            className="kal-side-btn kal-side-btn-primary kal-side-btn-full"
            disabled={!dateTime}
            onClick={() => {
              onManualSchedule(draft.id, new Date(dateTime).toISOString());
              setShowPicker(false);
              setDateTime('');
            }}
          >Bevestigen</button>
        </div>
      )}
    </div>
  );
}

// ── DropTimeDialog ─────────────────────────────────────────────────

function DropTimeDialog({ draftId, date, onConfirm, onCancel }) {
  const [time, setTime] = useState('09:00');

  const handleConfirm = () => {
    const [h, m] = time.split(':').map(Number);
    const dt = new Date(date);
    dt.setHours(h, m, 0, 0);
    onConfirm(draftId, dt.toISOString());
  };

  return (
    <div className="kal-drop-dialog-overlay" onClick={onCancel}>
      <div className="kal-drop-dialog" onClick={(e) => e.stopPropagation()}>
        <h4 className="kal-drop-dialog-title">Inplannen op {formatFullDate(date)}</h4>
        <input
          type="time"
          className="kal-drop-dialog-time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <div className="kal-drop-dialog-actions">
          <button type="button" className="kal-side-btn" onClick={onCancel}>Annuleren</button>
          <button type="button" className="kal-side-btn kal-side-btn-primary" onClick={handleConfirm}>Inplannen</button>
        </div>
      </div>
    </div>
  );
}

// ── DayDetailPanel (month view day click) ──────────────────────────

function DayDetailPanel({ date, items, onClose, onChipClick, onSwitchToWeek }) {
  return (
    <div className="kal-detail-overlay" onClick={onClose}>
      <aside className="kal-detail kal-detail-slide" onClick={(e) => e.stopPropagation()}>
        <div className="kal-detail-header">
          <h3 className="kal-detail-title" style={{ margin: 0 }}>{formatFullDate(date)}</h3>
          <button type="button" className="kal-detail-close" onClick={onClose}>&times;</button>
        </div>
        {items.length === 0 ? (
          <p className="kal-detail-time">Geen items op deze dag.</p>
        ) : (
          <div className="kal-day-detail-list">
            {items.map((item) => (
              <button
                key={`${item.id}-${item.channel}`}
                type="button"
                className="kal-day-detail-item"
                onClick={() => onChipClick(item)}
              >
                <CalendarChip item={item} compact={false} onClick={() => onChipClick(item)} />
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="kal-detail-link"
          onClick={onSwitchToWeek}
          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0.5rem 0' }}
        >Bekijk deze week &rarr;</button>
      </aside>
    </div>
  );
}

// ── Main Kalender ──────────────────────────────────────────────────

export default function Kalender() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const canManage = role === 'owner' || role === 'manager';

  // View state from URL params
  const view = searchParams.get('view') || 'week';
  const typeFilter = searchParams.get('type') || 'all';

  // Navigation offset
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [dayDetail, setDayDetail] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  // Calculate date range based on view
  const { monday, referenceDate, from, to } = useMemo(() => {
    const now = new Date();
    if (view === 'month') {
      const ref = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const gridFrom = monthGridStart(ref);
      const gridTo = monthGridEnd(ref);
      return {
        monday: startOfIsoWeek(now),
        referenceDate: ref,
        from: toISODate(gridFrom),
        to: toISODate(addDays(gridTo, 1)),
      };
    }
    const base = startOfIsoWeek(now);
    const mon = addDays(base, offset * 7);
    return {
      monday: mon,
      referenceDate: mon,
      from: toISODate(mon),
      to: toISODate(addDays(mon, 7)),
    };
  }, [view, offset]);

  // Fetch calendar items
  const calendarQuery = useQuery({
    ...queryKeys.calendar.range(from, to),
    queryFn: () => api(`/calendar?from=${from}&to=${to}`),
  });

  // Filter items by type
  const filteredItems = useMemo(() => {
    const items = calendarQuery.data?.items || [];
    if (typeFilter === 'all') return items;
    return items.filter((item) => item.type === typeFilter);
  }, [calendarQuery.data, typeFilter]);

  const itemsByDay = useMemo(() => groupItemsByDay(filteredItems), [filteredItems]);

  // Smart schedule mutation
  const smartSchedule = useMutation({
    mutationFn: (draftId) => api(`/calendar/drafts/${draftId}/smart-schedule`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
    },
  });

  // Manual schedule mutation
  const manualSchedule = useMutation({
    mutationFn: ({ draftId, scheduledFor }) => api(`/calendar/drafts/${draftId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ scheduledFor }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      setDropTarget(null);
    },
  });

  // Unschedule mutation
  const unschedule = useMutation({
    mutationFn: (draftId) => api(`/calendar/drafts/${draftId}/unschedule`, {
      method: 'POST',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendar.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      setSelected(null);
    },
  });

  const handleViewChange = useCallback((newView) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('view', newView);
      return next;
    });
    setOffset(0);
  }, [setSearchParams]);

  const handleTypeFilterChange = useCallback((key) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (key === 'all') { next.delete('type'); } else { next.set('type', key); }
      return next;
    });
  }, [setSearchParams]);

  const handlePrev = useCallback(() => setOffset((o) => o - 1), []);
  const handleNext = useCallback(() => setOffset((o) => o + 1), []);
  const handleToday = useCallback(() => setOffset(0), []);

  const handleDrop = useCallback((draftId, date) => {
    setDropTarget({ draftId, date });
  }, []);

  const handleDropConfirm = useCallback((draftId, scheduledFor) => {
    manualSchedule.mutate({ draftId, scheduledFor });
  }, [manualSchedule]);

  const handleDayClick = useCallback((date) => {
    const key = toISODate(date);
    const items = itemsByDay.get(key) || [];
    setDayDetail({ date, items });
  }, [itemsByDay]);

  const handleSwitchToWeek = useCallback((date) => {
    const targetMonday = startOfIsoWeek(date);
    const currentMonday = startOfIsoWeek(new Date());
    const diffDays = Math.round((targetMonday.getTime() - currentMonday.getTime()) / (24 * 60 * 60 * 1000));
    const weekDiff = Math.round(diffDays / 7);
    setOffset(weekDiff);
    handleViewChange('week');
    setDayDetail(null);
  }, [handleViewChange]);

  const monthLabel = formatMonthYear(referenceDate);
  const showToday = offset !== 0;

  if (calendarQuery.isLoading) {
    return <div className="kal-layout"><CardLoading message="Kalender wordt geladen..." rows={4} /></div>;
  }
  if (calendarQuery.isError) {
    return <div className="kal-layout"><FormMessage variant="error">Kon kalender niet laden.</FormMessage></div>;
  }

  return (
    <div className="kal-page-layout">
      <div className="kal-main">
        <KalenderHeader
          view={view}
          onViewChange={handleViewChange}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          showToday={showToday}
          monthLabel={monthLabel}
          totalItems={filteredItems.length}
          typeFilter={typeFilter}
          onTypeFilterChange={handleTypeFilterChange}
        />

        {view === 'week' ? (
          <WeekView
            monday={monday}
            itemsByDay={itemsByDay}
            onChipClick={setSelected}
            onDrop={handleDrop}
          />
        ) : (
          <MonthView
            referenceDate={referenceDate}
            itemsByDay={itemsByDay}
            onChipClick={setSelected}
            onDayClick={handleDayClick}
          />
        )}

        {(smartSchedule.isError || manualSchedule.isError) && (
          <FormMessage variant="error">
            {smartSchedule.error?.message || manualSchedule.error?.message || 'Inplannen mislukt.'}
          </FormMessage>
        )}
      </div>

      {canManage && (
        <ScheduleSidePanel
          onSmartSchedule={(id) => smartSchedule.mutate(id)}
          onManualSchedule={(id, scheduledFor) => manualSchedule.mutate({ draftId: id, scheduledFor })}
        />
      )}

      {/* Detail panel for individual item */}
      {selected && (
        <CalendarDetailPanel
          item={selected}
          onClose={() => setSelected(null)}
          onReschedule={(item) => {
            setSelected(null);
            // Open drop dialog for rescheduling
            setDropTarget({ draftId: item.id, date: item.when || new Date() });
          }}
          onCancel={() => {
            unschedule.mutate(selected.id);
          }}
          canManage={canManage}
        />
      )}

      {/* Day detail panel (month view) */}
      {dayDetail && !selected && (
        <DayDetailPanel
          date={dayDetail.date}
          items={dayDetail.items}
          onClose={() => setDayDetail(null)}
          onChipClick={(item) => { setDayDetail(null); setSelected(item); }}
          onSwitchToWeek={() => handleSwitchToWeek(dayDetail.date)}
        />
      )}

      {/* Drop time picker dialog */}
      {dropTarget && (
        <DropTimeDialog
          draftId={dropTarget.draftId}
          date={dropTarget.date}
          onConfirm={handleDropConfirm}
          onCancel={() => setDropTarget(null)}
        />
      )}
    </div>
  );
}

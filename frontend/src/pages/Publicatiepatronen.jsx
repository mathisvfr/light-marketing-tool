import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import Card, { CardHeader } from '../components/shared/Card';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import '../components/shared/card.css';
import '../components/shared/modal.css';
import './publicatiepatronen.css';

const WEEKDAY_CHIPS = [
  { key: 1, label: 'Ma' },
  { key: 2, label: 'Di' },
  { key: 3, label: 'Wo' },
  { key: 4, label: 'Do' },
  { key: 5, label: 'Vr' },
  { key: 6, label: 'Za' },
  { key: 7, label: 'Zo' },
];

const CHANNEL_OPTIONS = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
];

const TIME_PRESETS = ['09:00', '12:00', '18:00'];

const EMPTY_FORM = {
  name: '',
  channel: 'linkedin',
  weekdays: [],
  time_of_day: '09:00',
  is_active: true,
};

function formatWeekdays(days) {
  if (!Array.isArray(days) || days.length === 0) return '—';
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((n) => WEEKDAY_CHIPS.find((chip) => chip.key === n)?.label || n)
    .join(', ');
}

export default function Publicatiepatronen() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(null);

  const patternsQuery = useQuery({
    queryKey: ['publication-patterns'],
    queryFn: () => api('/patterns'),
  });

  const patterns = useMemo(() => patternsQuery.data?.patterns || [], [patternsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: (payload) => {
      if (editingId) {
        return api(`/patterns/${editingId}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      }
      return api('/patterns', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publication-patterns'] });
      setForm(EMPTY_FORM);
      setEditingId(null);
      setSuccess(editingId ? 'Patroon bijgewerkt.' : 'Patroon toegevoegd.');
      setError('');
    },
    onError: (err) => setError(err.message || 'Opslaan mislukt.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/patterns/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['publication-patterns'] });
      setSuccess('Patroon verwijderd.');
    },
    onError: (err) => setError(err.message || 'Verwijderen mislukt.'),
  });

  function toggleWeekday(key) {
    setForm((prev) => {
      const has = prev.weekdays.includes(key);
      return {
        ...prev,
        weekdays: has
          ? prev.weekdays.filter((w) => w !== key)
          : [...prev.weekdays, key].sort((a, b) => a - b),
      };
    });
  }

  function loadForEdit(pattern) {
    setEditingId(pattern.id);
    setForm({
      name: pattern.name,
      channel: pattern.channel,
      weekdays: pattern.weekdays || [],
      time_of_day: String(pattern.timeOfDay || '').slice(0, 5),
      is_active: pattern.isActive,
    });
    setError('');
    setSuccess('');
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (form.weekdays.length === 0) {
      setError('Kies minimaal één weekdag.');
      return;
    }
    saveMutation.mutate(form);
  }

  function handleDelete(pattern) {
    setConfirm({
      title: 'Patroon verwijderen',
      message: `"${pattern.name}" wordt verwijderd. Marketingposts die er nog naar verwezen behouden hun eigen scheduling.`,
      confirmLabel: 'Verwijderen',
      variant: 'destructive',
      onConfirm: () => deleteMutation.mutateAsync(pattern.id),
    });
  }

  if (patternsQuery.isLoading) {
    return <p>Patronen worden geladen...</p>;
  }

  return (
    <div className="patronen-layout">
      <p className="patronen-intro">
        Patronen zijn snelkoppelingen voor Buffer-inplanning. Ze publiceren niets automatisch.
        Bij goedkeuring van een marketingpost kies je een patroon uit de dropdown en Buffer
        krijgt de eerst-passende datum + tijd. Alle tijden in Europe/Amsterdam.
      </p>

      <Card className="patronen-form-card">
        <CardHeader title={editingId ? 'Patroon bewerken' : 'Nieuw patroon'} />
        <form onSubmit={handleSubmit} className="patronen-form">
          <label>
            Naam
            <input
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              maxLength={80}
              required
              placeholder="Bijv. LinkedIn ochtend"
            />
          </label>

          <label>
            Kanaal
            <select
              value={form.channel}
              onChange={(event) => setForm({ ...form, channel: event.target.value })}
            >
              {CHANNEL_OPTIONS.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>

          <div>
            <span className="patronen-label">Weekdagen</span>
            <div className="patronen-chips" role="group" aria-label="Weekdagen">
              {WEEKDAY_CHIPS.map((chip) => {
                const active = form.weekdays.includes(chip.key);
                return (
                  <button
                    type="button"
                    key={chip.key}
                    className={`patronen-chip ${active ? 'active' : ''}`}
                    onClick={() => toggleWeekday(chip.key)}
                    aria-pressed={active}
                  >
                    {chip.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="patronen-label">Tijd</span>
            <div className="patronen-time">
              <input
                type="time"
                step="900"
                value={form.time_of_day}
                onChange={(event) => setForm({ ...form, time_of_day: event.target.value })}
                required
              />
              <div className="patronen-time-presets">
                {TIME_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset}
                    className={`patronen-preset ${form.time_of_day === preset ? 'active' : ''}`}
                    onClick={() => setForm({ ...form, time_of_day: preset })}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <label className="patronen-active">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
            />
            Actief (kan geselecteerd worden op marketingposts)
          </label>

          <div className="patronen-form-actions">
            <button type="submit" disabled={saveMutation.isPending}>
              {editingId ? 'Bijwerken' : 'Toevoegen'}
            </button>
            {editingId ? (
              <button type="button" onClick={cancelEdit} disabled={saveMutation.isPending}>
                Annuleren
              </button>
            ) : null}
          </div>

          {error ? <p className="patronen-error">{error}</p> : null}
          {success ? <p className="patronen-success">{success}</p> : null}
        </form>
      </Card>

      <section>
        <h3>Bestaande patronen ({patterns.length})</h3>
        {patterns.length === 0 ? (
          <div className="patronen-empty">
            Nog geen patronen. Voeg er één toe om posts snel in te plannen.
          </div>
        ) : (
          <table className="patronen-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>Kanaal</th>
                <th>Weekdagen</th>
                <th>Tijd</th>
                <th>Actief</th>
                <th>Acties</th>
              </tr>
            </thead>
            <tbody>
              {patterns.map((pattern) => (
                <tr key={pattern.id}>
                  <td>{pattern.name}</td>
                  <td>{pattern.channel}</td>
                  <td>{formatWeekdays(pattern.weekdays)}</td>
                  <td>{String(pattern.timeOfDay || '').slice(0, 5)}</td>
                  <td>{pattern.isActive ? '✅' : '⏸️'}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => loadForEdit(pattern)}
                      disabled={saveMutation.isPending || deleteMutation.isPending}
                    >
                      Bewerken
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(pattern)}
                      disabled={saveMutation.isPending || deleteMutation.isPending}
                    >
                      Verwijderen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(next) => { if (!next) setConfirm(null); }}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        variant={confirm?.variant}
        onConfirm={confirm?.onConfirm}
      />
    </div>
  );
}

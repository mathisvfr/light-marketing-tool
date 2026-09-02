import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ChannelStatus from '../components/shared/ChannelStatus';
import Modal, { ModalFooter } from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import '../components/shared/status-strip.css';
import '../components/shared/modal.css';
import './gepubliceerd.css';

function formatDate(value) {
  if (!value) {
    return 'Onbekend';
  }

  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return 'Onbekend';
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

// Buffer's metrics array is normalized into a { name: value } object by the
// sync service. Render a compact icon row: hearts/comments/reach. Any subset
// of these may be missing depending on the channel and how new the post is.
function renderMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object') return null;
  const likes = metrics.likes ?? metrics.reactions ?? null;
  const comments = metrics.comments ?? null;
  const reach = metrics.reach ?? metrics.impressions ?? metrics.views ?? null;

  if (likes == null && comments == null && reach == null) return null;

  return (
    <span className="channel-metrics">
      {likes != null ? <span title="Likes">♥ {likes}</span> : null}
      {comments != null ? <span title="Reacties">💬 {comments}</span> : null}
      {reach != null ? <span title="Bereik">👁 {reach}</span> : null}
    </span>
  );
}

function getTypeLabel(type) {
  return type === 'marketing-post' ? 'Marketing' : 'Vacature';
}

function getTypeClass(type) {
  return type === 'marketing-post' ? 'published-badge type-marketing' : 'published-badge type-vacature';
}

// getStatusDotClass verwijderd — vervangen door <ChannelStatus compact>
// die de tone uit /api/meta/statuses haalt via useStatusMeta.

// Convert a UTC ISO instant to a datetime-local value in Europe/Amsterdam
// (YYYY-MM-DDTHH:MM). Used as the default value in the reschedule modal so
// Luke sees "current planned time" pre-filled.
function isoToLocalInput(iso) {
  if (!iso) return '';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Amsterdam',
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

export default function Gepubliceerd() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [reschedTarget, setReschedTarget] = useState(null); // { publicationId, title, channel, currentIso }
  const [reschedValue, setReschedValue] = useState('');
  const [confirm, setConfirm] = useState(null);

  const publishedQuery = useQuery({
    queryKey: ['published-items'],
    queryFn: () => api('/publish'),
  });

  const expireMutation = useMutation({
    mutationFn: (draftId) => api(`/publish/${draftId}/expire`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['published-items'] });
    },
  });

  const rescheduleMutation = useMutation({
    mutationFn: ({ id, dueAt }) =>
      api(`/publications/${id}/reschedule`, {
        method: 'POST',
        body: JSON.stringify({ dueAt }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['published-items'] });
      setReschedTarget(null);
    },
    onError: (err) => setError(err?.message || 'Verplaatsen mislukt.'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => api(`/publications/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['published-items'] });
    },
    onError: (err) => setError(err?.message || 'Annuleren mislukt.'),
  });

  function openReschedule(scheduledRow, title) {
    setError('');
    setReschedTarget({
      publicationId: scheduledRow.id,
      title,
      channel: scheduledRow.channel,
      currentIso: scheduledRow.scheduledFor,
    });
    setReschedValue(isoToLocalInput(scheduledRow.scheduledFor));
  }

  function submitReschedule(event) {
    event.preventDefault();
    if (!reschedTarget?.publicationId || !reschedValue) return;
    rescheduleMutation.mutate({ id: reschedTarget.publicationId, dueAt: reschedValue });
  }

  function handleCancel(scheduledRow, title) {
    setError('');
    setConfirm({
      title: 'Ingeplande post annuleren',
      message: `De ingeplande post op ${scheduledRow.channel} voor "${title}" wordt geannuleerd.`,
      confirmLabel: 'Annuleren van post',
      variant: 'destructive',
      onConfirm: () => cancelMutation.mutateAsync(scheduledRow.id),
    });
  }

  function handleExpire(draftId) {
    setError('');
    setConfirm({
      title: 'Vacature sluiten',
      message: 'De vacature wordt uit de feed gehaald. Bestaande sollicitanten blijven bewaard.',
      confirmLabel: 'Sluiten',
      variant: 'destructive',
      onConfirm: async () => {
        try {
          await expireMutation.mutateAsync(draftId);
        } catch (err) {
          setError(err.message || 'Sluiten van vacature mislukt.');
          throw err;
        }
      },
    });
  }

  if (publishedQuery.isLoading) {
    return <p>Gepubliceerde items worden geladen...</p>;
  }

  if (publishedQuery.isError) {
    return <p className="published-error">Kon gepubliceerde items niet laden.</p>;
  }

  const marketingItems = publishedQuery.data?.marketingItems || [];
  const vacatureItems = publishedQuery.data?.vacatureItems || [];
  const scheduledItems = publishedQuery.data?.scheduledItems || [];

  return (
    <div className="published-layout">
      {scheduledItems.length > 0 ? (
        <section className="published-section">
          <h3>Ingepland via Buffer</h3>
          <div className="published-table-wrap">
            <table className="published-table">
              <thead>
                <tr>
                  <th>Titel</th>
                  <th>Kanaal</th>
                  <th>Ingepland voor</th>
                  {role === 'owner' ? <th>Acties</th> : null}
                </tr>
              </thead>
              <tbody>
                {scheduledItems.flatMap((item) =>
                  (item.channels || [])
                    .filter((c) => c.status === 'scheduled')
                    .map((channel) => (
                      <tr key={`${item.id}-${channel.channel}`}>
                        <td>{item.title}</td>
                        <td>
                          <span className="channel-status-item">
                            <ChannelStatus status={channel.status} compact />
                            {channel.channel}
                          </span>
                        </td>
                        <td>{formatDateTime(channel.scheduledFor)}</td>
                        {role === 'owner' ? (
                          <td>
                            <button
                              type="button"
                              onClick={() => openReschedule(channel, item.title)}
                              disabled={rescheduleMutation.isPending || cancelMutation.isPending}
                            >
                              Plan wijzigen
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancel(channel, item.title)}
                              disabled={rescheduleMutation.isPending || cancelMutation.isPending}
                            >
                              Annuleren
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <Modal
        open={Boolean(reschedTarget)}
        onOpenChange={(next) => { if (!next) setReschedTarget(null); }}
        title="Plan wijzigen"
        size="sm"
      >
        {reschedTarget ? (
          <form onSubmit={submitReschedule} className="published-modal-form">
            <p className="published-modal-title">{reschedTarget.title}</p>
            <p className="published-modal-meta">
              <strong>Huidige planning:</strong> {reschedTarget.channel} —{' '}
              {formatDateTime(reschedTarget.currentIso)}
            </p>
            <label>
              Nieuwe datum en tijd (Europe/Amsterdam)
              <input
                type="datetime-local"
                value={reschedValue}
                onChange={(event) => setReschedValue(event.target.value)}
                required
                autoFocus
              />
            </label>
            <ModalFooter>
              <button
                type="button"
                className="confirm-btn-cancel"
                onClick={() => setReschedTarget(null)}
                disabled={rescheduleMutation.isPending}
              >
                Annuleren
              </button>
              <button type="submit" className="confirm-btn-primary" disabled={rescheduleMutation.isPending}>
                {rescheduleMutation.isPending ? 'Verplaatsen...' : `Verplaatsen naar ${reschedValue || '...'}`}
              </button>
            </ModalFooter>
          </form>
        ) : null}
      </Modal>

      <section className="published-section">
        <h3>Marketingpublicaties (Type B)</h3>
        <div className="published-table-wrap">
          <table className="published-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Type</th>
                <th>Gepubliceerd op</th>
                <th>Per-kanaal status</th>
              </tr>
            </thead>
            <tbody>
              {marketingItems.length === 0 ? (
                <tr>
                  <td colSpan={4}>Nog geen gepubliceerde marketingposts.</td>
                </tr>
              ) : (
                marketingItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>
                      <span className={getTypeClass(item.type)}>{getTypeLabel(item.type)}</span>
                    </td>
                    <td>{formatDate(item.publishedAt)}</td>
                    <td>
                      <div className="channel-status-list">
                        {(item.channels || []).length === 0 ? (
                          <span>-</span>
                        ) : (
                          item.channels.map((channel) => (
                            <span key={`${item.id}-${channel.channel}`} className="channel-status-item">
                              <ChannelStatus status={channel.status} compact />
                              {channel.channel} (
                              {channel.status === 'scheduled'
                                ? `ingepland voor ${formatDateTime(channel.scheduledFor)}`
                                : channel.status}
                              )
                              {renderMetrics(channel.metrics)}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="published-section">
        <h3>Actieve vacatures (Type A)</h3>
        <div className="published-table-wrap">
          <table className="published-table">
            <thead>
              <tr>
                <th>Titel</th>
                <th>Status</th>
                <th>Laatst bijgewerkt</th>
                <th>Stats</th>
                <th>Actie</th>
              </tr>
            </thead>
            <tbody>
              {vacatureItems.length === 0 ? (
                <tr>
                  <td colSpan={5}>Geen actieve vacatures.</td>
                </tr>
              ) : (
                vacatureItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>
                      <StatusBadge status="actief" />
                    </td>
                    <td>{formatDate(item.updatedAt)}</td>
                    <td>{item.stats}</td>
                    <td>
                      {role === 'owner' ? (
                        <button
                          type="button"
                          className="published-expire-btn"
                          onClick={() => handleExpire(item.id)}
                          disabled={expireMutation.isPending}
                        >
                          Vacature sluiten
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="published-note">
        Stats voor Type A zijn nog een stub tot de Jobit/Multiposter-methode definitief is.
      </p>

      {error ? <p className="published-error">{error}</p> : null}

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

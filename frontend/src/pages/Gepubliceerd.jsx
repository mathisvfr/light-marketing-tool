import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ChannelStatus from '../components/shared/ChannelStatus';
import Modal, { ModalFooter } from '../components/shared/Modal';
import ConfirmDialog from '../components/shared/ConfirmDialog';
import FormMessage from '../components/shared/FormMessage';
import '../components/shared/status-strip.css';
import '../components/shared/modal.css';
import '../components/shared/toast.css';
import { formatDate, formatDateTime, isoToLocalInput } from '../lib/datetime';
import './gepubliceerd.css';

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

const TABS = [
  { key: 'marketing', label: 'Marketingposts' },
  { key: 'vacatures', label: 'Vacatures' },
  { key: 'blogs', label: 'Blogs' },
];

export default function Gepubliceerd() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('marketing');
  const [error, setError] = useState('');
  const [reschedTarget, setReschedTarget] = useState(null);
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

  const retryFailedMutation = useMutation({
    mutationFn: (draftId) => api(`/publish/${draftId}/retry-failed`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['published-items'] });
    },
    onError: (err) => setError(err?.message || 'Opnieuw proberen mislukt.'),
  });

  const republishMutation = useMutation({
    mutationFn: (draftId) => api(`/publish/jobit-republish/${draftId}`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['published-items'] });
    },
    onError: (err) => setError(err?.message || 'Herpubliceren mislukt.'),
  });

  // Sync Jobit errors into notifications when the vacatures tab is active.
  // Fire-and-forget — result doesn't affect the UI directly.
  useEffect(() => {
    if (activeTab !== 'vacatures' || (role !== 'owner' && role !== 'manager')) return;
    api('/publish/jobit-sync', { method: 'POST' }).catch(() => {});
  }, [activeTab, role]);

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
    return <FormMessage variant="error">Kon gepubliceerde items niet laden.</FormMessage>;
  }

  const marketingItems = publishedQuery.data?.marketingItems || [];
  const vacatureItems = publishedQuery.data?.vacatureItems || [];
  const scheduledItems = publishedQuery.data?.scheduledItems || [];
  const blogItems = publishedQuery.data?.blogItems || [];

  return (
    <div className="published-layout">
      {/* Tab navigation */}
      <nav className="published-tabs">
        {TABS.map((tab) => {
          const count =
            tab.key === 'marketing' ? marketingItems.length + scheduledItems.length
            : tab.key === 'vacatures' ? vacatureItems.length
            : blogItems.length;
          return (
            <button
              key={tab.key}
              type="button"
              className={`published-tab${activeTab === tab.key ? ' active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
              {count > 0 ? <span className="published-tab-count">{count}</span> : null}
            </button>
          );
        })}
      </nav>

      {/* Marketing tab */}
      {activeTab === 'marketing' && (
        <>
          {scheduledItems.length > 0 && (
            <section className="published-section">
              <h3 className="published-section-title">Ingepland via Buffer</h3>
              <div className="published-table-wrap">
                <table className="published-table">
                  <thead>
                    <tr>
                      <th>Titel</th>
                      <th>Kanaal</th>
                      <th>Ingepland voor</th>
                      {(role === 'owner' || role === 'manager') ? <th>Acties</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {scheduledItems.flatMap((item) =>
                      (item.channels || [])
                        .filter((c) => c.status === 'scheduled')
                        .map((channel) => (
                          <tr key={`${item.id}-${channel.channel}`}>
                            <td className="published-title-cell">{item.title}</td>
                            <td>
                              <span className="channel-status-item">
                                <ChannelStatus status={channel.status} compact />
                                {channel.channel}
                              </span>
                            </td>
                            <td>{formatDateTime(channel.scheduledFor)}</td>
                            {(role === 'owner' || role === 'manager') ? (
                              <td>
                                <div className="published-actions">
                                  <button
                                    type="button"
                                    className="published-btn"
                                    onClick={() => openReschedule(channel, item.title)}
                                    disabled={rescheduleMutation.isPending || cancelMutation.isPending}
                                  >
                                    Plan wijzigen
                                  </button>
                                  <button
                                    type="button"
                                    className="published-btn destructive"
                                    onClick={() => handleCancel(channel, item.title)}
                                    disabled={rescheduleMutation.isPending || cancelMutation.isPending}
                                  >
                                    Annuleren
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="published-section">
            <h3 className="published-section-title">Gepubliceerde posts</h3>
            {marketingItems.length === 0 ? (
              <p className="published-empty">Nog geen gepubliceerde marketingposts.</p>
            ) : (
              <div className="published-table-wrap">
                <table className="published-table">
                  <thead>
                    <tr>
                      <th>Titel</th>
                      <th>Gepubliceerd op</th>
                      <th>Kanaalstatus</th>
                      {(role === 'owner' || role === 'manager') ? <th>Acties</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {marketingItems.map((item) => {
                      const hasFailed = (item.channels || []).some((c) => c.status === 'failed');
                      return (
                        <tr key={item.id}>
                          <td className="published-title-cell">{item.title}</td>
                          <td>{formatDate(item.publishedAt)}</td>
                          <td>
                            <div className="channel-status-list">
                              {(item.channels || []).length === 0 ? (
                                <span>-</span>
                              ) : (
                                item.channels.map((channel) => (
                                  <span key={`${item.id}-${channel.channel}`} className="channel-status-item">
                                    <ChannelStatus status={channel.status} compact />
                                    {channel.channel}
                                    {channel.status === 'scheduled'
                                      ? ` (ingepland ${formatDateTime(channel.scheduledFor)})`
                                      : null}
                                    {renderMetrics(channel.metrics)}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>
                          {(role === 'owner' || role === 'manager') ? (
                            <td>
                              {hasFailed ? (
                                <button
                                  type="button"
                                  className="published-btn"
                                  onClick={() => retryFailedMutation.mutate(item.id)}
                                  disabled={retryFailedMutation.isPending}
                                >
                                  {retryFailedMutation.isPending ? 'Bezig...' : 'Opnieuw proberen'}
                                </button>
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {/* Vacatures tab */}
      {activeTab === 'vacatures' && (
        <section className="published-section">
          <h3 className="published-section-title">Actieve vacatures in de XML feed</h3>
          {vacatureItems.length === 0 ? (
            <p className="published-empty">Geen actieve vacatures.</p>
          ) : (
            <div className="jobit-cards">
              {vacatureItems.map((item) => {
                const channels = item.channels || [];
                const live = channels.filter((ch) => ch.status === 'published');
                const failed = channels.filter((ch) => ch.status === 'failed');
                const pending = channels.filter((ch) => ch.status === 'pending' || ch.status === 'scheduled');
                const disabled = channels.filter((ch) => ch.status === 'disabled');
                const hasFailed = failed.length > 0;

                return (
                  <div key={item.id} className={`jobit-card${hasFailed ? ' jobit-card-error' : ''}`}>
                    <div className="jobit-card-header">
                      <div>
                        <Link to={`/vacature-plaatsen?draftId=${item.id}`} className="jobit-card-title">
                          {item.title}
                        </Link>
                        <span className="jobit-card-date">Bijgewerkt {formatDate(item.updatedAt)}</span>
                      </div>
                      <div className="jobit-card-actions">
                        <Link to={`/vacature-plaatsen?draftId=${item.id}`} className="published-btn">
                          Bewerken
                        </Link>
                        {(role === 'owner' || role === 'manager') && channels.length > 0 && (
                          <button
                            type="button"
                            className="published-btn"
                            onClick={() => republishMutation.mutate(item.id)}
                            disabled={republishMutation.isPending}
                            title="Verzendt de vacature opnieuw naar alle platforms via Jobit"
                          >
                            {republishMutation.isPending ? 'Bezig...' : 'Herpubliceren'}
                          </button>
                        )}
                        {(role === 'owner' || role === 'manager') && (
                          <button
                            type="button"
                            className="published-btn destructive"
                            onClick={() => handleExpire(item.id)}
                            disabled={expireMutation.isPending}
                          >
                            Sluiten
                          </button>
                        )}
                      </div>
                    </div>

                    {channels.length === 0 ? (
                      <p className="jobit-no-channels">Niet gevonden in Jobit — wacht tot Multiposter de feed ophaalt.</p>
                    ) : (
                      <div className="jobit-card-channels">
                        {/* Live platforms */}
                        {live.length > 0 && (
                          <div className="jobit-group">
                            <span className="jobit-group-label jobit-group-live">Live ({live.length})</span>
                            <div className="jobit-chips">
                              {live.map((ch) => (
                                <span key={ch.name} className="jobit-chip jobit-chip-live">{ch.name}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Failed platforms */}
                        {failed.length > 0 && (
                          <div className="jobit-group">
                            <span className="jobit-group-label jobit-group-failed">Mislukt ({failed.length})</span>
                            <div className="jobit-chips">
                              {failed.map((ch) => (
                                <div key={ch.name} className="jobit-chip-error">
                                  <strong>{ch.name}</strong>
                                  {(ch.errors || []).map((err, i) => (
                                    <span key={i}>{err.message}</span>
                                  ))}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Pending platforms */}
                        {pending.length > 0 && (
                          <div className="jobit-group">
                            <span className="jobit-group-label jobit-group-pending">In afwachting ({pending.length})</span>
                            <div className="jobit-chips">
                              {pending.map((ch) => (
                                <span key={ch.name} className="jobit-chip jobit-chip-pending">{ch.name}</span>
                              ))}
                            </div>
                            <small className="jobit-pending-hint">Wacht op verwerking door het platform of handmatige actie in Multiposter.</small>
                          </div>
                        )}

                        {/* Disabled (only show if no other channels) */}
                        {disabled.length > 0 && live.length === 0 && failed.length === 0 && (
                          <div className="jobit-group">
                            <span className="jobit-group-label">Uitgeschakeld ({disabled.length})</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Blogs tab */}
      {activeTab === 'blogs' && (
        <section className="published-section">
          <h3 className="published-section-title">Gepubliceerde blogs</h3>
          {blogItems.length === 0 ? (
            <p className="published-empty">Nog geen gepubliceerde blogartikelen.</p>
          ) : (
            <div className="published-table-wrap">
              <table className="published-table">
                <thead>
                  <tr>
                    <th>Titel</th>
                    <th>Categorie</th>
                    <th>Status</th>
                    <th>Laatst bijgewerkt</th>
                    <th>Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {blogItems.map((item) => (
                    <tr key={item.id}>
                      <td className="published-title-cell">{item.title}</td>
                      <td>{item.categorie || '-'}</td>
                      <td><StatusBadge status={item.status} /></td>
                      <td>{formatDate(item.updatedAt)}</td>
                      <td>
                        <Link to={`/blog-aanmaken?draftId=${item.id}`} className="published-btn">
                          Bewerken
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <FormMessage variant="error">{error}</FormMessage>

      {/* Reschedule modal */}
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

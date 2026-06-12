import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
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

function getTypeLabel(type) {
  return type === 'marketing-post' ? 'Marketing' : 'Vacature';
}

function getTypeClass(type) {
  return type === 'marketing-post' ? 'published-badge type-marketing' : 'published-badge type-vacature';
}

function getStatusDotClass(status) {
  if (status === 'success') {
    return 'channel-dot success';
  }

  if (status === 'failed') {
    return 'channel-dot failed';
  }

  if (status === 'pending') {
    return 'channel-dot pending';
  }

  return 'channel-dot unknown';
}

export default function Gepubliceerd() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

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

  async function handleExpire(draftId) {
    setError('');

    if (!window.confirm('Weet je zeker dat je deze vacature wilt sluiten?')) {
      return;
    }

    try {
      await expireMutation.mutateAsync(draftId);
    } catch (err) {
      setError(err.message || 'Sluiten van vacature mislukt.');
    }
  }

  if (publishedQuery.isLoading) {
    return <p>Gepubliceerde items worden geladen...</p>;
  }

  if (publishedQuery.isError) {
    return <p className="published-error">Kon gepubliceerde items niet laden.</p>;
  }

  const marketingItems = publishedQuery.data?.marketingItems || [];
  const vacatureItems = publishedQuery.data?.vacatureItems || [];

  return (
    <div className="published-layout">
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
                              <span className={getStatusDotClass(channel.status)} />
                              {channel.channel} ({channel.status})
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
                      <span className="published-badge status-active">Actief</span>
                    </td>
                    <td>{formatDate(item.updatedAt)}</td>
                    <td>{item.stats}</td>
                    <td>
                      {role === 'owner' ? (
                        <button
                          type="button"
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
    </div>
  );
}

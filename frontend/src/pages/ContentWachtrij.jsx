import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import './content-wachtrij.css';

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

function getTypeBadgeClass(type) {
  return type === 'marketing-post' ? 'queue-badge type-marketing' : 'queue-badge type-vacature';
}

function getTypeLabel(type) {
  return type === 'marketing-post' ? 'Marketing' : 'Vacature';
}

function getStatusBadgeClass(status) {
  return `queue-badge status-${status}`;
}

function getStatusLabel(status) {
  const labels = {
    draft: 'Concept',
    pending_approval: 'Wacht op goedkeuring',
    approved: 'Goedgekeurd',
    actief: 'Actief',
    published: 'Gepubliceerd',
    expired: 'Verlopen',
    rejected: 'Afgewezen',
  };

  return labels[status] || status;
}

function formatChannels(channels) {
  if (!Array.isArray(channels) || channels.length === 0) {
    return '-';
  }

  return channels.join(', ');
}

export default function ContentWachtrij() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, role } = useAuth();

  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [authorFilter, setAuthorFilter] = useState('all');
  const [error, setError] = useState('');

  const draftsQuery = useQuery({
    queryKey: ['drafts-queue', statusFilter, typeFilter, authorFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        status: statusFilter,
        type: typeFilter,
        auteur: authorFilter,
      });

      return api(`/drafts?${params.toString()}`);
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api(`/drafts/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, comment }) =>
      api(`/drafts/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ comment }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/drafts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const drafts = useMemo(() => draftsQuery.data?.drafts || [], [draftsQuery.data]);
  const authorOptions = useMemo(() => {
    const map = new Map();
    for (const draft of drafts) {
      if (!map.has(draft.createdBy)) {
        map.set(draft.createdBy, draft.authorName);
      }
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [drafts]);

  async function handleApprove(id) {
    setError('');
    try {
      await approveMutation.mutateAsync(id);
    } catch (err) {
      setError(err.message || 'Goedkeuren mislukt.');
    }
  }

  async function handleReject(id) {
    setError('');
    const comment = window.prompt('Optionele afwijsreden:') || '';

    try {
      await rejectMutation.mutateAsync({ id, comment });
    } catch (err) {
      setError(err.message || 'Afwijzen mislukt.');
    }
  }

  async function handleDelete(id) {
    setError('');

    if (!window.confirm('Weet je zeker dat je dit concept wilt verwijderen?')) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(id);
    } catch (err) {
      setError(err.message || 'Verwijderen mislukt.');
    }
  }

  function handleEdit(draft) {
    if (draft.type === 'marketing-post') {
      navigate(`/marketing-post?draftId=${draft.id}`);
      return;
    }

    navigate(`/vacature-plaatsen?draftId=${draft.id}`);
  }

  if (draftsQuery.isLoading) {
    return <p>Wachtrij wordt geladen...</p>;
  }

  if (draftsQuery.isError) {
    return <p className="queue-error">Kon wachtrij niet laden.</p>;
  }

  const isMutating =
    approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending;

  return (
    <div className="queue-layout">
      <div className="queue-filters">
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Alle statussen</option>
            <option value="draft">Draft</option>
            <option value="pending_approval">Wacht op goedkeuring</option>
            <option value="approved">Goedgekeurd</option>
            <option value="actief">Actief</option>
            <option value="published">Gepubliceerd</option>
            <option value="expired">Verlopen</option>
            <option value="rejected">Afgewezen</option>
          </select>
        </label>

        <label>
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Alle types</option>
            <option value="vacature">Vacature</option>
            <option value="marketing">Marketing</option>
          </select>
        </label>

        <label>
          Auteur
          <select value={authorFilter} onChange={(event) => setAuthorFilter(event.target.value)}>
            <option value="all">Alle auteurs</option>
            {authorOptions.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="queue-table-wrap">
        <table className="queue-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Titel</th>
              <th>Auteur</th>
              <th>Status</th>
              <th>Aangemaakt</th>
              <th>Kanalen</th>
              <th>Acties</th>
            </tr>
          </thead>
          <tbody>
            {drafts.length === 0 ? (
              <tr>
                <td colSpan={7}>Geen concepten gevonden.</td>
              </tr>
            ) : (
              drafts.map((draft) => {
                const isOwner = role === 'owner';
                const isRecruiterOwnDraft = role === 'recruiter' && draft.createdBy === user?.id;

                return (
                  <tr key={draft.id}>
                    <td>
                      <span className={getTypeBadgeClass(draft.type)}>{getTypeLabel(draft.type)}</span>
                    </td>
                    <td>{draft.title}</td>
                    <td>{draft.authorName}</td>
                    <td>
                      <span className={getStatusBadgeClass(draft.status)}>
                        {getStatusLabel(draft.status)}
                      </span>
                    </td>
                    <td>{formatDate(draft.createdAt)}</td>
                    <td>{formatChannels(draft.channels)}</td>
                    <td>
                      <div className="queue-actions">
                        {isOwner ? (
                          <>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleApprove(draft.id)}
                            >
                              Goedkeuren
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleReject(draft.id)}
                            >
                              Afwijzen
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleEdit(draft)}
                            >
                              Bewerken
                            </button>
                          </>
                        ) : null}

                        {isRecruiterOwnDraft ? (
                          <>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleEdit(draft)}
                            >
                              Bewerken
                            </button>
                            <button
                              type="button"
                              disabled={isMutating}
                              onClick={() => handleDelete(draft.id)}
                            >
                              Verwijderen
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {error ? <p className="queue-error">{error}</p> : null}
    </div>
  );
}

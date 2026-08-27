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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
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

  const duplicateMutation = useMutation({
    mutationFn: (id) => api(`/drafts/${id}/duplicate`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    },
  });

  const allDrafts = useMemo(() => draftsQuery.data?.drafts || [], [draftsQuery.data]);

  // Client-side freetext search over title + author. Server already filters
  // status/type/auteur; search is UI polish — no need for a server round-trip.
  const drafts = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();
    if (!term) {
      return allDrafts;
    }
    return allDrafts.filter((draft) => {
      const title = (draft.title || '').toLowerCase();
      const author = (draft.authorName || '').toLowerCase();
      return title.includes(term) || author.includes(term);
    });
  }, [allDrafts, searchQuery]);

  const authorOptions = useMemo(() => {
    const map = new Map();
    for (const draft of allDrafts) {
      if (!map.has(draft.createdBy)) {
        map.set(draft.createdBy, draft.authorName);
      }
    }

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allDrafts]);

  const pendingSelectableIds = useMemo(
    () => drafts.filter((d) => d.status === 'pending_approval').map((d) => d.id),
    [drafts]
  );

  const selectedPendingCount = useMemo(
    () => pendingSelectableIds.filter((id) => selectedIds.has(id)).length,
    [pendingSelectableIds, selectedIds]
  );

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const allSelected = pendingSelectableIds.length > 0 &&
        pendingSelectableIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of pendingSelectableIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of pendingSelectableIds) next.add(id);
      return next;
    });
  }

  async function handleBulkApprove() {
    setError('');
    const ids = pendingSelectableIds.filter((id) => selectedIds.has(id));
    if (ids.length === 0) return;

    try {
      const result = await api('/drafts/bulk-approve', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });

      const succeeded = result?.succeededCount || 0;
      const skipped = result?.skippedCount || 0;
      if (skipped > 0) {
        setError(`${succeeded} goedgekeurd, ${skipped} overgeslagen (verkeerde status of niet gevonden).`);
      }

      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['drafts-queue'] });
    } catch (err) {
      setError(err.message || 'Bulk goedkeuren mislukt.');
    }
  }

  async function handleDuplicate(id) {
    setError('');
    try {
      const result = await duplicateMutation.mutateAsync(id);
      const newId = result?.draft?.id;
      const newType = result?.draft?.type;
      if (newId) {
        navigate(newType === 'marketing-post'
          ? `/marketing-post?draftId=${newId}`
          : `/vacature-plaatsen?draftId=${newId}`);
      }
    } catch (err) {
      setError(err.message || 'Dupliceren mislukt.');
    }
  }

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
    approveMutation.isPending ||
    rejectMutation.isPending ||
    deleteMutation.isPending ||
    duplicateMutation.isPending;

  const allPendingSelected =
    pendingSelectableIds.length > 0 &&
    pendingSelectableIds.every((id) => selectedIds.has(id));

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

        <label className="queue-search">
          Zoeken
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Titel of auteur..."
          />
        </label>
      </div>

      {role === 'owner' && selectedPendingCount > 0 ? (
        <div className="queue-bulk-bar">
          <span>{selectedPendingCount} geselecteerd</span>
          <button
            type="button"
            onClick={handleBulkApprove}
            disabled={isMutating}
          >
            Keur {selectedPendingCount} goed
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            disabled={isMutating}
          >
            Selectie wissen
          </button>
        </div>
      ) : null}

      <div className="queue-table-wrap">
        <table className="queue-table">
          <thead>
            <tr>
              {role === 'owner' ? (
                <th>
                  <input
                    type="checkbox"
                    checked={allPendingSelected}
                    disabled={pendingSelectableIds.length === 0}
                    onChange={toggleSelectAll}
                    aria-label="Selecteer alle wachtende concepten"
                  />
                </th>
              ) : null}
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
                <td colSpan={role === 'owner' ? 8 : 7}>Geen concepten gevonden.</td>
              </tr>
            ) : (
              drafts.map((draft) => {
                const isOwner = role === 'owner';
                const isRecruiterOwnDraft = role === 'recruiter' && draft.createdBy === user?.id;

                const canDuplicate = isOwner || isRecruiterOwnDraft;

                return (
                  <tr key={draft.id}>
                    {role === 'owner' ? (
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(draft.id)}
                          disabled={draft.status !== 'pending_approval'}
                          onChange={() => toggleSelect(draft.id)}
                          aria-label={`Selecteer ${draft.title || 'concept'}`}
                        />
                      </td>
                    ) : null}
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

                        {canDuplicate ? (
                          <button
                            type="button"
                            disabled={isMutating}
                            onClick={() => handleDuplicate(draft.id)}
                          >
                            Dupliceer
                          </button>
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

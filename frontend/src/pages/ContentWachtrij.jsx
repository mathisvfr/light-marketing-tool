import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

import FormMessage from '@/components/shared/FormMessage';
import StatusBadge from '@/components/shared/StatusBadge';
import TypeBadge from '@/components/shared/TypeBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

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

  const drafts = draftsQuery.data?.drafts || [];
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
    return <p className="text-muted-foreground">Wachtrij wordt geladen...</p>;
  }

  if (draftsQuery.isError) {
    return <FormMessage variant="error">Kon wachtrij niet laden.</FormMessage>;
  }

  const isMutating =
    approveMutation.isPending || rejectMutation.isPending || deleteMutation.isPending;

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="flex flex-wrap gap-4 py-4">
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="draft">Concept</SelectItem>
                <SelectItem value="pending_approval">Wacht op goedkeuring</SelectItem>
                <SelectItem value="approved">Goedgekeurd</SelectItem>
                <SelectItem value="published">Gepubliceerd</SelectItem>
                <SelectItem value="expired">Verlopen</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                <SelectItem value="vacature">Vacature</SelectItem>
                <SelectItem value="marketing">Marketing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Auteur</Label>
            <Select value={authorFilter} onValueChange={setAuthorFilter}>
              <SelectTrigger className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle auteurs</SelectItem>
                {authorOptions.map((author) => (
                  <SelectItem key={author.id} value={author.id}>
                    {author.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Auteur</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Aangemaakt</TableHead>
                <TableHead>Kanalen</TableHead>
                <TableHead>Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drafts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-muted-foreground">
                    Geen concepten gevonden.
                  </TableCell>
                </TableRow>
              ) : (
                drafts.map((draft) => {
                  const isOwner = role === 'owner';
                  const isRecruiterOwnDraft =
                    role === 'recruiter' && draft.createdBy === user?.id;

                  return (
                    <TableRow key={draft.id}>
                      <TableCell>
                        <TypeBadge type={draft.type} />
                      </TableCell>
                      <TableCell className="font-medium whitespace-normal">
                        {draft.title}
                      </TableCell>
                      <TableCell>{draft.authorName}</TableCell>
                      <TableCell>
                        <StatusBadge status={draft.status} />
                      </TableCell>
                      <TableCell>{formatDate(draft.createdAt)}</TableCell>
                      <TableCell>{formatChannels(draft.channels)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          {isOwner ? (
                            <>
                              <Button
                                size="sm"
                                disabled={isMutating}
                                onClick={() => handleApprove(draft.id)}
                              >
                                Goedkeuren
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isMutating}
                                onClick={() => handleReject(draft.id)}
                              >
                                Afwijzen
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isMutating}
                                onClick={() => handleEdit(draft)}
                              >
                                Bewerken
                              </Button>
                            </>
                          ) : null}

                          {isRecruiterOwnDraft ? (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={isMutating}
                                onClick={() => handleEdit(draft)}
                              >
                                Bewerken
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={isMutating}
                                onClick={() => handleDelete(draft.id)}
                              >
                                Verwijderen
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FormMessage variant="error">{error}</FormMessage>
    </div>
  );
}

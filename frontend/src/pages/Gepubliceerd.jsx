import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import ChannelIndicator from '@/components/shared/ChannelIndicator';
import FormMessage from '@/components/shared/FormMessage';
import TypeBadge from '@/components/shared/TypeBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
    return <p className="text-muted-foreground">Gepubliceerde items worden geladen...</p>;
  }

  if (publishedQuery.isError) {
    return <FormMessage variant="error">Kon gepubliceerde items niet laden.</FormMessage>;
  }

  const items = publishedQuery.data?.items || [];

  return (
    <div className="grid gap-6">
      <Card>
        <CardContent className="py-2">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Gepubliceerd op</TableHead>
                <TableHead>Kanalen</TableHead>
                <TableHead>Actie</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Nog geen gepubliceerde items.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium whitespace-normal">
                      {item.title}
                    </TableCell>
                    <TableCell>
                      <TypeBadge type={item.type} />
                    </TableCell>
                    <TableCell>{formatDate(item.publishedAt)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1.5">
                        {(item.channels || []).length === 0 ? (
                          <span className="text-muted-foreground">-</span>
                        ) : (
                          item.channels.map((channel) => (
                            <ChannelIndicator
                              key={`${item.id}-${channel.channel}`}
                              channel={channel.channel}
                              status={channel.status}
                            />
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {role === 'owner' && item.type === 'vacature' ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleExpire(item.id)}
                          disabled={expireMutation.isPending}
                        >
                          Vacature sluiten
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <FormMessage variant="error">{error}</FormMessage>
    </div>
  );
}

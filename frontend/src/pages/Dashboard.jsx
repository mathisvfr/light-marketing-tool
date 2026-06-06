import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Briefcase,
  CheckCircle2,
  Clock,
  Megaphone,
  Send,
} from 'lucide-react';

import ChannelIndicator from '@/components/shared/ChannelIndicator';
import StatusBadge from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

function formatDate(dateValue) {
  if (!dateValue) {
    return 'Onbekend';
  }

  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateValue));
}

function typeLabel(type) {
  return type === 'marketing-post' ? 'Marketing' : 'Vacature';
}

const COUNT_CARDS = [
  {
    key: 'pendingApproval',
    label: 'Wacht op goedkeuring',
    icon: Clock,
    accent: 'text-attention',
  },
  {
    key: 'publishedThisWeek',
    label: 'Gepubliceerd deze week',
    icon: Send,
    accent: 'text-success',
  },
  {
    key: 'activeVacatures',
    label: 'Actieve vacatures',
    icon: Briefcase,
    accent: 'text-primary',
  },
];

export default function Dashboard() {
  const { role } = useAuth();
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: () => api('/dashboard/summary'),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api(`/dashboard/queue/${id}/approve`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => api(`/dashboard/queue/${id}/reject`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
  });

  if (summaryQuery.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28" />
        ))}
      </div>
    );
  }

  if (summaryQuery.isError) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Kon dashboardgegevens niet laden.
        </CardContent>
      </Card>
    );
  }

  const counts = summaryQuery.data?.counts || {
    pendingApproval: 0,
    publishedThisWeek: 0,
    activeVacatures: 0,
  };
  const approvalQueue = summaryQuery.data?.approvalQueue || [];
  const recentActivity = summaryQuery.data?.recentActivity || [];
  const channelHealth = summaryQuery.data?.channelHealth || [];
  const isMutating = approveMutation.isPending || rejectMutation.isPending;

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-3">
        {COUNT_CARDS.map(({ key, label, icon: Icon, accent }) => (
          <Card key={key}>
            <CardContent className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="mt-1 font-display text-4xl font-extrabold">
                  {counts[key] ?? 0}
                </p>
              </div>
              <Icon className={`size-9 ${accent}`} strokeWidth={1.5} />
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        {role === 'owner' ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="size-5 text-primary" />
                Goedkeuringswachtrij
              </CardTitle>
            </CardHeader>
            <CardContent>
              {approvalQueue.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Geen concepten in wachtrij.
                </p>
              ) : (
                <ul className="grid gap-3">
                  {approvalQueue.map((item) => (
                    <li
                      key={item.id}
                      className="rounded-md border border-border p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-display font-bold">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {typeLabel(item.type)} · {item.creatorName} ·{' '}
                            {formatDate(item.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          disabled={isMutating}
                          onClick={() => approveMutation.mutate(item.id)}
                        >
                          Goedkeuren
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isMutating}
                          onClick={() => rejectMutation.mutate(item.id)}
                        >
                          Afwijzen
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="size-5 text-primary" />
              Recente activiteit
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geen recente wijzigingen.
              </p>
            ) : (
              <ul className="grid gap-2">
                {recentActivity.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {typeLabel(item.type)} · {formatDate(item.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Megaphone className="size-5 text-primary" />
              Kanaalstatus
            </CardTitle>
          </CardHeader>
          <CardContent>
            {channelHealth.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nog geen kanaalstatus beschikbaar.
              </p>
            ) : (
              <ul className="flex flex-wrap gap-x-8 gap-y-3">
                {channelHealth.map((item) => (
                  <li key={item.channel} className="flex flex-col gap-1">
                    <ChannelIndicator
                      channel={item.channel}
                      status={item.status}
                      className="font-medium text-foreground"
                    />
                    <span className="pl-4 text-xs text-muted-foreground">
                      {formatDate(item.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

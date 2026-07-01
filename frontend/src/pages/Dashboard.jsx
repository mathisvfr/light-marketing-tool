import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import './dashboard.css';

const CHANNEL_LABELS = {
  buffer: 'Buffer (LinkedIn/Facebook/Instagram)',
  wordpress: 'WordPress',
  indeed: 'Indeed',
  google_mijn_bedrijf: 'Google Mijn Bedrijf',
};

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

function getStatusDotClass(status) {
  if (status === 'connected') {
    return 'status-dot success';
  }

  if (status === 'expiring') {
    return 'status-dot pending';
  }

  if (status === 'disconnected') {
    return 'status-dot failed';
  }

  return 'status-dot unknown';
}

function getChannelStatusLabel(status) {
  if (status === 'connected') {
    return 'Verbonden';
  }

  if (status === 'expiring') {
    return 'Verloopt binnenkort';
  }

  if (status === 'disconnected') {
    return 'Niet verbonden';
  }

  return status || 'Onbekend';
}

function getFeedHealthLabel(itemsWithIssues) {
  if (itemsWithIssues === 0) {
    return 'In orde';
  }

  if (itemsWithIssues < 5) {
    return 'Aandacht nodig';
  }

  return 'Actie nodig';
}

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
    return <p>Dashboard wordt geladen...</p>;
  }

  if (summaryQuery.isError) {
    return <p>Kon dashboardgegevens niet laden.</p>;
  }

  const counts = summaryQuery.data?.counts || {
    pendingApproval: 0,
    publishedThisWeek: 0,
    activeVacatures: 0,
  };
  const approvalQueue = summaryQuery.data?.approvalQueue || [];
  const recentActivity = summaryQuery.data?.recentActivity || [];
  const channelHealth = summaryQuery.data?.channelHealth || [];
  const feedHealth = summaryQuery.data?.feedHealth || null;
  const feedIssueCount = feedHealth?.itemsWithIssues || 0;

  return (
    <div className="dashboard-grid">
      <section className="dashboard-cards">
        <article className="dashboard-card">
          <h3>Wacht op goedkeuring</h3>
          <p className="dashboard-count">{counts.pendingApproval}</p>
        </article>
        <article className="dashboard-card">
          <h3>Gepubliceerd deze week</h3>
          <p className="dashboard-count">{counts.publishedThisWeek}</p>
        </article>
        <article className="dashboard-card">
          <h3>Actieve vacatures</h3>
          <p className="dashboard-count">{counts.activeVacatures}</p>
        </article>
        {role === 'owner' ? (
          <article className="dashboard-card">
            <h3>Feed gezondheid</h3>
            <p className="dashboard-count">{feedHealth?.totalItems || 0}</p>
            <p className="dashboard-meta">
              Items met issues: {feedIssueCount} · {getFeedHealthLabel(feedIssueCount)}
            </p>
            <p className="dashboard-meta">Laatste check: {formatDate(feedHealth?.generatedAt)}</p>
          </article>
        ) : null}
      </section>

      <section className="dashboard-panels">
        {role === 'owner' ? (
          <article className="dashboard-panel">
            <h3>Goedkeuringswachtrij</h3>
            {approvalQueue.length === 0 ? (
              <p>Geen concepten in wachtrij.</p>
            ) : (
              <ul className="dashboard-list">
                {approvalQueue.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <p className="dashboard-meta">
                      {item.type} · {item.creatorName} · {formatDate(item.createdAt)}
                    </p>
                    <div className="dashboard-actions">
                      <button
                        type="button"
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        onClick={() => approveMutation.mutate(item.id)}
                      >
                        Goedkeuren
                      </button>
                      <button
                        type="button"
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        onClick={() => rejectMutation.mutate(item.id)}
                      >
                        Afwijzen
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </article>
        ) : null}

        <article className="dashboard-panel">
          <h3>Recente activiteit</h3>
          {recentActivity.length === 0 ? (
            <p>Geen recente wijzigingen.</p>
          ) : (
            <ul className="dashboard-list">
              {recentActivity.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <p className="dashboard-meta">
                    {item.type} · status: {item.status} · {formatDate(item.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="dashboard-panel">
        <h3>Kanaalstatus</h3>
        {channelHealth.length === 0 ? (
          <p>Nog geen kanaalstatus beschikbaar.</p>
        ) : (
          <ul className="dashboard-list">
            {channelHealth.map((item) => (
              <li key={item.channel}>
                <strong>
                  <span className={getStatusDotClass(item.status)} />
                  {CHANNEL_LABELS[item.channel] || item.channel}
                </strong>
                <p className="dashboard-meta">
                  Laatste status: {getChannelStatusLabel(item.status)} · {formatDate(item.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

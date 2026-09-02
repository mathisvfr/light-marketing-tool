import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import Card, { CardHeader, CardBody } from '../components/shared/Card';
import '../components/shared/status-strip.css';
import '../components/shared/card.css';
import './dashboard.css';

const CHANNEL_LABELS = {
  buffer: 'Buffer (LinkedIn/Facebook/Instagram)',
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
  const { role, user } = useAuth();
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
  const teamCounts = summaryQuery.data?.teamCounts || null;
  const viewScope = summaryQuery.data?.viewScope || 'team';
  const approvalQueue = summaryQuery.data?.approvalQueue || [];
  const recentActivity = summaryQuery.data?.recentActivity || [];
  const channelHealth = summaryQuery.data?.channelHealth || [];
  const feedHealth = summaryQuery.data?.feedHealth || null;
  const feedIssueCount = feedHealth?.itemsWithIssues || 0;

  // Dashboard "Jouw" affordance (Design review): personal cards prefix "Jouw"
  // so recruiters know they're seeing their own metrics; owner sees personal
  // strip PLUS a "Team totaal" section beneath — no toggle.
  const cardsPrefix = viewScope === 'personal' ? 'Jouw' : '';
  const label = (base) => (cardsPrefix ? `${cardsPrefix} ${base.toLowerCase()}` : base);

  // Per-user onboarded flag: set once when the user creates their first draft
  // (backend auto-sets on POST /drafts). Existing users are backfilled to their
  // created_at at migration time so they never see the checklist. The old
  // "empty pipeline" proxy was fragile — deleting a draft resurrected it.
  const isEmptyDashboard = role !== 'viewer' && !user?.onboarded_at;

  return (
    <div className="dashboard-grid">
      {isEmptyDashboard ? (
        <Card tone="emphasized" padding="lg" className="dashboard-onboarding-card">
          <h3>Welkom bij Light Marketing. Aan de slag.</h3>
          <p className="dashboard-meta">
            Nog geen content in de tool. Deze drie stappen brengen je naar je eerste post.
          </p>
          <ol className="dashboard-onboarding-list">
            <li>
              <Link to="/vacature-plaatsen">Maak je eerste vacature</Link>
              <p className="dashboard-meta">Sandra publiceert vacatures via de XML feed naar Multiposter.</p>
            </li>
            <li>
              <Link to="/marketing-post">Maak je eerste marketingpost</Link>
              <p className="dashboard-meta">Liza publiceert brand content via Buffer naar LinkedIn/Facebook/Instagram.</p>
            </li>
            {role === 'owner' ? (
              <li>
                <Link to="/merk-instellingen">Controleer je merkinstellingen</Link>
                <p className="dashboard-meta">Bepaalt hoe de AI schrijft. Doe dit één keer voordat je publiceert.</p>
              </li>
            ) : null}
          </ol>
        </Card>
      ) : null}

      <section className="dashboard-cards">
        <Card padding="sm">
          <h3>{label('Wacht op goedkeuring')}</h3>
          <p className="dashboard-count">{counts.pendingApproval}</p>
        </Card>
        <Card padding="sm">
          <h3>{label('Gepubliceerd deze week')}</h3>
          <p className="dashboard-count">{counts.publishedThisWeek}</p>
        </Card>
        <Card padding="sm">
          <h3>{label('Actieve vacatures')}</h3>
          <p className="dashboard-count">{counts.activeVacatures}</p>
        </Card>
        {role === 'owner' ? (
          <Card padding="sm">
            <h3>Feed gezondheid</h3>
            <p className="dashboard-count">{feedHealth?.totalItems || 0}</p>
            <p className="dashboard-meta">
              Items met issues: {feedIssueCount} · {getFeedHealthLabel(feedIssueCount)}
            </p>
            <p className="dashboard-meta">Laatste check: {formatDate(feedHealth?.generatedAt)}</p>
          </Card>
        ) : null}
      </section>

      {teamCounts ? (
        <section className="dashboard-section">
          <h3>Team totaal</h3>
          <div className="dashboard-cards">
            <Card padding="sm" className="dashboard-card-secondary">
              <h4>Wacht op goedkeuring</h4>
              <p className="dashboard-count">{teamCounts.pendingApproval}</p>
            </Card>
            <Card padding="sm" className="dashboard-card-secondary">
              <h4>Gepubliceerd deze week</h4>
              <p className="dashboard-count">{teamCounts.publishedThisWeek}</p>
            </Card>
            <Card padding="sm" className="dashboard-card-secondary">
              <h4>Actieve vacatures</h4>
              <p className="dashboard-count">{teamCounts.activeVacatures}</p>
            </Card>
          </div>
        </section>
      ) : null}

      <section className="dashboard-panels">
        {role === 'owner' || role === 'recruiter' ? (
          <Card>
            <CardHeader title="Openstaande concepten" />
            {approvalQueue.length === 0 ? (
              <p>Geen concepten in wachtrij.</p>
            ) : (
              <ul className="dashboard-list">
                {approvalQueue.map((item) => {
                  // Row rendering branches on status: pending_approval rows keep
                  // the owner's approve/reject shortcut; draft rows just link to
                  // their edit page so the author can finish them.
                  const editPath =
                    item.type === 'marketing-post'
                      ? `/marketing-post?draftId=${item.id}`
                      : `/vacature-plaatsen?draftId=${item.id}`;

                  return (
                    <li key={item.id}>
                      <strong>{item.title}</strong>
                      <p className="dashboard-meta">
                        {item.type} · {item.creatorName} · {formatDate(item.createdAt)} · <StatusBadge status={item.status} />
                      </p>
                      <div className="dashboard-actions">
                        {item.status === 'pending_approval' && role === 'owner' ? (
                          <>
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
                          </>
                        ) : (
                          <Link to={editPath}>Bewerken</Link>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        ) : null}

        <Card>
          <CardHeader title="Recente activiteit" />
          {recentActivity.length === 0 ? (
            <p>Geen recente wijzigingen.</p>
          ) : (
            <ul className="dashboard-list">
              {recentActivity.map((item) => (
                <li key={item.id}>
                  <strong>{item.title}</strong>
                  <p className="dashboard-meta">
                    {item.type} · <StatusBadge status={item.status} /> · {formatDate(item.updatedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card>
        <CardHeader title="Kanaalstatus" />
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
      </Card>
    </div>
  );
}

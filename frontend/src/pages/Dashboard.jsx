import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import StatusBadge from '../components/shared/StatusBadge';
import ChannelStatus from '../components/shared/ChannelStatus';
import '../components/shared/status-strip.css';
import './dashboard.css';

function formatDate(dateValue) {
  if (!dateValue) return 'Onbekend';
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateValue));
}

function formatRelative(dateValue) {
  if (!dateValue) return '';
  const diff = Date.now() - new Date(dateValue).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Zojuist';
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

const CHANNEL_LABELS = {
  buffer: 'Buffer',
};

function getFeedHealthLabel(count) {
  if (count === 0) return 'Alles in orde';
  if (count < 5) return 'Aandacht nodig';
  return 'Actie nodig';
}

function getFeedHealthTone(count) {
  if (count === 0) return 'success';
  if (count < 5) return 'warning';
  return 'error';
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => api(`/dashboard/queue/${id}/reject`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] }),
  });

  if (summaryQuery.isLoading) {
    return <div className="dash"><p className="dash-loading">Dashboard wordt geladen...</p></div>;
  }

  if (summaryQuery.isError) {
    return <div className="dash"><p className="dash-error">Kon dashboardgegevens niet laden.</p></div>;
  }

  const counts = summaryQuery.data?.counts || { pendingApproval: 0, publishedThisWeek: 0, activeVacatures: 0 };
  const teamCounts = summaryQuery.data?.teamCounts || null;
  const viewScope = summaryQuery.data?.viewScope || 'team';
  const approvalQueue = summaryQuery.data?.approvalQueue || [];
  const recentActivity = summaryQuery.data?.recentActivity || [];
  const channelHealth = summaryQuery.data?.channelHealth || [];
  const feedHealth = summaryQuery.data?.feedHealth || null;
  const feedIssueCount = feedHealth?.itemsWithIssues || 0;

  const isEmptyDashboard = role !== 'viewer' && !user?.onboarded_at;
  const prefix = viewScope === 'personal' ? 'Jouw ' : '';

  return (
    <div className="dash">
      {/* Onboarding card */}
      {isEmptyDashboard && (
        <section className="dash-welcome">
          <h2>Welkom bij Light Marketing</h2>
          <p>Nog geen content in de tool. Begin met een van deze stappen:</p>
          <div className="dash-welcome-actions">
            <Link to="/vacature-plaatsen" className="dash-welcome-btn">
              <span className="dash-welcome-icon">📋</span>
              <span>
                <strong>Eerste vacature</strong>
                <small>Publiceer via de XML feed naar Multiposter</small>
              </span>
            </Link>
            <Link to="/marketing-post" className="dash-welcome-btn">
              <span className="dash-welcome-icon">📣</span>
              <span>
                <strong>Eerste marketingpost</strong>
                <small>Publiceer via Buffer naar social media</small>
              </span>
            </Link>
            {role === 'owner' && (
              <Link to="/merk-instellingen" className="dash-welcome-btn">
                <span className="dash-welcome-icon">⚙️</span>
                <span>
                  <strong>Merkinstellingen</strong>
                  <small>Bepaalt hoe de AI schrijft</small>
                </span>
              </Link>
            )}
          </div>
        </section>
      )}

      {/* Metric cards */}
      <section className="dash-metrics">
        <div className="dash-metric">
          <span className="dash-metric-label">{prefix}Wacht op goedkeuring</span>
          <span className="dash-metric-value">{counts.pendingApproval}</span>
          {counts.pendingApproval > 0 && (
            <Link to="/content-wachtrij" className="dash-metric-link">Bekijk wachtrij →</Link>
          )}
        </div>
        <div className="dash-metric">
          <span className="dash-metric-label">{prefix}Gepubliceerd deze week</span>
          <span className="dash-metric-value">{counts.publishedThisWeek}</span>
          {counts.publishedThisWeek > 0 && (
            <Link to="/gepubliceerd" className="dash-metric-link">Bekijk →</Link>
          )}
        </div>
        <div className="dash-metric">
          <span className="dash-metric-label">{prefix}Actieve vacatures</span>
          <span className="dash-metric-value">{counts.activeVacatures}</span>
        </div>
        {role === 'owner' && feedHealth && (
          <div className={`dash-metric dash-metric-${getFeedHealthTone(feedIssueCount)}`}>
            <span className="dash-metric-label">Feed gezondheid</span>
            <span className="dash-metric-value">{feedHealth.totalItems || 0}</span>
            <span className="dash-metric-sub">{getFeedHealthLabel(feedIssueCount)}</span>
          </div>
        )}
      </section>

      {/* Team totals (owner sees both personal + team) */}
      {teamCounts && (
        <section className="dash-team">
          <h3 className="dash-section-title">Team totaal</h3>
          <div className="dash-team-row">
            <div className="dash-team-stat">
              <span className="dash-team-num">{teamCounts.pendingApproval}</span>
              <span className="dash-team-label">wacht op goedkeuring</span>
            </div>
            <div className="dash-team-stat">
              <span className="dash-team-num">{teamCounts.publishedThisWeek}</span>
              <span className="dash-team-label">gepubliceerd deze week</span>
            </div>
            <div className="dash-team-stat">
              <span className="dash-team-num">{teamCounts.activeVacatures}</span>
              <span className="dash-team-label">actieve vacatures</span>
            </div>
          </div>
        </section>
      )}

      {/* Two-column panels */}
      <div className="dash-panels">
        {/* Approval queue */}
        {(role === 'owner' || role === 'recruiter') && (
          <section className="dash-panel">
            <h3 className="dash-panel-title">Openstaande concepten</h3>
            {approvalQueue.length === 0 ? (
              <p className="dash-panel-empty">Geen concepten in wachtrij.</p>
            ) : (
              <div className="dash-queue">
                {approvalQueue.map((item) => {
                  const editPath =
                    item.type === 'marketing-post'
                      ? `/marketing-post?draftId=${item.id}`
                      : item.type === 'blog'
                      ? `/blog-aanmaken?draftId=${item.id}`
                      : `/vacature-plaatsen?draftId=${item.id}`;

                  return (
                    <div key={item.id} className="dash-queue-item">
                      <div className="dash-queue-info">
                        <span className="dash-queue-title">{item.title}</span>
                        <span className="dash-queue-meta">
                          {item.type === 'marketing-post' ? 'Marketing' : item.type === 'blog' ? 'Blog' : 'Vacature'}
                          {' · '}{item.creatorName}{' · '}<StatusBadge status={item.status} />
                        </span>
                      </div>
                      <div className="dash-queue-actions">
                        {item.status === 'pending_approval' && role === 'owner' ? (
                          <>
                            <button
                              type="button"
                              className="dash-btn primary"
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              onClick={() => approveMutation.mutate(item.id)}
                            >
                              Goedkeuren
                            </button>
                            <button
                              type="button"
                              className="dash-btn ghost"
                              disabled={approveMutation.isPending || rejectMutation.isPending}
                              onClick={() => rejectMutation.mutate(item.id)}
                            >
                              Afwijzen
                            </button>
                          </>
                        ) : (
                          <Link to={editPath} className="dash-btn outline">Bewerken</Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* Recent activity */}
        <section className="dash-panel">
          <h3 className="dash-panel-title">Recente activiteit</h3>
          {recentActivity.length === 0 ? (
            <p className="dash-panel-empty">Geen recente wijzigingen.</p>
          ) : (
            <div className="dash-activity">
              {recentActivity.map((item) => (
                <div key={item.id} className="dash-activity-item">
                  <div className="dash-activity-dot" />
                  <div>
                    <span className="dash-activity-title">{item.title}</span>
                    <span className="dash-activity-meta">
                      <StatusBadge status={item.status} /> · {formatRelative(item.updatedAt)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Channel health */}
      <section className="dash-channels">
        <h3 className="dash-section-title">Kanaalstatus</h3>
        {channelHealth.length === 0 ? (
          <p className="dash-panel-empty">Nog geen kanaalstatus beschikbaar.</p>
        ) : (
          <div className="dash-channel-list">
            {channelHealth.map((item) => (
              <div key={item.channel} className="dash-channel-item">
                <ChannelStatus status={item.status} namespace="integrations" compact />
                <span className="dash-channel-name">{CHANNEL_LABELS[item.channel] || item.channel}</span>
                <span className="dash-channel-updated">{formatDate(item.updatedAt)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

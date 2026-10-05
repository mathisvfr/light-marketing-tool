import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import Card, { CardHeader, CardBody, CardLoading, CardEmpty } from '../components/shared/Card';
import '../components/shared/card.css';
import './rapportage.css';

const COLOR = {
  red: '#be1e2d',
  grey: '#787c7e',
  green: '#2f8f4e',
  amber: '#c9882f',
  blue: '#2f6f9f',
  greyMuted: '#9a9ea0',
  axis: '#9a9ea0',
  grid: '#e0e2e4',
};

const AXIS_PROPS = {
  stroke: COLOR.axis,
  fontSize: 12,
  tickLine: false,
  axisLine: false,
};

const CHANNEL_LABELS = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
  facebook_instagram: 'Facebook/Instagram',
};

function formatRelativeTime(dateStr) {
  if (!dateStr) return 'onbekend';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins} min geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} uur geleden`;
  const days = Math.floor(hours / 24);
  return `${days} dag${days !== 1 ? 'en' : ''} geleden`;
}

/** #1 Trend badge: green arrow up, red arrow down, grey dash */
function TrendBadge({ value }) {
  if (value === undefined || value === null || value === 0) return null;
  const isUp = value > 0;
  return (
    <span className={`rapportage-trend ${isUp ? 'rapportage-trend-up' : 'rapportage-trend-down'}`}>
      {isUp ? '\u2191' : '\u2193'} {Math.abs(value)}%
    </span>
  );
}

export default function Rapportage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [range, setRange] = useState('week');
  const [showTopPages, setShowTopPages] = useState(false);

  const rapportageQuery = useQuery({
    queryKey: ['rapportage', range],
    queryFn: () => api(`/rapportage?range=${range}`),
  });

  const refreshMutation = useMutation({
    mutationFn: () => api('/rapportage/refresh', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rapportage'] }),
  });

  const { vacatures, marketing, website, meta } = rapportageQuery.data || {};

  const lastUpdatedVacatures = meta?.lastUpdated?.vacatures ?? null;
  const isStale = useMemo(() => {
    if (!lastUpdatedVacatures) return false;
    const snapshotAge = new Date().getTime() - new Date(lastUpdatedVacatures).getTime();
    return snapshotAge > 36 * 60 * 60 * 1000;
  }, [lastUpdatedVacatures]);

  if (rapportageQuery.isLoading) {
    return (
      <div className="rapportage-grid">
        <div className="rapportage-tiles">
          {[0, 1, 2].map((i) => <Card key={i}><CardLoading /></Card>)}
        </div>
      </div>
    );
  }

  if (rapportageQuery.isError) {
    return (
      <Card>
        <CardBody>
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0' }}>
            Kon rapportage niet laden.
          </p>
        </CardBody>
      </Card>
    );
  }

  const contentPerWeekData = Object.entries(marketing?.contentPerWeek || {})
    .map(([week, counts]) => ({ week, ...counts }))
    .sort((a, b) => a.week.localeCompare(b.week));

  const channelData = (marketing?.channelBreakdown || []).map((row) => ({
    ...row,
    label: CHANNEL_LABELS[row.channel] || row.channel,
  }));

  const engagement = marketing?.engagement || {};
  const engTrend = marketing?.engagement_trend || {};

  // Per-channel engagement (#7)
  const engByChannel = (marketing?.engagementByChannel || []).map((row) => ({
    ...row,
    label: CHANNEL_LABELS[row.channel] || row.channel,
  }));

  // Weekly pageviews (#8)
  const weeklyData = (website?.pageviewsWeekly || []).map((w) => ({
    ...w,
    week: w.date ? new Date(w.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) : '',
  }));

  return (
    <div className="rapportage-grid">
      {/* Controls */}
      <div className="rapportage-controls">
        <select value={range} onChange={(e) => setRange(e.target.value)}>
          <option value="week">Deze week</option>
          <option value="month">Deze maand</option>
        </select>
        {(role === 'owner' || role === 'manager') && (
          <button
            type="button"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
          >
            {refreshMutation.isPending ? 'Verversen...' : 'Data verversen'}
          </button>
        )}
        {isStale && (
          <span className="rapportage-stale-chip">
            Data verouderd — laatste update {formatRelativeTime(meta?.lastUpdated?.vacatures)}
          </span>
        )}
      </div>

      {/* ━━━ SECTION 1: VACATURES ━━━ */}
      <section className="rapportage-section">
        <h2 className="rapportage-section-title">Vacatures</h2>
        <p className="rapportage-section-desc">
          Kandidaat-gericht — via XML feed + Jobit
          {meta?.lastUpdated?.vacatures && (
            <span className="rapportage-updated"> · Bijgewerkt: {formatRelativeTime(meta.lastUpdated.vacatures)}</span>
          )}
        </p>

        <div className="rapportage-tiles">
          <Card padding="sm">
            <p className="rapportage-tile-label">Actieve vacatures</p>
            <p className="rapportage-tile-value">
              {vacatures?.actief ?? 0}
              <TrendBadge value={vacatures?.actief_trend} />
            </p>
          </Card>
          <Card padding="sm">
            <p className="rapportage-tile-label">Nieuw deze week</p>
            <p className="rapportage-tile-value">
              {vacatures?.nieuwDezeWeek ?? 0}
              <TrendBadge value={vacatures?.nieuwDezeWeek_trend} />
            </p>
          </Card>
          <Card padding="sm">
            <p className="rapportage-tile-label">Sollicitaties (Jobit)</p>
            <p className="rapportage-tile-value">{vacatures?.sollicitatiesJobit ?? 0}</p>
          </Card>
          <Card padding="sm">
            <p className="rapportage-tile-label">Sollicitaties (website)</p>
            <p className="rapportage-tile-value">{vacatures?.sollicitatiesWebsite ?? 0}</p>
          </Card>
        </div>

        {/* #5 Meest bekeken vacatures */}
        {(vacatures?.topVacaturePages || []).length > 0 && (
          <Card>
            <CardHeader title="Meest bekeken vacatures" />
            <CardBody>
              <div className="rapportage-table-wrap">
                <table className="rapportage-table">
                  <thead>
                    <tr>
                      <th>Vacature</th>
                      <th>Weergaven</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacatures.topVacaturePages.map((page, i) => (
                      <tr key={i}>
                        <td>{page.url.replace('/vacatures/', '')}</td>
                        <td>{page.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        )}
      </section>

      {/* ━━━ SECTION 2: MARKETING ━━━ */}
      <section className="rapportage-section">
        <h2 className="rapportage-section-title">Marketing</h2>
        <p className="rapportage-section-desc">
          Opdrachtgever-gericht — via Buffer naar LinkedIn, Facebook, Instagram
          {meta?.lastUpdated?.marketing && (
            <span className="rapportage-updated"> · Bijgewerkt: {formatRelativeTime(meta.lastUpdated.marketing)}</span>
          )}
        </p>

        {/* #2 Compact engagement card */}
        <Card padding="sm">
          <div className="rapportage-engagement-row">
            <div className="rapportage-engagement-stat">
              <span className="rapportage-engagement-value">{marketing?.postsGepubliceerd ?? 0}</span>
              <span className="rapportage-engagement-label">Posts</span>
              <TrendBadge value={marketing?.postsGepubliceerd_trend} />
            </div>
            <div className="rapportage-engagement-stat">
              <span className="rapportage-engagement-value">{engagement.likes ?? 0}</span>
              <span className="rapportage-engagement-label">Likes</span>
              <TrendBadge value={engTrend.likes} />
            </div>
            <div className="rapportage-engagement-stat">
              <span className="rapportage-engagement-value">{engagement.comments ?? 0}</span>
              <span className="rapportage-engagement-label">Reacties</span>
              <TrendBadge value={engTrend.comments} />
            </div>
            <div className="rapportage-engagement-stat">
              <span className="rapportage-engagement-value">{engagement.reach ?? 0}</span>
              <span className="rapportage-engagement-label">Bereik</span>
              <TrendBadge value={engTrend.reach} />
            </div>
            <div className="rapportage-engagement-stat">
              <span className="rapportage-engagement-value">{engagement.clicks ?? 0}</span>
              <span className="rapportage-engagement-label">Clicks</span>
              <TrendBadge value={engTrend.clicks} />
            </div>
            <div className="rapportage-engagement-stat">
              <span className="rapportage-engagement-value">{engagement.shares ?? 0}</span>
              <span className="rapportage-engagement-label">Shares</span>
              <TrendBadge value={engTrend.shares} />
            </div>
          </div>
        </Card>

        <div className="rapportage-charts">
          <Card>
            <CardHeader title="Publicaties per kanaal" />
            <CardBody>
              {channelData.length === 0 ? (
                <CardEmpty message="Nog geen publicatiedata." />
              ) : (
                <div style={{ height: 224 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={channelData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={COLOR.grid} />
                      <XAxis dataKey="label" {...AXIS_PROPS} interval={0} />
                      <YAxis allowDecimals={false} {...AXIS_PROPS} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Legend />
                      <Bar dataKey="success" name="Gelukt" stackId="ch" fill={COLOR.green} />
                      <Bar dataKey="pending" name="In behandeling" stackId="ch" fill={COLOR.amber} />
                      <Bar dataKey="failed" name="Mislukt" stackId="ch" fill={COLOR.red} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Content per week" />
            <CardBody>
              {contentPerWeekData.length === 0 ? (
                <CardEmpty message="Nog geen weekdata." />
              ) : (
                <div style={{ height: 224 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={contentPerWeekData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={COLOR.grid} />
                      <XAxis dataKey="week" {...AXIS_PROPS} />
                      <YAxis allowDecimals={false} {...AXIS_PROPS} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Legend />
                      <Bar dataKey="vacature" name="Vacature" stackId="content" fill={COLOR.red} />
                      <Bar dataKey="marketing" name="Marketing" stackId="content" fill={COLOR.grey} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        {/* #7 Per-kanaal engagement */}
        {engByChannel.length > 0 && (
          <Card>
            <CardHeader title="Engagement per kanaal" />
            <CardBody>
              <div style={{ height: 224 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={engByChannel} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={COLOR.grid} />
                    <XAxis dataKey="label" {...AXIS_PROPS} interval={0} />
                    <YAxis allowDecimals={false} {...AXIS_PROPS} />
                    <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                    <Legend />
                    <Bar dataKey="likes" name="Likes" fill={COLOR.red} />
                    <Bar dataKey="comments" name="Reacties" fill={COLOR.blue} />
                    <Bar dataKey="reach" name="Bereik" fill={COLOR.grey} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        )}
      </section>

      {/* ━━━ SECTION 3: WEBSITE ━━━ */}
      <section className="rapportage-section">
        <h2 className="rapportage-section-title">Website</h2>
        <p className="rapportage-section-desc">
          Verkeer op lightpersoneelsdiensten.nl — via Umami
          {meta?.lastUpdated?.website && (
            <span className="rapportage-updated"> · Bijgewerkt: {formatRelativeTime(meta.lastUpdated.website)}</span>
          )}
        </p>

        <div className="rapportage-tiles">
          <Card padding="sm">
            <p className="rapportage-tile-label">Bezoekers</p>
            <p className="rapportage-tile-value">
              {website?.stats?.visitors ?? 0}
              <TrendBadge value={website?.stats_trend?.visitors} />
            </p>
          </Card>
          <Card padding="sm">
            <p className="rapportage-tile-label">Paginaweergaven</p>
            <p className="rapportage-tile-value">
              {website?.stats?.pageviews ?? 0}
              <TrendBadge value={website?.stats_trend?.pageviews} />
            </p>
          </Card>
          <Card padding="sm">
            <p className="rapportage-tile-label">Bounces</p>
            <p className="rapportage-tile-value">
              {website?.stats?.bounces ?? 0}
              <TrendBadge value={website?.stats_trend?.bounces} />
            </p>
          </Card>
        </div>

        {/* #8 Weekly visitor trend chart */}
        {weeklyData.length > 0 && (
          <Card>
            <CardHeader title="Bezoekers per week" />
            <CardBody>
              <div style={{ height: 224 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={weeklyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke={COLOR.grid} />
                    <XAxis dataKey="week" {...AXIS_PROPS} />
                    <YAxis allowDecimals={false} {...AXIS_PROPS} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="visitors" name="Bezoekers" stroke={COLOR.red} strokeWidth={2} dot={{ r: 3, fill: COLOR.red }} />
                    <Line type="monotone" dataKey="pageviews" name="Weergaven" stroke={COLOR.grey} strokeWidth={2} dot={{ r: 3, fill: COLOR.grey }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardBody>
          </Card>
        )}

        <div className="rapportage-charts">
          <Card>
            <CardHeader
              title="Populaire pagina's"
              action={
                <button
                  type="button"
                  className="rapportage-expand-btn"
                  onClick={() => setShowTopPages((v) => !v)}
                >
                  {showTopPages ? 'Inklappen' : 'Bekijk details'}
                </button>
              }
            />
            <CardBody>
              {!showTopPages ? (
                <p className="rapportage-tile-label" style={{ textAlign: 'center', padding: '1rem 0' }}>
                  {(website?.topPages || []).length} pagina&#39;s bijgehouden
                </p>
              ) : (website?.topPages || []).length === 0 ? (
                <CardEmpty message="Nog geen websitedata." />
              ) : (
                <div className="rapportage-table-wrap">
                  <table className="rapportage-table">
                    <thead>
                      <tr>
                        <th>Pagina</th>
                        <th>Weergaven</th>
                      </tr>
                    </thead>
                    <tbody>
                      {website.topPages.slice(0, 15).map((page, i) => (
                        <tr key={i}>
                          <td>{page.url}</td>
                          <td>{page.views}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Top verwijzingen" />
            <CardBody>
              {(website?.referrers || []).length === 0 ? (
                <CardEmpty message="Nog geen verwijzingsdata." />
              ) : (
                <div className="rapportage-table-wrap">
                  <table className="rapportage-table">
                    <thead>
                      <tr>
                        <th>Bron</th>
                        <th>Bezoeken</th>
                      </tr>
                    </thead>
                    <tbody>
                      {website.referrers.slice(0, 10).map((ref, i) => (
                        <tr key={i}>
                          <td>{ref.referrer || '(direct)'}</td>
                          <td>{ref.visits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}

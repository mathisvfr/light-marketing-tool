import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

const CHANNEL_LABELS = {
  linkedin: 'LinkedIn',
  facebook: 'Facebook',
  instagram: 'Instagram',
};

const YOUNG_THRESHOLD_MS = 48 * 60 * 60 * 1000;

function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (60 * 60 * 1000));
  if (hours < 1) return 'Zojuist';
  if (hours < 24) return `${hours}u geleden`;
  const days = Math.floor(hours / 24);
  return `${days}d geleden`;
}

function isYoungPost(publishedAt, nowTs) {
  if (!publishedAt || !nowTs) return false;
  return (nowTs - new Date(publishedAt).getTime()) < YOUNG_THRESHOLD_MS;
}

/** Sortable header cell — defined outside PostMetricsTable to satisfy react-hooks/static-components. */
function SortHeader({ label, field, sortKey, sortAsc, onSort }) {
  const isActive = sortKey === field;
  return (
    <th
      onClick={() => onSort(field)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {label} {isActive ? (sortAsc ? '\u2191' : '\u2193') : ''}
    </th>
  );
}

export default function PostMetricsTable({ perPost, now }) {
  const queryClient = useQueryClient();
  const [sortKey, setSortKey] = useState('publishedAt');
  const [sortAsc, setSortAsc] = useState(false);

  const refreshMutation = useMutation({
    mutationFn: (publicationId) => api(`/rapportage/post/${publicationId}/metrics`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rapportage'] }),
  });

  function handleSort(key) {
    if (sortKey === key) {
      setSortAsc((prev) => !prev);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  }

  if (!perPost || perPost.length === 0) return null;

  const sorted = [...perPost].sort((a, b) => {
    let va, vb;
    if (sortKey === 'publishedAt') {
      va = new Date(a.publishedAt || 0).getTime();
      vb = new Date(b.publishedAt || 0).getTime();
    } else if (['reach', 'likes', 'comments', 'clicks', 'shares'].includes(sortKey)) {
      va = a.metrics?.[sortKey] || 0;
      vb = b.metrics?.[sortKey] || 0;
    } else {
      va = a[sortKey] || '';
      vb = b[sortKey] || '';
    }
    if (va < vb) return sortAsc ? -1 : 1;
    if (va > vb) return sortAsc ? 1 : -1;
    return 0;
  });

  const headerProps = { sortKey, sortAsc, onSort: handleSort };

  return (
    <div className="rapportage-table-wrap">
      <table className="rapportage-table">
        <thead>
          <tr>
            <SortHeader label="Titel" field="title" {...headerProps} />
            <SortHeader label="Kanaal" field="channel" {...headerProps} />
            <SortHeader label="Gepubliceerd" field="publishedAt" {...headerProps} />
            <SortHeader label="Bereik" field="reach" {...headerProps} />
            <SortHeader label="Likes" field="likes" {...headerProps} />
            <SortHeader label="Reacties" field="comments" {...headerProps} />
            <SortHeader label="Clicks" field="clicks" {...headerProps} />
            <SortHeader label="Shares" field="shares" {...headerProps} />
            <th>Actie</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((post) => {
            const m = post.metrics || {};
            const young = isYoungPost(post.publishedAt, now);
            const noMetrics = !m.reach && !m.likes && !m.comments;
            return (
              <tr key={post.publicationId}>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {post.title}
                </td>
                <td>{CHANNEL_LABELS[post.channel] || post.channel}</td>
                <td>{formatDate(post.publishedAt)}</td>
                <td>{m.reach || 0}</td>
                <td>{m.likes || 0}</td>
                <td>{m.comments || 0}</td>
                <td>{m.clicks || 0}</td>
                <td>{m.shares || 0}</td>
                <td>
                  {young && noMetrics ? (
                    <span className="rapportage-metrics-hint" title="Metrics beschikbaar over ~24 uur">
                      ~24u
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="rapportage-expand-btn"
                      disabled={refreshMutation.isPending}
                      onClick={() => refreshMutation.mutate(post.publicationId)}
                      title={post.metricsUpdatedAt ? `Laatste update: ${formatRelativeTime(post.metricsUpdatedAt)}` : 'Metrics verversen'}
                    >
                      Verversen
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

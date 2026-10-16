// Lightweight health banner that polls /api/health every 60s.
// Only renders when something is degraded — invisible when everything is ok.

import { useQuery } from '@tanstack/react-query';

const LABELS = {
  database: 'Database',
  ai: 'AI-generatie',
  buffer: 'Buffer (social)',
};

export default function HealthBanner() {
  const healthQuery = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const res = await fetch('/api/health');
      if (!res.ok) return { status: 'down', checks: {} };
      return res.json();
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const data = healthQuery.data;
  if (!data || data.status === 'ok') return null;

  const problems = Object.entries(data.checks || {})
    .filter(([key, val]) => val !== 'ok' && key !== 'ai_provider')
    .map(([key, val]) => ({
      key,
      label: LABELS[key] || key,
      detail: val === 'no_key' ? 'API-key ontbreekt' : 'niet bereikbaar',
    }));

  if (problems.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        background: '#fef3c7',
        borderBottom: '1px solid #f59e0b',
        padding: '6px 16px',
        fontSize: '0.85rem',
        color: '#92400e',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      <span style={{ fontWeight: 600 }}>⚠ Systeemstatus:</span>
      {problems.map((p) => (
        <span key={p.key}>
          {p.label} ({p.detail})
        </span>
      ))}
    </div>
  );
}

// Lightweight health banner that polls /api/health every 60s.
// Only renders when something is degraded — invisible when everything is ok.
// Dismissible per session: dismissed problems are remembered in sessionStorage.

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

const LABELS = {
  database: 'Database',
  ai: 'AI-generatie',
  buffer: 'Buffer (social)',
};

const DISMISSED_KEY = 'health-banner-dismissed';

function getDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function HealthBanner() {
  const [dismissed, setDismissed] = useState(getDismissed);

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
    .filter(([key]) => !dismissed.includes(key))
    .map(([key, val]) => ({
      key,
      label: LABELS[key] || key,
      detail: val === 'no_key' ? 'API-key ontbreekt' : 'niet bereikbaar',
    }));

  if (problems.length === 0) return null;

  function handleDismiss() {
    const keys = problems.map((p) => p.key);
    const next = [...new Set([...dismissed, ...keys])];
    setDismissed(next);
    try { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* storage full or private mode */ }
  }

  return (
    <div
      role="alert"
      className="health-banner"
    >
      <div className="health-banner-content">
        <span className="health-banner-label">Systeemstatus:</span>
        {problems.map((p) => (
          <span key={p.key}>
            {p.label} ({p.detail})
          </span>
        ))}
      </div>
      <button
        type="button"
        className="health-banner-dismiss"
        onClick={handleDismiss}
        aria-label="Melding sluiten"
      >
        &times;
      </button>
    </div>
  );
}

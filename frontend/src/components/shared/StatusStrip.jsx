// StatusStrip toont per achtergrondtaak (criticus, afbeelding, vertalingen)
// een regel met status-bolletje + label. Wanneer alles klaar is klapt de strip
// automatisch samen tot één regel "Alles klaar". Elke rij heeft een optionele
// retry-knop zodat een uitschieter in latency geen dead-end wordt.
//
// Rows: [{ key, label, state: 'pending'|'ready'|'failed', detail?, onRetry? }]

import { useState } from 'react';

function StateDot({ state }) {
  if (state === 'ready') return <span className="status-strip-dot ready" aria-hidden="true">✓</span>;
  if (state === 'failed') return <span className="status-strip-dot failed" aria-hidden="true">✕</span>;
  return <span className="status-strip-dot pending" aria-hidden="true">⟳</span>;
}

function stateLabel(state) {
  if (state === 'ready') return 'klaar';
  if (state === 'failed') return 'mislukt';
  return 'bezig';
}

export default function StatusStrip({ rows }) {
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  const validRows = (rows || []).filter(Boolean);
  if (validRows.length === 0) return null;

  const allDone = validRows.every((row) => row.state === 'ready');
  const anyFailed = validRows.some((row) => row.state === 'failed');
  const collapsed = allDone && !manuallyExpanded;

  if (collapsed) {
    return (
      <button
        type="button"
        className="status-strip status-strip-collapsed"
        onClick={() => setManuallyExpanded(true)}
        aria-label="Toon status-details"
      >
        <span className="status-strip-dot ready" aria-hidden="true">✓</span>
        Alles klaar
      </button>
    );
  }

  return (
    <div className={`status-strip${anyFailed ? ' has-failure' : ''}`} role="status" aria-live="polite">
      {validRows.map((row) => (
        <div key={row.key} className={`status-strip-row state-${row.state}`}>
          <StateDot state={row.state} />
          <span className="status-strip-label">
            {row.label}
            {row.detail ? <span className="status-strip-detail"> · {row.detail}</span> : null}
            {!row.detail ? <span className="status-strip-detail"> · {stateLabel(row.state)}</span> : null}
          </span>
          {row.onRetry && row.state !== 'ready' ? (
            <button
              type="button"
              className="status-strip-retry"
              onClick={row.onRetry}
              aria-label={`${row.label} opnieuw controleren`}
            >
              ↻ opnieuw
            </button>
          ) : null}
        </div>
      ))}
      {allDone && manuallyExpanded ? (
        <button
          type="button"
          className="status-strip-collapse"
          onClick={() => setManuallyExpanded(false)}
        >
          Verberg
        </button>
      ) : null}
    </div>
  );
}

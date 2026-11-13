/** "Deze maand vs. vorige maand" — delta comparison for the dashboard. */
export default function MonthComparison({ stats }) {
  if (!stats) return null;

  const { current, previous } = stats;

  function delta(curr, prev) {
    const diff = curr - prev;
    if (diff === 0) return { sign: '', label: '0', pct: '0%', tone: 'neutral' };
    const pct = prev === 0 ? (curr > 0 ? '+100%' : '0%') : `${diff > 0 ? '+' : ''}${Math.round((diff / prev) * 100)}%`;
    return {
      sign: diff > 0 ? '\u25B2' : '\u25BC',
      label: diff > 0 ? `+${diff}` : `${diff}`,
      pct,
      tone: diff > 0 ? 'up' : 'down',
    };
  }

  const rows = [
    { label: 'Vacatures', curr: current.vacatures, prev: previous.vacatures },
    { label: 'Posts', curr: current.posts, prev: previous.posts },
    { label: 'Blogs', curr: current.blogs, prev: previous.blogs },
  ];

  return (
    <section className="dash-comparison">
      <h2 className="dash-section-title">Deze maand vs. vorige maand</h2>
      <div className="dash-comparison-table">
        {rows.map((row) => {
          const d = delta(row.curr, row.prev);
          return (
            <div key={row.label} className="dash-comparison-row">
              <span className="dash-comparison-label">{row.label}</span>
              <span className="dash-comparison-value">{row.curr}</span>
              <span className={`dash-comparison-delta dash-comparison-${d.tone}`}>
                {d.sign} {d.label} ({d.pct})
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

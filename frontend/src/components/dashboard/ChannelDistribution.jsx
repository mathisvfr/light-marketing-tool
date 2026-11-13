/** "Verdeling per kanaal" — horizontal stacked bar chart (pure CSS). */

const CHANNEL_COLORS = {
  'xml-feed': '#be1e2d',
  linkedin: '#0077b5',
  facebook: '#1877f2',
  instagram: '#c13584',
};

export default function ChannelDistribution({ data }) {
  if (!data || data.length === 0) return null;

  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) return null;

  return (
    <section className="dash-distribution">
      <h2 className="dash-section-title">Verdeling per kanaal</h2>
      <div className="dash-distribution-bar">
        {data.map((item) => {
          const pct = Math.round((item.count / total) * 100);
          if (pct === 0) return null;
          return (
            <div
              key={item.channel}
              className="dash-distribution-segment"
              style={{
                width: `${pct}%`,
                backgroundColor: CHANNEL_COLORS[item.channel] || '#787c7e',
              }}
              title={`${item.label}: ${item.count} (${pct}%)`}
            />
          );
        })}
      </div>
      <div className="dash-distribution-legend">
        {data.map((item) => (
          <span key={item.channel} className="dash-distribution-legend-item">
            <span
              className="dash-distribution-dot"
              style={{ backgroundColor: CHANNEL_COLORS[item.channel] || '#787c7e' }}
            />
            {item.label}: {item.count}
          </span>
        ))}
      </div>
    </section>
  );
}

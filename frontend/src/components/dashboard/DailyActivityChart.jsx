/** 30-day activity mini bar chart (pure CSS). */

export default function DailyActivityChart({ data }) {
  if (!data || data.length === 0) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <section className="dash-daily">
      <h2 className="dash-section-title">Activiteit (30 dagen)</h2>
      <div className="dash-daily-chart">
        {data.map((day) => {
          const heightPct = day.count > 0 ? Math.max((day.count / maxCount) * 100, 4) : 0;
          const dateLabel = new Date(day.date).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
          return (
            <div key={day.date} className="dash-daily-bar-wrap" title={`${dateLabel}: ${day.count} acties`}>
              <div
                className="dash-daily-bar"
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

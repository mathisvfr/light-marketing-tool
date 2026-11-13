/** "Prestaties deze maand" — compact stat blocks for the dashboard. */
export default function MonthlyStats({ stats }) {
  if (!stats) return null;

  const { current, monthLabel } = stats;

  const items = [
    { label: 'Vacatures gepubliceerd', value: current.vacatures },
    { label: 'Marketingposts gepubliceerd', value: current.posts },
    { label: 'Blogs gepubliceerd', value: current.blogs },
    { label: 'Totaal gegenereerd', value: current.totalGenerated },
  ];

  return (
    <section className="dash-monthly">
      <h2 className="dash-section-title">
        Prestaties deze maand
        <span className="dash-monthly-label">{monthLabel}</span>
      </h2>
      <div className="dash-monthly-row">
        {items.map((item) => (
          <div key={item.label} className="dash-monthly-stat">
            <span className="dash-monthly-value">{item.value}</span>
            <span className="dash-monthly-name">{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// VacancyFeed — "Enkele van onze vacatures": filter tags + JobCard grid.
function VacancyFeed({ onNav }) {
  const all = [
    { title: 'Meewerkend chauffeur', category: 'Logistiek', location: 'Rotterdam', hours: 'Fulltime', readTime: '1,2 min',
      teaser: 'Ben je graag onderweg en wil je dit combineren met je nieuwe baan? Dan is deze vacature echt iets voor jou.',
      image: 'https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=700&q=70' },
    { title: 'Medewerker snijhal (portioneren)', category: 'Productie', location: 'Rotterdam', hours: 'Fulltime', readTime: '1,1 min',
      teaser: 'Voor een totaalleverancier van kip-, wild- en gevogelteproducten zoeken wij collega’s voor de snijhal.',
      image: 'https://images.unsplash.com/photo-1606756790138-261d2b21cd75?w=700&q=70' },
    { title: 'Medewerker etiketteermachine', category: 'Productie', location: 'Rotterdam', hours: 'Fulltime', readTime: '1,3 min',
      teaser: 'Voor dezelfde opdrachtgever zoeken wij een nauwkeurige etiketteerder voor de verpakkingslijn.',
      image: 'https://images.unsplash.com/photo-1565891741441-64926e441838?w=700&q=70' },
  ];
  const [filter, setFilter] = React.useState('Alle');
  const cats = ['Alle', 'Productie', 'Logistiek', 'Schoonmaak'];
  const shown = filter === 'Alle' ? all : all.filter((v) => v.category === filter);

  return (
    <section style={{ background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '72px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
          <div>
            <span className="light-eyebrow">Vacatures</span>
            <h2 className="light-h2" style={{ marginTop: 10 }}>Enkele van onze vacatures</h2>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cats.map((c) => (
              <Tag key={c} selected={filter === c} onClick={() => setFilter(c)}>{c}</Tag>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, minHeight: 380 }}>
          {shown.map((v) => <JobCard key={v.title} {...v} onClick={() => onNav('Vacatures')} />)}
          {shown.length === 0 && (
            <p className="light-body" style={{ color: 'var(--color-text-muted)' }}>Geen openstaande vacatures in deze categorie.</p>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
          <Button variant="secondary" size="lg" iconRight="arrow-right" onClick={() => onNav('Vacatures')}>Bekijk alle vacatures</Button>
        </div>
      </div>
    </section>
  );
}

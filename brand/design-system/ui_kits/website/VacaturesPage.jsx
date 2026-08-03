// VacaturesPage — full "Vacatures" page: intro, filter + JobCard grid, "werken bij"
// expectations, and an apply CTA to vacature@lightpersoneelsdiensten.nl.
function VacaturesPage({ onNav }) {
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

  const verwachting = [
    { icon: 'flame', title: 'Echte doorzetters', body: 'Wij zoeken gemotiveerde mensen die dit productiewerk fulltime willen uitvoeren.' },
    { icon: 'shield-check', title: 'Veilig & hygiënisch', body: 'Werken volgens de strenge veiligheids- en hygiënereglementen die op de locatie gelden.' },
    { icon: 'calendar-check', title: 'Direct aan de slag', body: 'Snel schakelen via fase A van de ABU-cao — een jaar lang flexibel inzetbaar.' },
  ];

  return (
    <>
      <PageHero
        eyebrow="Vacatures"
        title="Werken bij Light"
        intro="Wij zoeken echte doorzetters die gemotiveerd zijn dit productiewerk fulltime uit te voeren. Bekijk de openstaande vacatures hieronder."
      />

      <ContentSection>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <img src="../../assets/light-logo-beeldmerk.png" alt="Light Personeelsdiensten" style={{ height: 52, width: 'auto', flex: 'none' }} />
            <div>
              <SectionEyebrow>Openstaande vacatures</SectionEyebrow>
              <h2 className="light-h2">Enkele van onze vacatures</h2>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cats.map((c) => (
              <Tag key={c} selected={filter === c} onClick={() => setFilter(c)}>{c}</Tag>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, minHeight: 380 }}>
          {shown.map((v) => <JobCard key={v.title} {...v} onClick={() => onNav('Contact')} />)}
          {shown.length === 0 && (
            <p className="light-body" style={{ color: 'var(--color-text-muted)' }}>Geen openstaande vacatures in deze categorie.</p>
          )}
        </div>
      </ContentSection>

      <ContentSection soft>
        <SectionEyebrow>Wat we vragen</SectionEyebrow>
        <h2 className="light-h2" style={{ marginBottom: 28, maxWidth: 640 }}>Wat werken bij Light betekent</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, marginBottom: 44 }}>
          {verwachting.map((v) => (
            <FeatureCard key={v.title} icon={v.icon} title={v.title}>{v.body}</FeatureCard>
          ))}
        </div>

        <div style={{ background: 'var(--light-red)', color: '#fff', borderRadius: 'var(--radius-lg)', padding: '34px 36px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 28, flexWrap: 'wrap', boxShadow: 'var(--shadow-red)' }}>
          <div>
            <h3 className="cta-title" style={{ fontFamily: 'var(--font-display)', fontSize: 24, margin: 0 }}>Geen passende vacature gevonden?</h3>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, opacity: 0.94, margin: '10px 0 0', maxWidth: 520 }}>
              Stuur een open sollicitatie — wij nemen je op in ons bestand en benaderen je zodra er een passende plek is.
            </p>
          </div>
          <a href="mailto:vacature@lightpersoneelsdiensten.nl" style={{ textDecoration: 'none' }}>
            <Button variant="secondary" size="lg" notch iconRight="send">Stuur je sollicitatie</Button>
          </a>
        </div>
      </ContentSection>
    </>
  );
}

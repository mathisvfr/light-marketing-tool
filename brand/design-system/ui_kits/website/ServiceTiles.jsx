// ServiceTiles — the three top-level service cards from the live site.
function ServiceTiles({ onNav }) {
  const tiles = [
    {
      title: 'Light Personeelsdiensten B.V.',
      image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=700&q=70',
      body: 'Wij zetten al jaren medewerkers in van het begin tot aan het eindproduct. Het vinden van deze specifieke mensen is een vak apart — en laat dit nu net ons vak zijn.',
      to: 'Over ons',
    },
    {
      title: 'Werken bij…',
      image: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=700&q=70',
      body: 'Wij zoeken echte doorzetters die gemotiveerd zijn dit productiewerk fulltime uit te voeren, onder de geldende veiligheids- en hygiëneregels op locatie.',
      to: 'Vacatures',
    },
    {
      title: 'Zakelijke diensten',
      image: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=700&q=70',
      body: 'Door onze kennis van de branche weten wij wat er speelt op de markt én op de werkvloer. Wij geven persoonlijk advies dat aansluit bij uw bedrijf.',
      to: 'Zakelijke diensten',
    },
  ];
  return (
    <section style={{ background: 'var(--color-bg-soft)', borderTop: '1px solid var(--color-border)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '72px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
          {tiles.map((t) => (
            <Card key={t.title} image={t.image} imageAlt={t.title} interactive padding={26} onClick={() => onNav(t.to)} style={{ display: 'flex', flexDirection: 'column' }}>
              <h3 className="light-h3" style={{ marginBottom: 12 }}>{t.title}</h3>
              <p className="light-body" style={{ fontSize: 14.5, color: 'var(--color-text-muted)', margin: '0 0 18px', flex: 1 }}>{t.body}</p>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14.5, color: 'var(--light-red)' }}>
                Lees meer <i data-lucide="arrow-right" style={{ width: 16, height: 16 }} />
              </span>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}

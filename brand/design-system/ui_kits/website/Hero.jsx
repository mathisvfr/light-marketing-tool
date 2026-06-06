// Hero — two-column: brand statement + production photo with notched badge.
function Hero({ onNav }) {
  const sectors = [
    { icon: 'factory', label: 'Productie' },
    { icon: 'truck', label: 'Logistiek' },
    { icon: 'spray-can', label: 'Schoonmaak' },
  ];
  return (
    <section style={{ background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '72px 24px', display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 56, alignItems: 'center' }}>
        <div>
          <span className="light-eyebrow">Light Personeelsdiensten B.V.</span>
          <h1 className="light-h1" style={{ fontSize: 'var(--fs-h1)', marginTop: 14, marginBottom: 20 }}>
            Specialist in het uitzenden van productie&#8209;, logistiek en schoonmaakpersoneel
          </h1>
          <p className="light-lead" style={{ maxWidth: 520, marginBottom: 28 }}>
            Omdat wij al jarenlang medewerkers inzetten van het begin tot aan het eindproduct, kennen wij de klappen van de zweep. De productie moet draaien, punt.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 30 }}>
            <Button variant="primary" size="lg" iconRight="arrow-right" onClick={() => onNav('Vacatures')}>Bekijk vacatures</Button>
            <Button variant="outline" size="lg" onClick={() => onNav('Zakelijke diensten')}>Voor opdrachtgevers</Button>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {sectors.map((s) => (
              <span key={s.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-pill)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13.5, color: 'var(--grey-700)' }}>
                <i data-lucide={s.icon} style={{ width: 15, height: 15, color: 'var(--light-red)' }} />{s.label}
              </span>
            ))}
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', height: 420 }}>
            <img src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=900&q=70" alt="Logistiek magazijn" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
          <div style={{ position: 'absolute', left: -14, bottom: 28, background: 'var(--light-red)', color: '#fff', padding: '16px 22px', clipPath: 'var(--clip-notch)', boxShadow: 'var(--shadow-red)' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, lineHeight: 1.1 }}>SNA-gecertificeerd</div>
            <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 3 }}>Stichting Normering Arbeid</div>
          </div>
        </div>
      </div>
    </section>
  );
}

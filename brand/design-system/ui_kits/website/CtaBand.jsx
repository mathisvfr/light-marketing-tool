// CtaBand — full-width red call to action with the notched-corner motif.
function CtaBand({ onNav, statement = 'Wij houden de productie draaiend.' }) {
  return (
    <section style={{ background: 'var(--light-red)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '56px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <img src="../../assets/light-logo-white.png" alt="Light Personeelsdiensten" style={{ height: 92, width: 'auto', flex: 'none', opacity: 0.96 }} />
          <div style={{ color: '#fff' }}>
            <h2 className="cta-title" style={{ fontFamily: 'var(--font-display)', fontSize: 30, lineHeight: 1.12, margin: 0 }}>{statement}</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 16.5, opacity: 0.94, margin: '12px 0 0', maxWidth: 560 }}>
              Personeel nodig voor productie, logistiek of schoonmaak? Wij regelen screening, planning en begeleiding op locatie.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="lg" notch icon="phone" onClick={() => onNav('Contact')}>Neem contact op</Button>
        </div>
      </div>
    </section>
  );
}

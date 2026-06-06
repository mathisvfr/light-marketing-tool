// CtaBand — full-width red call to action with the notched-corner motif.
function CtaBand({ onNav }) {
  return (
    <section style={{ background: 'var(--light-red)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '56px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <div style={{ color: '#fff' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30, lineHeight: 1.1, margin: 0 }}>De productie moet draaien. Punt.</h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16.5, opacity: 0.94, margin: '12px 0 0', maxWidth: 560 }}>
            Personeel nodig voor productie, logistiek of schoonmaak? Wij regelen screening, planning en begeleiding op locatie.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="lg" notch icon="phone" onClick={() => onNav('Contact')}>Neem contact op</Button>
        </div>
      </div>
    </section>
  );
}

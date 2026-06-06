// Footer — dark grey, logo + address + links + SNA certification.
function Footer({ onNav }) {
  const Col = ({ title, children }) => (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', marginBottom: 16 }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </div>
  );
  const FLink = ({ children, onClick }) => (
    <a href="#" onClick={(e) => { e.preventDefault(); onClick && onClick(); }} style={{ color: 'var(--color-text-on-dark-muted)', textDecoration: 'none', fontSize: 14.5 }}>{children}</a>
  );
  return (
    <footer style={{ background: 'var(--grey-900)', color: '#fff' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '56px 24px 32px', display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 40 }}>
        <div>
          <div style={{ background: '#fff', display: 'inline-block', padding: 12, borderRadius: 'var(--radius-md)' }}>
            <img src="../../assets/light-logo-beeldmerk.png" alt="Light Personeelsdiensten" style={{ height: 64, display: 'block' }} />
          </div>
          <p style={{ color: 'var(--color-text-on-dark-muted)', fontSize: 14.5, lineHeight: 1.7, margin: '18px 0 0' }}>
            Light Personeelsdiensten B.V.<br />Selma Lagerlöfweg 63<br />3069 BT Rotterdam
          </p>
          <a href="tel:+31107600857" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 15, textDecoration: 'none', marginTop: 14 }}>
            <i data-lucide="phone" style={{ width: 16, height: 16 }} /> +31 10 760 0857
          </a>
        </div>
        <Col title="Diensten">
          <FLink onClick={() => onNav('Over ons')}>Over ons</FLink>
          <FLink onClick={() => onNav('Zakelijke diensten')}>Zakelijke diensten</FLink>
          <FLink onClick={() => onNav('Vacatures')}>Vacatures</FLink>
        </Col>
        <Col title="Contact">
          <FLink onClick={() => onNav('Contact')}>Contact</FLink>
          <a href="mailto:administratie@lightpersoneelsdiensten.nl" style={{ color: 'var(--color-text-on-dark-muted)', textDecoration: 'none', fontSize: 14.5 }}>Opdrachtgevers</a>
          <a href="mailto:vacature@lightpersoneelsdiensten.nl" style={{ color: 'var(--color-text-on-dark-muted)', textDecoration: 'none', fontSize: 14.5 }}>Werkzoekenden</a>
        </Col>
        <Col title="Juridisch">
          <FLink>Privacy Statement</FLink>
          <FLink>Ziekteverzuim protocol</FLink>
          <FLink>Algemene voorwaarden</FLink>
        </Col>
      </div>
      <div style={{ borderTop: '1px solid var(--color-border-ondark)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--color-text-on-dark-muted)', fontSize: 13 }}>
            <i data-lucide="badge-check" style={{ width: 16, height: 16, color: 'var(--light-red-300)' }} />
            Gecertificeerd door Stichting Normering Arbeid
          </span>
          <span style={{ color: 'var(--grey-500)', fontSize: 12.5 }}>© 2026 Light Personeelsdiensten B.V.</span>
        </div>
      </div>
    </footer>
  );
}

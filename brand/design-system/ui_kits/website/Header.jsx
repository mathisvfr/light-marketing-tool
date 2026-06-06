// Header — utility strip + sticky nav. Mirrors the live site's "mail direct" row.
function Header({ onNav, active }) {
  const links = ['Home', 'Over ons', 'Zakelijke diensten', 'Vacatures', 'Contact'];
  const Social = ({ icon }) => (
    <a href="#" onClick={(e) => e.preventDefault()} style={{ display: 'inline-flex', color: '#c4c7c9' }}>
      <i data-lucide={icon} style={{ width: 15, height: 15 }} />
    </a>
  );
  return (
    <header style={{ position: 'sticky', top: 0, zIndex: 50 }}>
      {/* utility strip */}
      <div style={{ background: 'var(--grey-900)', color: '#fff' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '7px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, fontSize: 13 }}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <Social icon="facebook" /><Social icon="linkedin" /><Social icon="twitter" />
          </div>
          <div style={{ color: '#c4c7c9', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <span>mail direct:</span>
            <a href="mailto:administratie@lightpersoneelsdiensten.nl" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>opdrachtgevers</a>
            <span>of</span>
            <a href="mailto:vacature@lightpersoneelsdiensten.nl" style={{ color: '#fff', fontWeight: 600, textDecoration: 'none' }}>werkzoekenden</a>
          </div>
        </div>
      </div>
      {/* main nav */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--color-border)' }}>
        <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <a href="#" onClick={(e) => { e.preventDefault(); onNav('Home'); }} style={{ display: 'flex', alignItems: 'center' }}>
            <img src="../../assets/light-logo-beeldmerk.png" alt="Light Personeelsdiensten" style={{ height: 52 }} />
          </a>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {links.map((l) => (
              <a key={l} href="#" onClick={(e) => { e.preventDefault(); onNav(l); }}
                 style={{
                   fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
                   color: active === l ? 'var(--light-red)' : 'var(--grey-800)',
                   textDecoration: 'none', padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                 }}>
                {l}
              </a>
            ))}
            <Button variant="primary" size="sm" iconRight="arrow-right" onClick={() => onNav('Vacatures')} style={{ marginLeft: 8 }}>Vacatures</Button>
          </nav>
        </div>
      </div>
    </header>
  );
}

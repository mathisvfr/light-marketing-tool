// PageShared — building blocks reused across the Light subpages.
// Pure presentational helpers; the DS primitives (Button/Card/Tag/Input) are
// injected into scope by the index.html bootstrap.

// Page masthead: small beeldmerk + eyebrow, big title, lead, optional photo.
function PageHero({ eyebrow, title, intro, image }) {
  return (
    <section style={{ background: 'var(--grey-50)', borderBottom: '1px solid var(--color-border)' }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '64px 24px',
        display: 'grid', gridTemplateColumns: image ? '1.05fr 0.95fr' : '1fr', gap: 52, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
            <img src="../../assets/light-logo-beeldmerk.png" alt="Light Personeelsdiensten" style={{ height: 48, width: 'auto', flex: 'none' }} />
            <span className="light-eyebrow">{eyebrow}</span>
          </div>
          <h1 className="light-h1" style={{ maxWidth: 660 }}>{title}</h1>
          {intro && <p className="light-lead" style={{ marginTop: 18, maxWidth: 620 }}>{intro}</p>}
        </div>
        {image && (
          <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-md)', height: 320 }}>
            <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        )}
      </div>
    </section>
  );
}

function ContentSection({ children, soft = false, style = {} }) {
  return (
    <section style={{ background: soft ? 'var(--color-bg-soft)' : 'var(--color-bg)',
      borderTop: soft ? '1px solid var(--color-border)' : 'none', ...style }}>
      <div style={{ maxWidth: 'var(--container-max)', margin: '0 auto', padding: '64px 24px' }}>{children}</div>
    </section>
  );
}

function SectionEyebrow({ children }) {
  return <span className="light-eyebrow" style={{ display: 'block', marginBottom: 10 }}>{children}</span>;
}

function Para({ children, style = {} }) {
  return (
    <p className="light-body" style={{ fontSize: 16.5, color: 'var(--color-text-muted)', margin: '0 0 18px', maxWidth: 780, ...style }}>
      {children}
    </p>
  );
}

function CheckList({ items, columns = 1 }) {
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid',
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: '14px 28px' }}>
      {items.map((it) => (
        <li key={it} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ width: 26, height: 26, borderRadius: '999px', background: 'var(--color-primary-soft)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', marginTop: 1 }}>
            <i data-lucide="check" style={{ width: 15, height: 15, color: 'var(--light-red)' }} />
          </span>
          <span className="light-body" style={{ fontSize: 15.5, lineHeight: 1.5 }}>{it}</span>
        </li>
      ))}
    </ul>
  );
}

// Icon-on-tile feature block used inside content sections.
function FeatureCard({ icon, title, children }) {
  return (
    <Card padding={26} style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <span style={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', background: 'var(--color-primary-soft)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
        <i data-lucide={icon} style={{ width: 22, height: 22, color: 'var(--light-red)' }} />
      </span>
      <h3 className="light-h3" style={{ fontSize: 20 }}>{title}</h3>
      <p className="light-body" style={{ fontSize: 14.5, color: 'var(--color-text-muted)', margin: 0, lineHeight: 1.6 }}>{children}</p>
    </Card>
  );
}

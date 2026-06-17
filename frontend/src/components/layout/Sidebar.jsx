import { NavLink } from 'react-router-dom';

export default function Sidebar({ items }) {
  return (
    <aside
      className="app-sidebar"
      style={{
        width: '100%',
        maxWidth: 280,
        background: 'var(--grey-900, #1f2123)',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        padding: '1.25rem 1rem',
      }}
    >
      <div className="app-sidebar-brand" style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: 'var(--light-red, #be1e2d)',
            color: '#ffffff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
            fontSize: '.95rem',
            flexShrink: 0,
          }}
        >
          LP
        </div>
        <div>
          <strong style={{ display: 'block', fontSize: '1rem' }}>Light</strong>
          <span style={{ fontSize: '.8rem', opacity: 0.7 }}>
            Personeelsdiensten
          </span>
        </div>
      </div>

      <nav className="app-sidebar-nav" style={{ display: 'grid', gap: '.35rem' }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            style={({ isActive }) => ({
              color: isActive ? '#ffffff' : 'rgba(255,255,255,0.75)',
              textDecoration: 'none',
              padding: '.55rem .75rem',
              borderRadius: 8,
              background: isActive ? 'var(--light-red, #be1e2d)' : 'transparent',
              fontWeight: isActive ? 600 : 400,
              fontSize: '.925rem',
              transition: 'background .15s, color .15s',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

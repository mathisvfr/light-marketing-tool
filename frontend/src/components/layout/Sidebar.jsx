import { NavLink } from 'react-router-dom';

export default function Sidebar({ items }) {
  return (
    <aside
      className="app-sidebar"
      style={{
        width: '100%',
        maxWidth: 280,
        background: '#0b1b32',
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
            background: '#22c55e',
            color: '#052e16',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 700,
          }}
        >
          LP
        </div>
        <div>
          <strong style={{ display: 'block' }}>Light</strong>
          <span style={{ fontSize: '.875rem', opacity: 0.9 }}>
            Personeelsdiensten
          </span>
        </div>
      </div>

      <nav className="app-sidebar-nav" style={{ display: 'grid', gap: '.5rem' }}>
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              color: '#f8fafc',
              textDecoration: 'none',
              padding: '.55rem .75rem',
              borderRadius: 8,
              background: isActive ? 'rgba(255, 255, 255, 0.14)' : 'transparent',
              fontWeight: isActive ? 600 : 500,
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

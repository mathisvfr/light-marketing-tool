import { NavLink } from 'react-router-dom';

export default function Sidebar({ items, isOpen, onClose }) {
  return (
    <>
      {/* Backdrop overlay for mobile */}
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />
      )}

      <aside className={`app-sidebar${isOpen ? ' app-sidebar--open' : ''}`} aria-label="Hoofdnavigatie">
        <div className="app-sidebar-brand">
          <div className="app-sidebar-logo">LP</div>
          <div>
            <strong className="app-sidebar-title">Light</strong>
            <span className="app-sidebar-subtitle">Personeelsdiensten</span>
          </div>
        </div>

        <nav className="app-sidebar-nav">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `app-sidebar-link${isActive ? ' app-sidebar-link--active' : ''}`
              }
              onClick={onClose}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

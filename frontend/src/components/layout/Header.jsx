import { Link } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import RoleBadge from '../shared/RoleBadge';
import '../shared/status-strip.css';

function SmallAvatar({ avatarPath, name }) {
  const initials = (name || '?').charAt(0).toUpperCase();

  if (avatarPath) {
    return (
      <img
        src={avatarPath}
        alt=""
        className="app-header-avatar"
      />
    );
  }

  return (
    <div className="app-header-avatar app-header-avatar--initials">
      {initials}
    </div>
  );
}

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="3" y1="5" x2="17" y2="5" />
      <line x1="3" y1="10" x2="17" y2="10" />
      <line x1="3" y1="15" x2="17" y2="15" />
    </svg>
  );
}

export default function Header({ pageTitle, userName, role, onLogout, avatarPath, onMenuToggle }) {
  return (
    <header className="app-header">
      <div className="app-header-left">
        <button
          type="button"
          className="app-header-hamburger"
          onClick={onMenuToggle}
          aria-label="Menu openen"
        >
          <HamburgerIcon />
        </button>
        <div className="app-header-title">
          <p className="app-header-breadcrumb">Overzicht</p>
          <h1 className="app-header-heading">{pageTitle}</h1>
        </div>
      </div>

      <div className="app-header-actions">
        <NotificationBell />

        <Link to="/profiel" className="app-header-user">
          <SmallAvatar avatarPath={avatarPath} name={userName} />
          <div className="app-header-user-info">
            <strong>{userName}</strong>
            <div style={{ marginTop: '.15rem' }}>
              <RoleBadge role={role} />
            </div>
          </div>
        </Link>

        <button type="button" onClick={onLogout} className="btn-danger app-header-logout">
          Uitloggen
        </button>
      </div>
    </header>
  );
}

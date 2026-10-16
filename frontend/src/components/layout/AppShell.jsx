import { useState, useCallback } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import HealthBanner from '../shared/HealthBanner';
import Header from './Header';
import PageWrapper from './PageWrapper';
import Sidebar from './Sidebar';
import './layout.css';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/vacature-plaatsen', label: 'Vacature plaatsen' },
  { to: '/marketing-post', label: 'Marketing post' },
  { to: '/blog-aanmaken', label: 'Blog aanmaken' },
  { to: '/content-wachtrij', label: 'Content wachtrij' },
  { to: '/gepubliceerd', label: 'Gepubliceerd' },
  { to: '/kalender', label: 'Kalender' },
  { to: '/rapportage', label: 'Rapportage' },
  { to: '/merk-instellingen', label: 'Merk instellingen', ownerOnly: true },
  { to: '/gebruikers', label: 'Gebruikers', ownerOnly: true },
  { to: '/profiel', label: 'Profiel' },
];

const routeTitles = {
  '/': 'Dashboard',
  '/vacature-plaatsen': 'Vacature plaatsen',
  '/marketing-post': 'Marketing post',
  '/blog-aanmaken': 'Blog aanmaken',
  '/content-wachtrij': 'Content wachtrij',
  '/gepubliceerd': 'Gepubliceerd',
  '/kalender': 'Kalender',
  '/rapportage': 'Rapportage',
  '/merk-instellingen': 'Merk instellingen',
  '/gebruikers': 'Gebruikers',
  '/profiel': 'Profiel',
};

export default function AppShell() {
  const location = useLocation();
  const { user, role, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = useCallback(() => setSidebarOpen((o) => !o), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  const visibleNavItems = navItems.filter((item) =>
    item.ownerOnly ? role === 'owner' : true
  );

  const pageTitle = routeTitles[location.pathname] || 'Light Marketing Tool';

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Ga naar inhoud
      </a>

      <Sidebar items={visibleNavItems} isOpen={sidebarOpen} onClose={closeSidebar} />

      <div className="app-shell-main">
        <HealthBanner />
        <Header
          pageTitle={pageTitle}
          userName={user?.name || 'Onbekend'}
          role={role}
          onLogout={logout}
          avatarPath={user?.avatar_path}
          onMenuToggle={toggleSidebar}
        />

        <main id="main-content" className="app-shell-content" tabIndex={-1}>
          <PageWrapper>
            <Outlet />
          </PageWrapper>
        </main>
      </div>
    </div>
  );
}

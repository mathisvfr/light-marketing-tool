import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Header from './Header';
import PageWrapper from './PageWrapper';
import Sidebar from './Sidebar';
import './layout.css';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/vacature-plaatsen', label: 'Vacature plaatsen' },
  { to: '/marketing-post', label: 'Marketing post' },
  { to: '/content-wachtrij', label: 'Content wachtrij' },
  { to: '/gepubliceerd', label: 'Gepubliceerd' },
  { to: '/merk-instellingen', label: 'Merk instellingen', ownerOnly: true },
  { to: '/gebruikers', label: 'Gebruikers', ownerOnly: true },
];

const routeTitles = {
  '/': 'Dashboard',
  '/vacature-plaatsen': 'Vacature plaatsen',
  '/marketing-post': 'Marketing post',
  '/content-wachtrij': 'Content wachtrij',
  '/gepubliceerd': 'Gepubliceerd',
  '/merk-instellingen': 'Merk instellingen',
  '/gebruikers': 'Gebruikers',
};

export default function AppShell() {
  const location = useLocation();
  const { user, role, logout } = useAuth();

  const visibleNavItems = navItems.filter((item) =>
    item.ownerOnly ? role === 'owner' : true
  );

  const pageTitle = routeTitles[location.pathname] || 'Light Marketing Tool';

  return (
    <div className="app-shell">
      <Sidebar items={visibleNavItems} />

      <div className="app-shell-main">
        <Header
          pageTitle={pageTitle}
          userName={user?.name || 'Onbekend'}
          role={role}
          onLogout={logout}
        />

        <main className="app-shell-content">
          <PageWrapper title={pageTitle}>
            <Outlet />
          </PageWrapper>
        </main>
      </div>
    </div>
  );
}

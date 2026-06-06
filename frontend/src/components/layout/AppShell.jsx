import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { NAV_ITEMS, ROUTE_TITLES } from '../../lib/constants';
import Header from './Header';
import PageWrapper from './PageWrapper';
import Sidebar from './Sidebar';

export default function AppShell() {
  const location = useLocation();
  const { user, role, logout } = useAuth();

  const visibleNavItems = NAV_ITEMS.filter((item) =>
    item.ownerOnly ? role === 'owner' : true
  );

  const pageTitle = ROUTE_TITLES[location.pathname] || 'Light Marketing Tool';

  return (
    <div className="grid min-h-screen grid-cols-1 bg-grey-50 md:grid-cols-[260px_1fr]">
      <div className="hidden md:block">
        <Sidebar items={visibleNavItems} />
      </div>

      <div className="flex min-w-0 flex-col">
        <Header
          pageTitle={pageTitle}
          userName={user?.name || 'Onbekend'}
          role={role}
          onLogout={logout}
        />

        <main className="min-w-0 flex-1">
          <PageWrapper>
            <Outlet />
          </PageWrapper>
        </main>
      </div>
    </div>
  );
}

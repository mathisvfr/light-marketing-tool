import { lazy, Suspense } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import ErrorBoundary, { PageErrorBoundary } from './components/shared/ErrorBoundary';
import PageSkeleton from './components/shared/PageSkeleton';
import { ToastProvider } from './components/shared/Toast';
import './components/shared/toast.css';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { queryClient } from './lib/queryClient';
import { useAuth } from './hooks/useAuth';

// ── Lazy-loaded pages ──────────────────────────────────────────────
// Each page is a separate chunk — only downloaded when navigated to.
// This cuts the initial bundle by 40-60%.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const VacaturePlaatsen = lazy(() => import('./pages/VacaturePlaatsen'));
const MarketingPost = lazy(() => import('./pages/MarketingPost'));
const BlogAanmaken = lazy(() => import('./pages/BlogAanmaken'));
const ContentWachtrij = lazy(() => import('./pages/ContentWachtrij'));
const Gepubliceerd = lazy(() => import('./pages/Gepubliceerd'));
const Kalender = lazy(() => import('./pages/Kalender'));
const Rapportage = lazy(() => import('./pages/Rapportage'));
const Profiel = lazy(() => import('./pages/Profiel'));
const MerkInstellingen = lazy(() => import('./pages/MerkInstellingen'));
const Gebruikers = lazy(() => import('./pages/Gebruikers'));
const WebsiteTeksten = lazy(() => import('./pages/WebsiteTeksten'));
const EmailVerificatie = lazy(() => import('./pages/EmailVerificatie'));

// Auth pages stay eagerly loaded — they're the entry point.
import Login from './pages/Login';
import WachtwoordVergeten from './pages/WachtwoordVergeten';
import WachtwoordResetten from './pages/WachtwoordResetten';

function RoleRoute({ allowedRoles, children }) {
  const { role, isInitializing } = useAuth();

  if (isInitializing) {
    return <div style={{ padding: '2rem' }}>Sessie wordt geladen...</div>;
  }

  if (!allowedRoles.includes(role)) {
    return (
      <div style={{ padding: '2rem', color: '#b91c1c' }}>
        Je hebt geen toegang tot deze pagina.
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <AuthProvider>
            <NotificationProvider>
            <BrowserRouter>
              <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/wachtwoord-vergeten" element={<WachtwoordVergeten />} />
            <Route path="/wachtwoord-resetten" element={<WachtwoordResetten />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Suspense fallback={<PageSkeleton />}><Dashboard /></Suspense>} />
              <Route path="/vacature-plaatsen" element={<Suspense fallback={<PageSkeleton />}><PageErrorBoundary label="VacaturePlaatsen" title="Vacature plaatsen kon niet worden geladen"><VacaturePlaatsen /></PageErrorBoundary></Suspense>} />
              <Route path="/marketing-post" element={<Suspense fallback={<PageSkeleton />}><PageErrorBoundary label="MarketingPost" title="Marketing post kon niet worden geladen"><MarketingPost /></PageErrorBoundary></Suspense>} />
              <Route path="/blog-aanmaken" element={<Suspense fallback={<PageSkeleton />}><PageErrorBoundary label="BlogAanmaken" title="Blog aanmaken kon niet worden geladen"><BlogAanmaken /></PageErrorBoundary></Suspense>} />
              <Route path="/content-wachtrij" element={<Suspense fallback={<PageSkeleton />}><PageErrorBoundary label="ContentWachtrij" title="Content wachtrij kon niet worden geladen"><ContentWachtrij /></PageErrorBoundary></Suspense>} />
              <Route path="/gepubliceerd" element={<Suspense fallback={<PageSkeleton />}><PageErrorBoundary label="Gepubliceerd" title="Gepubliceerd kon niet worden geladen"><Gepubliceerd /></PageErrorBoundary></Suspense>} />
              <Route path="/kalender" element={<Suspense fallback={<PageSkeleton />}><Kalender /></Suspense>} />
              <Route path="/rapportage" element={<Suspense fallback={<PageSkeleton />}><Rapportage /></Suspense>} />
              <Route path="/profiel" element={<Suspense fallback={<PageSkeleton />}><Profiel /></Suspense>} />
              <Route path="/email-verificatie" element={<Suspense fallback={<PageSkeleton />}><EmailVerificatie /></Suspense>} />
              <Route
                path="/merk-instellingen"
                element={
                  <RoleRoute allowedRoles={['owner']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <MerkInstellingen />
                    </Suspense>
                  </RoleRoute>
                }
              />
              <Route
                path="/website-teksten"
                element={
                  <RoleRoute allowedRoles={['owner']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <WebsiteTeksten />
                    </Suspense>
                  </RoleRoute>
                }
              />
              <Route
                path="/gebruikers"
                element={
                  <RoleRoute allowedRoles={['owner']}>
                    <Suspense fallback={<PageSkeleton />}>
                      <Gebruikers />
                    </Suspense>
                  </RoleRoute>
                }
              />
            </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
            </NotificationProvider>
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

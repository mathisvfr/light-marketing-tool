import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import ErrorBoundary, { PageErrorBoundary } from './components/shared/ErrorBoundary';
import { ToastProvider } from './components/shared/Toast';
import './components/shared/toast.css';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import ContentWachtrij from './pages/ContentWachtrij';
import Dashboard from './pages/Dashboard';
import Gebruikers from './pages/Gebruikers';
import Gepubliceerd from './pages/Gepubliceerd';
import Kalender from './pages/Kalender';
import Login from './pages/Login';
import WachtwoordVergeten from './pages/WachtwoordVergeten';
import WachtwoordResetten from './pages/WachtwoordResetten';
import MarketingPost from './pages/MarketingPost';
import BlogAanmaken from './pages/BlogAanmaken';
import MerkInstellingen from './pages/MerkInstellingen';
import Rapportage from './pages/Rapportage';
import Profiel from './pages/Profiel';
import EmailVerificatie from './pages/EmailVerificatie';
import VacaturePlaatsen from './pages/VacaturePlaatsen';
import { queryClient } from './lib/queryClient';
import { useAuth } from './hooks/useAuth';

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
              <Route path="/" element={<Dashboard />} />
              <Route path="/vacature-plaatsen" element={<PageErrorBoundary label="VacaturePlaatsen" title="Vacature plaatsen kon niet worden geladen"><VacaturePlaatsen /></PageErrorBoundary>} />
              <Route path="/marketing-post" element={<PageErrorBoundary label="MarketingPost" title="Marketing post kon niet worden geladen"><MarketingPost /></PageErrorBoundary>} />
              <Route path="/blog-aanmaken" element={<PageErrorBoundary label="BlogAanmaken" title="Blog aanmaken kon niet worden geladen"><BlogAanmaken /></PageErrorBoundary>} />
              <Route path="/content-wachtrij" element={<PageErrorBoundary label="ContentWachtrij" title="Content wachtrij kon niet worden geladen"><ContentWachtrij /></PageErrorBoundary>} />
              <Route path="/gepubliceerd" element={<PageErrorBoundary label="Gepubliceerd" title="Gepubliceerd kon niet worden geladen"><Gepubliceerd /></PageErrorBoundary>} />
              <Route path="/kalender" element={<Kalender />} />
              <Route path="/rapportage" element={<Rapportage />} />
              <Route path="/profiel" element={<Profiel />} />
              <Route path="/email-verificatie" element={<EmailVerificatie />} />
              <Route
                path="/merk-instellingen"
                element={
                  <RoleRoute allowedRoles={['owner']}>
                    <MerkInstellingen />
                  </RoleRoute>
                }
              />
              <Route
                path="/gebruikers"
                element={
                  <RoleRoute allowedRoles={['owner']}>
                    <Gebruikers />
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

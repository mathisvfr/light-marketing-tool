import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import { AuthProvider } from './contexts/AuthContext';
import ContentWachtrij from './pages/ContentWachtrij';
import Dashboard from './pages/Dashboard';
import Gebruikers from './pages/Gebruikers';
import Gepubliceerd from './pages/Gepubliceerd';
import Login from './pages/Login';
import MarketingPost from './pages/MarketingPost';
import MerkInstellingen from './pages/MerkInstellingen';
import VacaturePlaatsen from './pages/VacaturePlaatsen';
import { queryClient } from './lib/queryClient';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/vacature-plaatsen" element={<VacaturePlaatsen />} />
              <Route path="/marketing-post" element={<MarketingPost />} />
              <Route path="/content-wachtrij" element={<ContentWachtrij />} />
              <Route path="/gepubliceerd" element={<Gepubliceerd />} />
              <Route path="/merk-instellingen" element={<MerkInstellingen />} />
              <Route path="/gebruikers" element={<Gebruikers />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;

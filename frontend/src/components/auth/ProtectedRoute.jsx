import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isInitializing, isAuthenticated } = useAuth();

  if (isInitializing) {
    return <div style={{ padding: '2rem' }}>Sessie wordt geladen...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

import { useContext } from 'react';
import { AuthContext } from '../contexts/auth-context';

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth moet binnen een AuthProvider gebruikt worden.');
  }

  return value;
}

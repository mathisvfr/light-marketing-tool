import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/authStore';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);

  const [isInitializing, setIsInitializing] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const data = await api('/auth/me');
      setUser(data?.user ?? null);
      return data?.user ?? null;
    } catch (_error) {
      clearUser();
      return null;
    } finally {
      setIsInitializing(false);
    }
  }, [setUser, clearUser]);

  const login = useCallback(
    async ({ email, password }) => {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      return data.user;
    },
    [setUser]
  );

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' });
    clearUser();
  }, [clearUser]);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const value = useMemo(
    () => ({
      user,
      role,
      isInitializing,
      isAuthenticated: Boolean(user),
      refreshSession,
      login,
      logout,
    }),
    [user, role, isInitializing, refreshSession, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

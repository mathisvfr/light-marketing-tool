import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  role: null,
  setUser: (user) => set({ user, role: user?.role ?? null }),
  clearUser: () => set({ user: null, role: null }),
}));

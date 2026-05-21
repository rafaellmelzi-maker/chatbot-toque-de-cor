import { create } from 'zustand';
import { authApi } from '../api/auth';

interface User {
  id: string; name: string; email: string; role: string;
  tenantId: string; storeId?: string; avatar?: string;
  store?: { id: string; name: string; code: string };
}
interface Tenant { id: string; name: string; slug: string; logo?: string; }

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, tenantSlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  tenant: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password, tenantSlug) => {
    const { data } = await authApi.login({ email, password, tenantSlug });
    localStorage.setItem('accessToken', data.data.accessToken);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    set({ user: data.data.user, tenant: data.data.tenant, isAuthenticated: true });
  },

  logout: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) await authApi.logout(refreshToken).catch(() => {});
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, tenant: null, isAuthenticated: false });
  },

  loadUser: async () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }
    try {
      const { data } = await authApi.me();
      set({ user: data.data, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('accessToken');
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));

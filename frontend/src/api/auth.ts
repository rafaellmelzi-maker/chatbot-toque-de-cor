import api from './client';

export interface LoginPayload { email: string; password: string; tenantSlug?: string; }

export const authApi = {
  login: (data: LoginPayload) => api.post('/api/auth/login', data),
  logout: (refreshToken: string) => api.post('/api/auth/logout', { refreshToken }),
  me: () => api.get('/api/auth/me'),
  refresh: (refreshToken: string) => api.post('/api/auth/refresh', { refreshToken }),
};

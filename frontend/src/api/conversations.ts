import api from './client';

export const conversationsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/api/conversations', { params }),
  getById: (id: string) => api.get(`/api/conversations/${id}`),
  transferToHuman: (id: string, sellerId?: string) =>
    api.patch(`/api/conversations/${id}/transfer`, { sellerId }),
  resolve: (id: string) => api.patch(`/api/conversations/${id}/resolve`),
  sendMessage: (id: string, message: string) =>
    api.post(`/api/conversations/${id}/messages`, { message }),
};

export const leadsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/api/leads', { params }),
  getById: (id: string) => api.get(`/api/leads/${id}`),
  update: (id: string, data: object) => api.put(`/api/leads/${id}`, data),
  updateStatus: (id: string, status: string) =>
    api.patch(`/api/leads/${id}/status`, { status }),
};

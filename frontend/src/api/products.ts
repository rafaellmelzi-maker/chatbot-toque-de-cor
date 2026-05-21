import api from './client';

export const productsApi = {
  list: (params?: Record<string, string | number>) =>
    api.get('/api/products', { params }),
  search: (q: string) => api.get('/api/products/search', { params: { q } }),
  getById: (id: string) => api.get(`/api/products/${id}`),
  create: (data: object) => api.post('/api/products', data),
  update: (id: string, data: object) => api.put(`/api/products/${id}`, data),
  remove: (id: string) => api.delete(`/api/products/${id}`),
  generateEmbedding: (id: string) => api.post(`/api/products/${id}/embed`),
};

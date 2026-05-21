import api from './client';

export const dashboardApi = {
  getStats: (period = '30d') => api.get('/api/dashboard/stats', { params: { period } }),
  getConversationsChart: (period = '30d') =>
    api.get('/api/dashboard/conversations/chart', { params: { period } }),
  getTopProducts: () => api.get('/api/dashboard/products/top'),
  getLeadsFunnel: () => api.get('/api/dashboard/leads/funnel'),
  getStorePerformance: () => api.get('/api/dashboard/stores/performance'),
};

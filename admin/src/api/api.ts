import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for API calls
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for API calls
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const login = (credentials: any) => api.post('/auth/login', credentials);
export const checkAuth = () => api.get('/auth/check');

// Users
export const getUsers = () => api.get('/users');
export const getUser = (id: number) => api.get(`/users/${id}`);
export const updateUser = (id: number, data: any) => api.put(`/users/${id}`, data);
export const deleteUser = (id: number) => api.delete(`/users/${id}`);

// Subscriptions
export const getSubscriptions = () => api.get('/subscriptions');
export const updateSubscription = (userId: number, data: any) => 
  api.put(`/subscriptions/${userId}`, data);

// Messages
export const getMessages = (category?: string) => 
  api.get('/messages', { params: { category } });
export const getMessage = (key: string) => api.get(`/messages/${key}`);
export const createOrUpdateMessage = (data: any) => api.post('/messages', data);
export const updateMessage = (key: string, data: any) => 
  api.put(`/messages/${key}`, data);
export const deleteMessage = (key: string) => api.delete(`/messages/${key}`);

// Settings
export const getSettings = () => api.get('/settings');
export const getSetting = (key: string) => api.get(`/settings/${key}`);
export const createOrUpdateSetting = (data: any) => api.post('/settings', data);
export const updateSetting = (key: string, data: any) => 
  api.put(`/settings/${key}`, data);
export const deleteSetting = (key: string) => api.delete(`/settings/${key}`);

// Principles
export const getPrinciples = () => api.get('/principles');
export const getPrinciple = (id: number) => api.get(`/principles/${id}`);
export const createPrinciple = (data: any) => api.post('/principles', data);
export const updatePrinciple = (id: number, data: any) => api.put(`/principles/${id}`, data);
export const deletePrinciple = (id: number) => api.delete(`/principles/${id}`);
export const reorderPrinciples = (ids: number[]) => api.post('/principles/reorder', { ids });

// Diary
export const getDiaryEntries = (userId?: number, principle?: number) => 
  api.get('/diary', { params: { userId, principle } });
export const getDiaryStats = () => api.get('/diary/stats');

export default api;

import axios from 'axios';

const API_BASE_URL = 'https://agrisense-z6ks.onrender.com/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const requestUrl = error.config?.url || '';

    // If weather endpoint returns 401, don't log out user — backend likely missing external API key
    if (status === 401 && requestUrl.includes('/weather')) {
      // Provide a clearer error for weather components to display
      const weatherErr = new Error('Weather service unavailable (unauthorized).');
      weatherErr.status = 401;
      return Promise.reject(weatherErr);
    }

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  signup: (userData) => api.post('/auth/signup', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  getProfile: () => api.get('/auth/profile'),
  getDistricts: () => api.get('/auth/districts'),
};

export default api;

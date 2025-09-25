import api from './api';

export const productsService = {
  // Public list with optional search and pagination
  list: async ({ page = 1, limit = 12, search = '' } = {}) => {
    const params = new URLSearchParams();
    if (page) params.set('page', page);
    if (limit) params.set('limit', limit);
    if (search) params.set('search', search);
    const url = `/products${params.toString() ? `?${params.toString()}` : ''}`;
    const { data } = await api.get(url);
    return data;
  },

  // My products (auth required)
  listMine: async () => {
    const { data } = await api.get('/products/mine');
    return data;
  },

  // Create
  create: async ({ productName, unitPrice, unit, description }) => {
    const { data } = await api.post('/products', { productName, unitPrice, unit, description });
    return data;
  },

  // Update
  update: async (id, payload) => {
    const { data } = await api.put(`/products/${id}`, payload);
    return data;
  },

  // Delete
  remove: async (id) => {
    const { data } = await api.delete(`/products/${id}`);
    return data;
  }
};

export default productsService;



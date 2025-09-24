import api from './api';

export const priceService = {
  list: async () => {
    const { data } = await api.get('/prices');
    return data.prices || [];
  },
  createOrUpsert: async ({ cropName, unit, price }) => {
    const { data } = await api.post('/prices', { cropName, unit, price });
    return data.price;
  },
  update: async (id, payload) => {
    const { data } = await api.put(`/prices/${id}`, payload);
    return data.price;
  },
  remove: async (id) => {
    const { data } = await api.delete(`/prices/${id}`);
    return data;
  },
  units: ['kg', 'mon', 'quintal', 'ton']
};

export default priceService;



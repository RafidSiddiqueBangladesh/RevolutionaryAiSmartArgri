import api from './api';

// Analytics API
export const analyticsAPI = {
  // Get farm analysis from the backend
  getFarmAnalysis: async () => {
    try {
      const response = await api.get('/analytics/farm-analysis');
      return response.data;
    } catch (error) {
      console.error('Error fetching farm analysis:', error);
      throw error;
    }
  }
};

export default analyticsAPI;
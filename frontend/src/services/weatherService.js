import api from './api';

export const weatherService = {
  // Get current weather data
  getCurrentWeather: async (latitude, longitude) => {
    try {
      const response = await api.get(`/weather/current?latitude=${latitude}&longitude=${longitude}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching current weather:', error);
      throw error;
    }
  },

  // Get weather forecast
  getForecast: async (latitude, longitude) => {
    try {
      const response = await api.get(`/weather/forecast?latitude=${latitude}&longitude=${longitude}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching forecast:', error);
      throw error;
    }
  },

  // Get weather alerts
  getWeatherAlerts: async (latitude, longitude) => {
    try {
      const response = await api.get(`/weather/alerts?latitude=${latitude}&longitude=${longitude}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching weather alerts:', error);
      throw error;
    }
  }
};

export default weatherService;
const axios = require('axios');
const supabase = require('../config/database');

// OpenWeatherMap API configuration
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';

// Get current weather data for a location
const getCurrentWeather = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Check if we have cached data less than 30 minutes old
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: cachedWeather } = await supabase
      .from('weather_cache')
      .select('*')
      .eq('type', 'current')
      .eq('latitude', parseFloat(latitude).toFixed(4))
      .eq('longitude', parseFloat(longitude).toFixed(4))
      .gt('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (cachedWeather) {
      return res.json({ 
        weather: JSON.parse(cachedWeather.data),
        cached: true,
        cachedAt: cachedWeather.created_at
      });
    }

    // Fetch fresh data from OpenWeatherMap
    const response = await axios.get(`${WEATHER_API_URL}/weather`, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: WEATHER_API_KEY,
        units: 'metric'
      }
    });

    // Cache the response
    await supabase.from('weather_cache').insert({
      type: 'current',
      latitude: parseFloat(latitude).toFixed(4),
      longitude: parseFloat(longitude).toFixed(4),
      data: JSON.stringify(response.data)
    });

    res.json({ 
      weather: response.data,
      cached: false
    });
  } catch (error) {
    console.error('Weather API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch weather data' });
  }
};

// Get forecast for the next 5 days
const getForecast = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Check if we have cached data less than 3 hours old
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    
    const { data: cachedForecast } = await supabase
      .from('weather_cache')
      .select('*')
      .eq('type', 'forecast')
      .eq('latitude', parseFloat(latitude).toFixed(4))
      .eq('longitude', parseFloat(longitude).toFixed(4))
      .gt('created_at', threeHoursAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (cachedForecast) {
      return res.json({ 
        forecast: JSON.parse(cachedForecast.data),
        cached: true,
        cachedAt: cachedForecast.created_at
      });
    }

    // Fetch fresh data from OpenWeatherMap
    const response = await axios.get(`${WEATHER_API_URL}/forecast`, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: WEATHER_API_KEY,
        units: 'metric'
      }
    });

    // Process the forecast data to get daily forecasts
    const dailyForecasts = processDailyForecasts(response.data);

    // Cache the processed response
    await supabase.from('weather_cache').insert({
      type: 'forecast',
      latitude: parseFloat(latitude).toFixed(4),
      longitude: parseFloat(longitude).toFixed(4),
      data: JSON.stringify(dailyForecasts)
    });

    res.json({ 
      forecast: dailyForecasts,
      cached: false
    });
  } catch (error) {
    console.error('Weather API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch forecast data' });
  }
};

// Helper function to process 3-hour forecasts into daily forecasts
const processDailyForecasts = (forecastData) => {
  const dailyMap = new Map();
  
  forecastData.list.forEach(item => {
    const date = new Date(item.dt * 1000).toISOString().split('T')[0];
    
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        date,
        temp_min: item.main.temp_min,
        temp_max: item.main.temp_max,
        humidity: item.main.humidity,
        weather: item.weather[0],
        wind_speed: item.wind.speed,
        dt: item.dt,
        main_weather: item.weather[0].main,
        description: item.weather[0].description,
        icon: item.weather[0].icon
      });
    } else {
      const existing = dailyMap.get(date);
      existing.temp_min = Math.min(existing.temp_min, item.main.temp_min);
      existing.temp_max = Math.max(existing.temp_max, item.main.temp_max);
      // We'll keep the first weather description for simplicity
    }
  });
  
  return Array.from(dailyMap.values());
};

// Get weather alerts if available
const getWeatherAlerts = async (req, res) => {
  try {
    const { latitude, longitude } = req.query;
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    // Check if we have cached data less than 1 hour old
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: cachedAlerts } = await supabase
      .from('weather_cache')
      .select('*')
      .eq('type', 'alerts')
      .eq('latitude', parseFloat(latitude).toFixed(4))
      .eq('longitude', parseFloat(longitude).toFixed(4))
      .gt('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (cachedAlerts) {
      return res.json({ 
        alerts: JSON.parse(cachedAlerts.data),
        cached: true,
        cachedAt: cachedAlerts.created_at
      });
    }

    // Fetch fresh data from OpenWeatherMap
    const response = await axios.get(`${WEATHER_API_URL}/onecall`, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: WEATHER_API_KEY,
        exclude: 'current,minutely,hourly,daily',
        units: 'metric'
      }
    });

    const alerts = response.data.alerts || [];

    // Cache the response
    await supabase.from('weather_cache').insert({
      type: 'alerts',
      latitude: parseFloat(latitude).toFixed(4),
      longitude: parseFloat(longitude).toFixed(4),
      data: JSON.stringify(alerts)
    });

    res.json({ 
      alerts,
      cached: false
    });
  } catch (error) {
    console.error('Weather API error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch weather alerts' });
  }
};

module.exports = {
  getCurrentWeather,
  getForecast,
  getWeatherAlerts
};
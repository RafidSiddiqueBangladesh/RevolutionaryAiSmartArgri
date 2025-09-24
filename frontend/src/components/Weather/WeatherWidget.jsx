import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import weatherService from '../../services/weatherService';
import './WeatherWidget.css';

const WeatherWidget = () => {
  const { user } = useAuth();
  const [currentWeather, setCurrentWeather] = useState(null);
  const [forecast, setForecast] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeatherData = async () => {
      if (!user?.latitude || !user?.longitude) {
        setError('Location data not available');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch current weather
        const currentData = await weatherService.getCurrentWeather(
          user.latitude,
          user.longitude
        );
        setCurrentWeather(currentData.weather);

        // Fetch forecast
        const forecastData = await weatherService.getForecast(
          user.latitude,
          user.longitude
        );
        setForecast(forecastData.forecast);
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching weather data:', err);
        // If backend indicates weather service unauthorized, show actionable message
        if (err?.status === 401 || (err?.message && err.message.toLowerCase().includes('weather service unavailable'))) {
          setError('Weather service unavailable. Please configure WEATHER_API_KEY on the backend.');
        } else {
          setError('Failed to load weather data');
        }
        setLoading(false);
      }
    };

    fetchWeatherData();
  }, [user]);

  if (loading) {
    return <div className="weather-loading">Loading weather data...</div>;
  }

  if (error) {
    return <div className="weather-error">{error}</div>;
  }

  // Helper function to get weather icon URL
  const getWeatherIconUrl = (iconCode) => {
    return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
  };

  // Format date for forecast display
  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  return (
    <div className="weather-widget">
      {currentWeather && (
        <div className="current-weather">
          <h3>Current Weather</h3>
          <div className="weather-main">
            <img 
              src={getWeatherIconUrl(currentWeather.weather[0].icon)} 
              alt={currentWeather.weather[0].description} 
              className="weather-icon"
            />
            <div className="weather-info">
              <div className="temperature">
                {Math.round(currentWeather.main.temp)}°C
              </div>
              <div className="description">
                {currentWeather.weather[0].description}
              </div>
            </div>
          </div>
          <div className="weather-details">
            <div className="detail">
              <span className="label">Feels like:</span>
              <span className="value">{Math.round(currentWeather.main.feels_like)}°C</span>
            </div>
            <div className="detail">
              <span className="label">Humidity:</span>
              <span className="value">{currentWeather.main.humidity}%</span>
            </div>
            <div className="detail">
              <span className="label">Wind:</span>
              <span className="value">{Math.round(currentWeather.wind.speed * 3.6)} km/h</span>
            </div>
          </div>
        </div>
      )}

      {forecast.length > 0 && (
        <div className="weather-forecast">
          <h3>5-Day Forecast</h3>
          <div className="forecast-container">
            {forecast.slice(0, 5).map((day, index) => (
              <div key={index} className="forecast-day">
                <div className="forecast-date">{formatDate(day.date)}</div>
                <img 
                  src={getWeatherIconUrl(day.icon)} 
                  alt={day.description} 
                  className="forecast-icon"
                />
                <div className="forecast-temp">
                  <span className="max">{Math.round(day.temp_max)}°</span>
                  <span className="min">{Math.round(day.temp_min)}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WeatherWidget;

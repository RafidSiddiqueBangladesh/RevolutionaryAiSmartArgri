import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SensorOverview = ({ user }) => {
  const [sensorData, setSensorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSensorData();
    // Refresh data every 30 seconds
    const interval = setInterval(fetchSensorData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchSensorData = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/device/sensor-data', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSensorData(response.data.sensorData);
      setError('');
    } catch (error) {
      console.error('Failed to fetch sensor data:', error);
      setError('Failed to load sensor data');
    } finally {
      setLoading(false);
    }
  };

  const getMoistureStatus = (moisture) => {
    if (moisture >= 85) return { text: 'Very Wet', color: '#007bff', icon: '💦' };
    if (moisture >= 65) return { text: 'Wet', color: '#17a2b8', icon: '💧' };
    if (moisture >= 45) return { text: 'Optimal', color: '#28a745', icon: '✅' };
    if (moisture >= 25) return { text: 'Dry', color: '#ffc107', icon: '⚠️' };
    return { text: 'Very Dry', color: '#dc3545', icon: '🔥' };
  };

  const getPhStatus = (ph) => {
    if (ph < 6.0) return { text: 'Acidic', color: '#dc3545' };
    if (ph > 8.0) return { text: 'Alkaline', color: '#ffc107' };
    return { text: 'Optimal', color: '#28a745' };
  };

  const getTempStatus = (temp) => {
    if (temp < 18) return { text: 'Cold', color: '#007bff' };
    if (temp > 30) return { text: 'Hot', color: '#dc3545' };
    return { text: 'Good', color: '#28a745' };
  };

  if (loading) {
    return (
      <div className="sensor-overview">
        <h3>Sensor Data Overview</h3>
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading sensor data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="sensor-overview">
        <h3>Sensor Data Overview</h3>
        <div className="error-state">
          <p>{error}</p>
          <button onClick={fetchSensorData} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (sensorData.length === 0) {
    return (
      <div className="sensor-overview">
        <h3>Sensor Data Overview</h3>
        <div className="no-data-state">
          <p>No sensor data available</p>
          <p>Link a device and wait for data to start flowing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="sensor-overview">
      <div className="overview-header">
        <h3>Sensor Data Overview</h3>
        <button onClick={fetchSensorData} className="refresh-btn">
          Refresh
        </button>
      </div>

      <div className="sensor-cards-grid">
        {sensorData.map((sensor, index) => {
          const moistureStatus = getMoistureStatus(sensor.moisture_level);
          const phStatus = getPhStatus(sensor.ph_level);
          const tempStatus = getTempStatus(sensor.temperature);

          return (
            <div key={sensor.device_id} className="sensor-card">
              <div className="sensor-card-header">
                <h4>Device {index + 1}</h4>
                <span className="last-updated">
                  {new Date(sensor.last_updated).toLocaleTimeString()}
                </span>
              </div>

              <div className="sensor-metrics">
                {/* Primary Metric - Moisture */}
                <div className="metric-primary">
                  <div className="metric-icon">{moistureStatus.icon}</div>
                  <div className="metric-content">
                    <div className="metric-value">{sensor.moisture_level}%</div>
                    <div className="metric-label">Soil Moisture</div>
                    <div 
                      className="metric-status"
                      style={{ color: moistureStatus.color }}
                    >
                      {moistureStatus.text}
                    </div>
                  </div>
                </div>

                {/* Secondary Metrics */}
                <div className="metrics-grid">
                  <div className="metric-item">
                    <span className="metric-small-label">pH Level</span>
                    <span className="metric-small-value">{sensor.ph_level}</span>
                    <span 
                      className="metric-small-status"
                      style={{ color: phStatus.color }}
                    >
                      {phStatus.text}
                    </span>
                  </div>
                  
                  <div className="metric-item">
                    <span className="metric-small-label">Temperature</span>
                    <span className="metric-small-value">{sensor.temperature}°C</span>
                    <span 
                      className="metric-small-status"
                      style={{ color: tempStatus.color }}
                    >
                      {tempStatus.text}
                    </span>
                  </div>
                  
                  <div className="metric-item">
                    <span className="metric-small-label">Humidity</span>
                    <span className="metric-small-value">{sensor.humidity}%</span>
                  </div>
                  
                  <div className="metric-item">
                    <span className="metric-small-label">Light</span>
                    <span className="metric-small-value">{sensor.light_intensity} lux</span>
                  </div>
                </div>
              </div>

              {/* Progress Bar for Moisture */}
              <div className="moisture-progress">
                <div className="progress-bar">
                  <div 
                    className="progress-fill"
                    style={{ 
                      width: `${sensor.moisture_level}%`,
                      backgroundColor: moistureStatus.color
                    }}
                  ></div>
                </div>
                <div className="progress-labels">
                  <span>Dry</span>
                  <span>Optimal</span>
                  <span>Wet</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SensorOverview;

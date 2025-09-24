import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Droplets } from 'lucide-react';

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
    if (moisture >= 85) return { text: 'Very Wet', level: 'very-wet' };
    if (moisture >= 65) return { text: 'Wet', level: 'wet' };
    if (moisture >= 45) return { text: 'Optimal', level: 'optimal' };
    if (moisture >= 25) return { text: 'Dry', level: 'dry' };
    return { text: 'Very Dry', level: 'very-dry' };
  };

  const getPhStatus = (ph) => {
    if (ph < 6.0) return { text: 'Acidic', level: 'bad' };
    if (ph > 8.0) return { text: 'Alkaline', level: 'warn' };
    return { text: 'Optimal', level: 'good' };
  };

  const getTempStatus = (temp) => {
    if (temp < 18) return { text: 'Cold', level: 'info' };
    if (temp > 30) return { text: 'Hot', level: 'bad' };
    return { text: 'Good', level: 'good' };
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
                  <div className="metric-icon">
                    <Droplets aria-hidden="true" />
                  </div>
                  <div className="metric-content">
                    <div className="metric-value">{sensor.moisture_level}%</div>
                    <div className="metric-label">Soil Moisture</div>
                    <div
                      className={`metric-status status-${moistureStatus.level}`}
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
                      className={`metric-small-status status-${phStatus.level}`}
                    >
                      {phStatus.text}
                    </span>
                  </div>
                  
                  <div className="metric-item">
                    <span className="metric-small-label">Temperature</span>
                    <span className="metric-small-value">{sensor.temperature}°C</span>
                    <span
                      className={`metric-small-status status-${tempStatus.level}`}
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
                    className={`progress-fill bg-${moistureStatus.level}`}
                    style={{ width: `${sensor.moisture_level}%` }}
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

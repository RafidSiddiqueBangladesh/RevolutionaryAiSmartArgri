import React, { useState, useEffect } from 'react';
import axios from 'axios';

const DeviceManager = ({ user }) => {
  const [devices, setDevices] = useState([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkForm, setLinkForm] = useState({
    apiKey: '',
    deviceName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/device/my-devices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDevices(response.data.devices);
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    }
  };

  const handleLinkDevice = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/device/link', linkForm, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess('Device linked successfully!');
      setLinkForm({ apiKey: '', deviceName: '' });
      setShowLinkForm(false);
      fetchDevices();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to link device');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkDevice = async (deviceId) => {
    if (!confirm('Are you sure you want to unlink this device?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/device/${deviceId}/unlink`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setSuccess('Device unlinked successfully!');
      fetchDevices();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to unlink device');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Online': return '#28a745';
      case 'Recently Active': return '#ffc107';
      case 'Offline': return '#dc3545';
      default: return '#6c757d';
    }
  };

  return (
    <div className="device-manager">
      <div className="device-header">
        <h3>My IoT Devices</h3>
        <button 
          onClick={() => setShowLinkForm(!showLinkForm)}
          className="btn-add-device"
        >
          {showLinkForm ? 'Cancel' : '+ Add Device'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      {showLinkForm && (
        <div className="link-device-form">
          <h4>Link New Device</h4>
          <form onSubmit={handleLinkDevice}>
            <div className="form-group">
              <label htmlFor="apiKey">Device API Key</label>
              <input
                type="text"
                id="apiKey"
                value={linkForm.apiKey}
                onChange={(e) => setLinkForm({...linkForm, apiKey: e.target.value})}
                placeholder="Enter 32-character API key"
                maxLength="32"
                required
              />
              <small>Find this key on your ESP32 device or documentation</small>
            </div>
            <div className="form-group">
              <label htmlFor="deviceName">Device Name (Optional)</label>
              <input
                type="text"
                id="deviceName"
                value={linkForm.deviceName}
                onChange={(e) => setLinkForm({...linkForm, deviceName: e.target.value})}
                placeholder="e.g., Field A Sensor, Main Farm Monitor"
              />
            </div>
            <button type="submit" disabled={loading} className="btn">
              {loading ? 'Linking...' : 'Link Device'}
            </button>
          </form>
        </div>
      )}

      <div className="devices-grid">
        {devices.length === 0 ? (
          <div className="no-devices">
            <p>No devices linked yet</p>
            <p>Click "Add Device" to link your first IoT sensor</p>
          </div>
        ) : (
          devices.map(device => (
            <div key={device.device_id} className="device-card">
              <div className="device-info">
                <h4>{device.device_name}</h4>
                <div className="device-details">
                  <span className="api-key">
                    API: {device.device_api_key.substring(0, 8)}...
                  </span>
                  <span 
                    className="device-status"
                    style={{ color: getStatusColor(device.status) }}
                  >
                    ● {device.status}
                  </span>
                </div>
                {device.last_seen && (
                  <div className="last-seen">
                    Last seen: {new Date(device.last_seen).toLocaleString()}
                  </div>
                )}
                
                {/* Sensor Data Display */}
                {device.moisture_level !== null && (
                  <div className="sensor-data">
                    <h5>Current Readings</h5>
                    <div className="sensor-grid">
                      <div className="sensor-item">
                        <span className="sensor-label">Moisture</span>
                        <span className="sensor-value">{device.moisture_level}%</span>
                      </div>
                      {device.ph_level && (
                        <div className="sensor-item">
                          <span className="sensor-label">pH Level</span>
                          <span className="sensor-value">{device.ph_level}</span>
                        </div>
                      )}
                      {device.temperature && (
                        <div className="sensor-item">
                          <span className="sensor-label">Temperature</span>
                          <span className="sensor-value">{device.temperature}°C</span>
                        </div>
                      )}
                      {device.humidity && (
                        <div className="sensor-item">
                          <span className="sensor-label">Humidity</span>
                          <span className="sensor-value">{device.humidity}%</span>
                        </div>
                      )}
                    </div>
                    {device.sensor_last_updated && (
                      <div className="sensor-updated">
                        Data updated: {new Date(device.sensor_last_updated).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="device-actions">
                <button 
                  onClick={() => handleUnlinkDevice(device.device_id)}
                  className="btn-unlink"
                >
                  Unlink
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DeviceManager;

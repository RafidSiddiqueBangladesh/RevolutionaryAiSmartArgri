import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';

const Signup = ({ onSwitchToLogin }) => {
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    fullName: '',
    mobileNumber: '',
    password: '',
    confirmPassword: '',
    cropName: '',
    districtId: '',
    landSizeAcres: ''
  });
  const [districts, setDistricts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingDistricts, setLoadingDistricts] = useState(true);
  const [locationData, setLocationData] = useState({
    latitude: null,
    longitude: null,
    address: ''
  });
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');

  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const response = await authAPI.getDistricts();
        setDistricts(response.data.districts);
      } catch (error) {
        console.error('Failed to fetch districts:', error);
        setError('Failed to load districts. Please refresh the page.');
      } finally {
        setLoadingDistricts(false);
      }
    };

    fetchDistricts();
  }, []);

  const getLocation = async () => {
    setLocationLoading(true);
    setLocationError(''); // Clear any previous errors immediately

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this browser');
      setLocationLoading(false);
      return;
    }

    const locationOptions = {
      enableHighAccuracy: true,
      timeout: 15000, // Increased timeout to 15 seconds
      maximumAge: 300000 // 5 minutes
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        
        try {
          // Try to get a readable address using reverse geocoding
          let address = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          
          try {
            // Using a free geocoding service (no API key required)
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.locality || data.city) {
                address = `${data.locality || data.city}, ${data.principalSubdivision || data.countryName}`;
              } else if (data.plusCode) {
                address = data.plusCode;
              }
            }
          } catch (geocodeError) {
            console.log('Geocoding failed, using coordinates');
          }

          setLocationData({
            latitude,
            longitude,
            address
          });
          setLocationError(''); // Clear any previous errors
          setLocationLoading(false);
        } catch (error) {
          console.error('Error processing location:', error);
          setLocationData({
            latitude,
            longitude,
            address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          });
          setLocationError(''); // Clear any previous errors
          setLocationLoading(false);
        }
      },
      (error) => {
        let errorMessage = 'Unable to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access and try again.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check your GPS settings.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage = 'Failed to get location. Please try again.';
        }
        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      locationOptions
    );
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long');
      setLoading(false);
      return;
    }

    // Convert districtId to number and add location data
    const submitData = {
      ...formData,
      districtId: parseInt(formData.districtId),
      landSizeAcres: parseFloat(formData.landSizeAcres),
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      locationAddress: locationData.address
    };

    const result = await signup(submitData);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1>AgriSense</h1>
        <p>Join thousands of farmers using smart agriculture technology.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="fullName">Full Name</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            placeholder="Enter your full name"
            value={formData.fullName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="mobileNumber">Mobile Number</label>
          <input
            type="tel"
            id="mobileNumber"
            name="mobileNumber"
            placeholder="+8801XXXXXXXXX"
            value={formData.mobileNumber}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            placeholder="Enter your password (min 6 characters)"
            value={formData.password}
            onChange={handleChange}
            required
            minLength="6"
          />
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            placeholder="Confirm your password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            minLength="6"
          />
        </div>

        <div className="form-group">
          <label htmlFor="cropName">Crop Name</label>
          <input
            type="text"
            id="cropName"
            name="cropName"
            placeholder="e.g., Rice, Wheat, Jute"
            value={formData.cropName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="districtId">District</label>
          <select
            id="districtId"
            name="districtId"
            value={formData.districtId}
            onChange={handleChange}
            required
            disabled={loadingDistricts}
          >
            <option value="">
              {loadingDistricts ? 'Loading districts...' : 'Select your district'}
            </option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="landSizeAcres">Land Size (Acres)</label>
          <input
            type="number"
            id="landSizeAcres"
            name="landSizeAcres"
            placeholder="e.g., 2.5"
            step="0.01"
            min="0.01"
            max="10000"
            value={formData.landSizeAcres}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label>Farm Location (for weather updates)</label>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '10px' }}>
            <button
              type="button"
              onClick={getLocation}
              disabled={locationLoading}
              className={`location-btn ${locationData.latitude ? 'success' : locationLoading ? 'loading' : 'default'}`}
            >
              {locationLoading && (
                <span className="spinner"></span>
              )}
              {locationLoading 
                ? 'Getting Location...' 
                : locationData.latitude 
                  ? 'Location Captured' 
                  : 'Get My Location'
              }
            </button>
          </div>
          
          {locationError && (
            <div style={{ 
              color: '#dc3545', 
              fontSize: '14px', 
              marginBottom: '10px',
              padding: '8px',
              background: '#f8d7da',
              border: '1px solid #f5c6cb',
              borderRadius: '4px'
            }}>
              {locationError}
            </div>
          )}
          
          {locationData.latitude && (
            <div style={{ 
              color: '#155724', 
              fontSize: '14px',
              padding: '8px',
              background: '#d4edda',
              border: '1px solid #c3e6cb',
              borderRadius: '4px'
            }}>
              <strong>Location:</strong> {locationData.address}
              <br />
              <small>Lat: {locationData.latitude.toFixed(6)}, Lng: {locationData.longitude.toFixed(6)}</small>
            </div>
          )}
          
          <small style={{ color: '#666', fontSize: '12px' }}>
            We use your location to provide accurate weather forecasts and farming recommendations.
          </small>
        </div>

        <button type="submit" className="btn" disabled={loading || loadingDistricts}>
          {loading ? 'Creating Account...' : 'Create Account'}
        </button>
      </form>

      <div className="auth-switch">
        <p>
          Already have an account? {' '}
          <button type="button" onClick={onSwitchToLogin}>
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
};

export default Signup;

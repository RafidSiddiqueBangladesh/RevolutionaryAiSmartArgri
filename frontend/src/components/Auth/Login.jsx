import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const Login = ({ onSwitchToSignup }) => {
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    mobileNumber: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

    const result = await login(formData);
    
    if (!result.success) {
      setError(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="auth-container">
      <div className="auth-header">
        <h1>AgriSense</h1>
        <p>Welcome back! Please sign in to continue.</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
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
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="auth-switch">
        <p>
          New farmer? {' '}
          <button type="button" onClick={onSwitchToSignup}>
            Create an account
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;

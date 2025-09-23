import React from 'react';
import { useAuth } from '../../context/AuthContext';

const Dashboard = () => {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="dashboard-fullscreen">
      {/* Top Navigation Bar */}
      <div className="dashboard-navbar">
        <div className="navbar-left">
          <h1 className="navbar-title">AgriSense</h1>
          <span className="navbar-subtitle">Smart Farming Platform</span>
        </div>
        <div className="navbar-center">
          <div className="date-time">
            <span className="current-date">{getCurrentDate()}</span>
            <span className="current-time">{getCurrentTime()}</span>
          </div>
        </div>
        <div className="navbar-right">
          <div className="user-profile">
            <span className="user-name">{user?.fullName}</span>
            <span className="user-role">{user?.role}</span>
          </div>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="dashboard-main">
        {/* Left Sidebar - User Info */}
        <div className="dashboard-sidebar">
          <div className="sidebar-section">
            <h3 className="section-title">Profile Information</h3>
            <div className="profile-details">
              <div className="profile-item">
                <span className="profile-label">Full Name</span>
                <span className="profile-value">{user?.fullName}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Mobile Number</span>
                <span className="profile-value">{user?.mobileNumber}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label">Role</span>
                <span className={`profile-value role-badge ${user?.role}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {user?.role === 'farmer' && (
            <div className="sidebar-section">
              <h3 className="section-title">Farm Details</h3>
              <div className="farm-details">
                <div className="farm-item">
                  <span className="farm-label">Crop Type</span>
                  <span className="farm-value">{user?.cropName}</span>
                </div>
                <div className="farm-item">
                  <span className="farm-label">District</span>
                  <span className="farm-value">{user?.district || 'Not specified'}</span>
                </div>
                <div className="farm-item">
                  <span className="farm-label">Land Size</span>
                  <span className="farm-value">
                    {user?.landSizeAcres ? `${user.landSizeAcres} acres` : 'Not specified'}
                  </span>
                </div>
                {user?.locationAddress && (
                  <div className="farm-item">
                    <span className="farm-label">Location</span>
                    <span className="farm-value location">{user.locationAddress}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="dashboard-content">
          {/* Welcome Message */}
          <div className="content-sections">
            <div className="content-section">
              <h3 className="content-title">
                Welcome to AgriSense, {user?.fullName}!
              </h3>
              <div className="welcome-content">
                <p>
                  {user?.role === 'farmer' 
                    ? 'Your smart farming dashboard is ready. You can view your profile information and farm details in the sidebar.'
                    : 'Welcome to the AgriSense admin panel. You have access to manage the platform and monitor all farming activities.'
                  }
                </p>
                {user?.role === 'farmer' && (
                  <div className="farmer-summary">
                    <h4>Your Farm Summary:</h4>
                    <ul>
                      <li><strong>Crop:</strong> {user?.cropName}</li>
                      <li><strong>Location:</strong> {user?.district}</li>
                      <li><strong>Land Size:</strong> {user?.landSizeAcres ? `${user.landSizeAcres} acres` : 'Not specified'}</li>
                      {user?.locationAddress && (
                        <li><strong>Address:</strong> {user.locationAddress}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;

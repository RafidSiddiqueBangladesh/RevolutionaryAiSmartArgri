import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import DeviceManager from './DeviceManager';
import SensorOverview from './SensorOverview';
import WeatherWidget from '../Weather/WeatherWidget';
import AnalyticsPage from '../Analytics/AnalyticsPage';
import Chatbot from '../Chatbot/Chatbot';
import ChatbotButton from '../Chatbot/ChatbotButton';
import AdminDashboard from './AdminDashboard';
import AdminPrices from './AdminPrices';
import SellPage from './Sell/SellPage';
import FarmerPrices from './FarmerPrices';
import { Sprout, LayoutDashboard, Cpu, BarChart3, User, Phone, BadgeCheck, Leaf, MapPin, Ruler, Menu, X, Banknote, ShoppingCart } from 'lucide-react';
const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);

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

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="dashboard-fullscreen">
      {/* Top Navigation Bar */}
      <div className="dashboard-navbar">
        <div className="navbar-left">
          <div className="brand-row">
            {isMobile && (
              <button className="sidebar-toggle-btn" onClick={() => setIsSidebarOpen(true)} aria-label="Open sidebar">
                <Menu />
              </button>
            )}
            <Sprout className="brand-icon" aria-hidden="true" />
            {!isMobile && <h1 className="navbar-title">AgriSense</h1>}
          </div>
          {!isMobile && <span className="navbar-subtitle">Smart Farming Platform</span>}
        </div>
        <div className="navbar-center">
          <div className={`date-time ${isMobile ? 'compact' : ''}`}>
            <span className="current-date">{isMobile ? new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : getCurrentDate()}</span>
            <span className="current-time">{getCurrentTime()}</span>
          </div>
        </div>
        <div className="navbar-right">
          {!isMobile && (
            <div className="user-profile">
              <span className="user-name">{user?.fullName}</span>
              <span className="user-role">{user?.role}</span>
            </div>
          )}
          {!isMobile && (
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          )}
        </div>
      </div>

      {/* Main Dashboard Content */}
      <div className="dashboard-main">
        {/* Sidebar Backdrop (mobile) */}
        {isMobile && (
          <div className={`sidebar-backdrop ${isSidebarOpen ? 'visible' : ''}`} onClick={() => setIsSidebarOpen(false)} />
        )}
        {/* Left Sidebar - User Info */}
        <div className={`dashboard-sidebar ${isMobile && isSidebarOpen ? 'open' : ''}`}>
          {isMobile && (
            <div className="sidebar-mobile-header">
              <h3 className="section-title">Menu</h3>
              <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)} aria-label="Close sidebar">
                <X />
              </button>
            </div>
          )}
          <div className="sidebar-section">
            <h3 className="section-title">Profile Information</h3>
            <div className="profile-details">
              <div className="profile-item">
                <span className="profile-label label-with-icon"><User className="label-icon" aria-hidden="true" /> Full Name</span>
                <span className="profile-value">{user?.fullName}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label label-with-icon"><Phone className="label-icon" aria-hidden="true" /> Mobile Number</span>
                <span className="profile-value">{user?.mobileNumber}</span>
              </div>
              <div className="profile-item">
                <span className="profile-label label-with-icon"><BadgeCheck className="label-icon" aria-hidden="true" /> Role</span>
                <span className={`profile-value role-badge ${user?.role}`}>
                  {user?.role}
                </span>
              </div>
            </div>
          </div>

          {user?.role === 'farmer' && (
            <>
              <div className="sidebar-section">
                <h3 className="section-title">Farm Details</h3>
                <div className="farm-details">
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><Leaf className="label-icon" aria-hidden="true" /> Crop Type</span>
                    <span className="farm-value">{user?.cropName}</span>
                  </div>
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><MapPin className="label-icon" aria-hidden="true" /> District</span>
                    <span className="farm-value">{user?.district || 'Not specified'}</span>
                  </div>
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><Ruler className="label-icon" aria-hidden="true" /> Land Size</span>
                    <span className="farm-value">
                      {user?.landSizeAcres ? `${user.landSizeAcres} acres` : 'Not specified'}
                    </span>
                  </div>
                  {user?.locationAddress && (
                  <div className="farm-item">
                    <span className="farm-label label-with-icon"><MapPin className="label-icon" aria-hidden="true" /> Location</span>
                    <span className="farm-value location">{user.locationAddress}</span>
                  </div>
                )}
              </div>
            </div>
            </>
          )}

          {isMobile && (
            <div className="sidebar-section sidebar-actions-mobile">
              <button onClick={handleLogout} className="btn">Logout</button>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="dashboard-content">
          {/* Tab Navigation */}
          {user?.role === 'farmer' && (
            <div className="tab-navigation">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <LayoutDashboard className="tab-icon" aria-hidden="true" />
                Overview
              </button>
              <button
                className={`tab-btn ${activeTab === 'devices' ? 'active' : ''}`}
                onClick={() => setActiveTab('devices')}
              >
                <Cpu className="tab-icon" aria-hidden="true" />
                My Devices
              </button>
              <button
                className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
                onClick={() => setActiveTab('analytics')}
              >
                <BarChart3 className="tab-icon" aria-hidden="true" />
                Analytics
              </button>
              <button
                className={`tab-btn ${activeTab === 'prices' ? 'active' : ''}`}
                onClick={() => setActiveTab('prices')}
              >
                <Banknote className="tab-icon" aria-hidden="true" />
                Prices
              </button>
              <button
                className={`tab-btn ${activeTab === 'sell' ? 'active' : ''}`}
                onClick={() => setActiveTab('sell')}
              >
                <ShoppingCart className="tab-icon" aria-hidden="true" />
                Sell
              </button>
            </div>
          )}

          {/* Admin Tab Navigation */}
          {user?.role === 'admin' && (
            <div className="tab-navigation">
              <button
                className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <LayoutDashboard className="tab-icon" aria-hidden="true" />
                Overview
              </button>
              <button
                className={`tab-btn ${activeTab === 'prices' ? 'active' : ''}`}
                onClick={() => setActiveTab('prices')}
              >
                <Banknote className="tab-icon" aria-hidden="true" />
                Prices
              </button>
            </div>
          )}

          {/* Tab Content */}
          {activeTab === 'overview' && user?.role === 'farmer' && (
            <div className="content-sections">
              <div className="content-section">
                <h3 className="content-title">
                  Welcome to AgriSense, {user?.fullName}!
                </h3>
                <div className="welcome-content">
                  <p>
                    {user?.role === 'farmer' 
                      ? 'Your smart farming dashboard is ready. Monitor your soil conditions and manage your IoT devices below.'
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
              
              {/* Weather Widget in Overview */}
              {user?.role === 'farmer' && (
                <div className="content-section">
                  <h3 className="content-title">Weather Information</h3>
                  <WeatherWidget />
                </div>
              )}
            </div>
          )}

          {activeTab === 'overview' && user?.role === 'admin' && (
            <div className="content-sections">
              <div className="content-section">
                <AdminDashboard />
              </div>
            </div>
          )}

          {activeTab === 'devices' && user?.role === 'farmer' && (
            <div className="content-sections">
              <div className="content-section">
                <DeviceManager user={user} />
              </div>
            </div>
          )}

          {activeTab === 'analytics' && user?.role === 'farmer' && (
            <div className="analytics-section">
              <AnalyticsPage />
            </div>
          )}

          {activeTab === 'prices' && user?.role === 'farmer' && (
            <div className="content-sections">
              <FarmerPrices />
            </div>
          )}

          {activeTab === 'sell' && user?.role === 'farmer' && (
            <div className="content-sections">
              <SellPage />
            </div>
          )}

          {activeTab === 'prices' && user?.role === 'admin' && (
            <div className="content-sections">
              <AdminPrices />
            </div>
          )}

        </div>
      </div>

      {/* Floating Chatbot Button - Only for farmers */}
      {user?.role === 'farmer' && (
        <>
          <ChatbotButton 
            onClick={() => setIsChatbotOpen(true)}
            hasNewMessage={false}
          />
          <Chatbot 
            isOpen={isChatbotOpen}
            onClose={() => setIsChatbotOpen(false)}
          />
        </>
      )}
    </div>
  );
};

export default Dashboard;

const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');
const weatherRoutes = require('./routes/weather');
const analyticsRoutes = require('./routes/analytics');
const voiceRoutes = require('./routes/voice');
const scheduledAnalyticsRoutes = require('./routes/scheduledAnalytics');

// Initialize scheduled analytics service
const scheduledAnalyticsService = require('./services/scheduledAnalyticsService');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/scheduled-analytics', scheduledAnalyticsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'AgriSense Backend is running!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 AgriSense Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Network access: http://0.0.0.0:${PORT}/api/health`);
  console.log(`📡 ESP32 can connect to: http://192.168.31.80:${PORT}/api/health`);
});

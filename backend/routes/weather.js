const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
const { authenticateToken } = require('../middleware/auth');

// Get current weather data
router.get('/current', authenticateToken, weatherController.getCurrentWeather);

// Get forecast data
router.get('/forecast', authenticateToken, weatherController.getForecast);

// Get weather alerts
router.get('/alerts', authenticateToken, weatherController.getWeatherAlerts);

module.exports = router;
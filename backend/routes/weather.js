const express = require('express');
const router = express.Router();
const weatherController = require('../controllers/weatherController');
const { authenticateToken } = require('../middleware/auth');

// Internal token bypass middleware for service-to-service calls
function internalBypassOrAuth(req, res, next) {
  const internalToken = req.headers['x-internal-token'];
  if (internalToken && internalToken === process.env.INTERNAL_API_TOKEN) {
    return next();
  }
  return authenticateToken(req, res, next);
}

// Get current weather data
router.get('/current', internalBypassOrAuth, weatherController.getCurrentWeather);

// Get forecast data
router.get('/forecast', internalBypassOrAuth, weatherController.getForecast);

// Get weather alerts
router.get('/alerts', internalBypassOrAuth, weatherController.getWeatherAlerts);

module.exports = router;
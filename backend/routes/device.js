const express = require('express');
const { body } = require('express-validator');
const { 
  linkDevice, 
  getUserDevices, 
  unlinkDevice, 
  receiveSensorData, 
  getSensorData 
} = require('../controllers/deviceController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const linkDeviceValidation = [
  body('apiKey')
    .isLength({ min: 32, max: 32 })
    .withMessage('API key must be exactly 32 characters'),
  body('deviceName')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Device name must be between 1 and 100 characters')
];

const sensorDataValidation = [
  body('apiKey')
    .isLength({ min: 32, max: 32 })
    .withMessage('API key must be exactly 32 characters'),
  body('moistureLevel')
    .isFloat({ min: 0, max: 100 })
    .withMessage('Moisture level must be between 0 and 100')
];

// Protected routes (require authentication)
router.post('/link', authenticateToken, linkDeviceValidation, linkDevice);
router.get('/my-devices', authenticateToken, getUserDevices);
router.delete('/:deviceId/unlink', authenticateToken, unlinkDevice);
router.get('/sensor-data', authenticateToken, getSensorData);
// Optimal ranges saved per farmer
const deviceController = require('../controllers/deviceController');
router.get('/optimal-settings', authenticateToken, deviceController.getOptimalSettings);
router.get('/optimal-settings/history', authenticateToken, deviceController.getOptimalSettingsHistory);
// Sensor history for charting
router.get('/sensor-history', authenticateToken, deviceController.getSensorHistory);

// Public routes (for ESP32 devices)
router.post('/sensor-data', sensorDataValidation, receiveSensorData);

module.exports = router;

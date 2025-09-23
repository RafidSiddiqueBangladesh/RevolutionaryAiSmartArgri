const express = require('express');
const { handleConversationWebhook } = require('../services/retellService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * Webhook endpoint for Retell AI to get real-time farm data during calls
 * This is called by Retell AI when farmer asks questions during the call
 */
router.post('/retell-webhook', async (req, res) => {
  try {
    console.log('\n🎤 ===== RETELL WEBHOOK =====');
    console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
    
    const response = await handleConversationWebhook(req.body);
    
    console.log('Response to Retell:', response);
    console.log('============================\n');
    
    res.json(response);
  } catch (error) {
    console.error('Retell webhook error:', error);
    res.status(500).json({
      response: "I'm experiencing technical difficulties, but I'm here to help with your farming questions.",
      continue_conversation: true
    });
  }
});

/**
 * Function endpoint: Get farmer data by phone number
 */
router.post('/get-farmer-data', async (req, res) => {
  try {
    console.log('\n🎤 ===== RETELL AI FUNCTION CALL =====');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    // Try different parameter names that Retell AI might use
    const phone_number = req.body.phone_number || req.body.phoneNumber || req.body.number || req.body.from_number;
    console.log(`🔍 Getting farmer data for: ${phone_number}`);
    
    if (!phone_number) {
      console.log('❌ No phone number provided in request');
      return res.json({
        success: false,
        message: "No phone number provided"
      });
    }
    
    const { getFarmerByPhoneNumber } = require('../services/retellService');
    const farmerData = await getFarmerByPhoneNumber(phone_number);
    
    if (farmerData) {
      res.json({
        success: true,
        farmer: farmerData
      });
    } else {
      res.json({
        success: false,
        message: "Farmer not found in database"
      });
    }
  } catch (error) {
    console.error('Get farmer data error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving farmer data"
    });
  }
});

/**
 * Function endpoint: Get sensor data by farmer ID
 */
router.post('/get-sensor-data', async (req, res) => {
  try {
    const { farmer_id } = req.body;
    console.log(`📊 Getting sensor data for farmer: ${farmer_id}`);
    
    const { getFreshSensorData } = require('../services/retellService');
    const sensorData = await getFreshSensorData(farmer_id);
    
    if (sensorData) {
      res.json({
        success: true,
        sensors: sensorData
      });
    } else {
      res.json({
        success: false,
        message: "No sensor data found"
      });
    }
  } catch (error) {
    console.error('Get sensor data error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving sensor data"
    });
  }
});

/**
 * Function endpoint: Get weather data by location
 */
router.post('/get-weather-data', async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    console.log(`🌤️ Getting weather data for: ${latitude}, ${longitude}`);
    
    const { getCurrentWeather } = require('../services/retellService');
    const weatherData = await getCurrentWeather(latitude, longitude);
    
    if (weatherData) {
      res.json({
        success: true,
        weather: weatherData
      });
    } else {
      res.json({
        success: false,
        message: "Weather data not available"
      });
    }
  } catch (error) {
    console.error('Get weather data error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving weather data"
    });
  }
});

/**
 * Test endpoint to manually trigger a voice call (for development)
 */
router.post('/test-call', authenticateToken, async (req, res) => {
  try {
    const { testNumber } = req.body;
    
    if (!testNumber) {
      return res.status(400).json({ error: 'Test number is required' });
    }

    // Mock farm data for testing
    const mockFarmData = {
      farmer: {
        id: req.user.id,
        name: 'Test Farmer',
        location: 'Dhaka',
        landSize: 2.5,
        mobile: testNumber
      },
      crop: {
        type: 'Rice'
      },
      sensors: {
        soilMoisture: 15, // Critical low moisture for testing
        soilPH: 6.5,
        soilTemperature: 25,
        humidity: 60,
        lightIntensity: 400,
        soilConductivity: 300,
        nutrients: {
          nitrogen: 40,
          phosphorus: 25,
          potassium: 35
        }
      },
      weather: {
        temperature: 28,
        humidity: 70,
        rainfall: 0
      },
      alert: {
        type: 'critical_drought'
      },
      device: {
        id: 'test-device-123'
      }
    };

    const { createCriticalAlertCall } = require('../services/retellService');
    const result = await createCriticalAlertCall(
      mockFarmData,
      testNumber,
      'মাটিতে পানির অভাব। দ্রুত সেচ দিন।'
    );
    
    res.json({
      success: true,
      message: 'Test voice call initiated',
      callResult: result
    });
  } catch (error) {
    console.error('Test call error:', error);
    res.status(500).json({ 
      error: 'Test call failed',
      message: error.message 
    });
  }
});

module.exports = router;

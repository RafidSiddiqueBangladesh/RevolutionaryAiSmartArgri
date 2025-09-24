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
 * Function endpoint: Get farmer + sensor + weather data by phone number
 */
router.post('/get-farmer-data', async (req, res) => {
  try {
    console.log('\n🎤 ===== RETELL AI FUNCTION CALL =====');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    // Try different parameter names that Retell AI might use
    const phone_number = req.body.phone_number || req.body.phoneNumber || req.body.number || req.body.from_number;
    console.log(`🔍 Getting farm package for: ${phone_number}`);

    if (!phone_number) {
      console.log('❌ No phone number provided in request');
      return res.json({
        success: false,
        message: "No phone number provided"
      });
    }

    const { getFarmerByPhoneNumber, getFreshSensorData, getCurrentWeather, getForecastWeather } = require('../services/retellService');
    const farmer = await getFarmerByPhoneNumber(phone_number);

    if (!farmer) {
      return res.json({
        success: false,
        message: "Farmer not found in database"
      });
    }

    const sensors = await getFreshSensorData(farmer.id);
    const weather = await getCurrentWeather(farmer.latitude, farmer.longitude);
    const forecast = await getForecastWeather(farmer.latitude, farmer.longitude);

    // Sanitize farmer object
    const safeFarmer = {
      full_name: farmer.full_name,
      mobile_number: farmer.mobile_number,
      crop_name: farmer.crop_name,
      land_size_acres: farmer.land_size_acres,
      location_address: farmer.location_address
    };

    // Slim forecast: ensure only needed fields and include day
    const slimForecast = Array.isArray(forecast)
      ? forecast.map(day => ({
          date: day.date,
          day: day.day,
          temp_min: day.temp_min,
          temp_max: day.temp_max,
          humidity: day.humidity,
          description: day.description
        }))
      : null;

    return res.json({
      success: true,
      farmer: safeFarmer,
      sensors,
      weather,
      forecast: slimForecast
    });
  } catch (error) {
    console.error('Get combined farm data error:', error);
    res.status(500).json({
      success: false,
      message: "Error retrieving combined farm data"
    });
  }
});

/**
 * JWT-protected endpoint: Get farmer + sensor + weather data using auth token
 */
router.post('/get-farmer-data-jwt', authenticateToken, async (req, res) => {
  try {
    const authUser = req.user;

    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const { getFreshSensorData, getCurrentWeather, getForecastWeather } = require('../services/retellService');

    // Use authenticated user's profile as farmer
    const farmer = authUser;

    const sensors = await getFreshSensorData(farmer.id);
    const weather = await getCurrentWeather(farmer.latitude, farmer.longitude);
    const forecast = await getForecastWeather(farmer.latitude, farmer.longitude);

    // Sanitize farmer object
    const safeFarmer = {
      full_name: farmer.full_name,
      mobile_number: farmer.mobile_number,
      crop_name: farmer.crop_name,
      land_size_acres: farmer.land_size_acres,
      location_address: farmer.location_address
    };

    // Slim forecast: ensure only needed fields and include day
    const slimForecast = Array.isArray(forecast)
      ? forecast.map(day => ({
          date: day.date,
          day: day.day,
          temp_min: day.temp_min,
          temp_max: day.temp_max,
          humidity: day.humidity,
          description: day.description
        }))
      : null;

    return res.json({
      success: true,
      farmer: safeFarmer,
      sensors,
      weather,
      forecast: slimForecast
    });
  } catch (error) {
    console.error('Get combined farm data (JWT) error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving combined farm data'
    });
  }
});

// Removed: separate sensor endpoint (consolidated into /get-farmer-data)

// Removed: separate weather endpoint (consolidated into /get-farmer-data)

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

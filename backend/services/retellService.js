const axios = require('axios');
require('dotenv').config();

/**
 * Retell AI Service for Voice Calls
 * Integrates with AgriSense for farm advisory calls
 */

const RETELL_API_KEY = process.env.RETELL_API_KEY;
const RETELL_PHONE_NUMBER = process.env.RETELL_PHONE_NUMBER || '+12563294669'; // Default fallback
const RETELL_BASE_URL = 'https://api.retellai.com/v2';
const AGRISENSE_BACKEND_URL = process.env.AGRISENSE_BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';

/**
 * Create a voice call for critical farm alerts
 * @param {Object} farmData - Complete farm data for the call
 * @param {string} phoneNumber - Farmer's phone number
 * @param {string} alertMessage - Critical alert message
 * @returns {Promise<Object>} Call result
 */
async function createCriticalAlertCall(farmData, phoneNumber, alertMessage) {
  try {
    console.log('\n🔊 ===== INITIATING VOICE CALL =====');
    console.log('📞 Calling:', phoneNumber);
    console.log('🚨 Alert:', alertMessage);
    console.log('👨‍🌾 Farmer:', farmData.farmer.name);
    console.log('====================================');

    // Create the voice agent with farm-specific context
    const agentPrompt = generateFarmAdvisoryPrompt(farmData, alertMessage);
    
    const callPayload = {
      agent_id: process.env.RETELL_AGENT_ID,
      from_number: RETELL_PHONE_NUMBER, // Your Retell AI phone number
      to_number: phoneNumber,
      retell_llm_dynamic_variables: {
        farmData: JSON.stringify(farmData),
        alertMessage: alertMessage
      },
      metadata: {
        farmer_id: farmData.farmer.id,
        device_id: farmData.device.id,
        alert_type: farmData.alert.type,
        call_purpose: 'critical_alert'
      }
    };

    const response = await axios.post(
      `${RETELL_BASE_URL}/create-phone-call`,
      callPayload,
      {
        headers: {
          'Authorization': `Bearer ${RETELL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    console.log('✅ Voice call initiated successfully!');
    console.log('📞 Call ID:', response.data.call_id);
    
    return {
      success: true,
      callId: response.data.call_id,
      status: response.data.call_status,
      farmerId: farmData.farmer.id,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Voice call failed:', error.message);
    console.error('Error details:', error.response?.data || 'No additional details');
    
    return {
      success: false,
      error: error.message,
      response: error.response?.data || null,
      farmerId: farmData.farmer.id,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * Generate farm-specific prompt for Retell AI agent
 * @param {Object} farmData - Complete farm data
 * @param {string} alertMessage - Critical alert message
 * @returns {string} Retell AI agent prompt
 */
function generateFarmAdvisoryPrompt(farmData, alertMessage) {
  const prompt = `
You are an expert agricultural advisor AI calling ${farmData.farmer.name} in Bangladesh about a critical farm condition.

CRITICAL ALERT: ${alertMessage}

FARMER PROFILE:
- Name: ${farmData.farmer.name}
- Location: ${farmData.farmer.location}
- Crop: ${farmData.crop.type}
- Land Size: ${farmData.farmer.landSize} acres
- Mobile: ${farmData.farmer.mobile}

CURRENT SENSOR DATA:
- Soil Moisture: ${farmData.sensors.soilMoisture}%
- Soil pH: ${farmData.sensors.soilPH}
- Temperature: ${farmData.sensors.soilTemperature}°C
- Humidity: ${farmData.sensors.humidity}%
- Light: ${farmData.sensors.lightIntensity} lux
- Conductivity: ${farmData.sensors.soilConductivity} μS/cm
- Nitrogen: ${farmData.sensors.nutrients.nitrogen} ppm
- Phosphorus: ${farmData.sensors.nutrients.phosphorus} ppm
- Potassium: ${farmData.sensors.nutrients.potassium} ppm

WEATHER CONDITIONS:
- Temperature: ${farmData.weather.temperature}°C
- Humidity: ${farmData.weather.humidity}%
- Rainfall: ${farmData.weather.rainfall}mm

CONVERSATION FLOW:
1. Greet the farmer by name in Bengali/English mix
2. Explain the critical alert clearly
3. Provide immediate action recommendations
4. Answer any questions about their farm data
5. Offer additional agricultural advice
6. End with encouraging words

CAPABILITIES:
- You have access to ALL their farm data above
- You can answer questions about soil, crops, weather
- Provide irrigation, fertilizer, and pest control advice
- Explain sensor readings in simple terms
- Give seasonal farming tips
- Help with crop planning

LANGUAGE: Speak in Bengali-English mix as common in Bangladesh. Use simple, farmer-friendly language.

PERSONALITY: Helpful, knowledgeable, caring, and patient. You're like a trusted agricultural extension officer.

BACKEND ACCESS: If farmer asks for updated data, you can mention the data is from their AgriSense IoT sensors updated every 30 seconds.

Start the call by saying: "আসসালামু আলাইকুম ${farmData.farmer.name} ভাই। আমি AgriSense থেকে কল করছি। আপনার ক্ষেতের একটি জরুরি অবস্থা নিয়ে কথা বলতে চাই।"
`;

  return prompt;
}

/**
 * Handle webhook from Retell AI during conversation
 * This allows real-time data access during the call
 * @param {Object} webhookData - Retell webhook payload
 * @returns {Promise<Object>} Response for Retell AI
 */
async function handleConversationWebhook(webhookData) {
  try {
    const { call_id, from_number, user_message, call_type } = webhookData;
    
    console.log(`📞 Call ${call_id}: Incoming from ${from_number}`);
    console.log(`💬 Message: "${user_message}"`);
    
    // For inbound calls, identify farmer by phone number
    if (call_type === 'inbound' || from_number) {
      const farmerData = await getFarmerByPhoneNumber(from_number);
      
      if (farmerData) {
        console.log(`👨‍🌾 Identified farmer: ${farmerData.full_name}`);
        
        // Get their latest farm data
        const sensorData = await getFreshSensorData(farmerData.id);
        const weatherData = await getCurrentWeather(farmerData.latitude, farmerData.longitude);
        
        // Update agent with farmer's specific data
        return {
          response: await generatePersonalizedResponse(user_message, farmerData, sensorData, weatherData),
          continue_conversation: true,
          retell_llm_dynamic_variables: {
            farmerData: JSON.stringify({
              farmer: farmerData,
              sensors: sensorData,
              weather: weatherData
            })
          }
        };
      } else {
        // Unknown caller - general agricultural advice
        return {
          response: `আসসালামু আলাইকুম! I'm AgriSense AI assistant. I don't have your farm data on file yet, but I can still help with general farming questions. What would you like to know about agriculture?`,
          continue_conversation: true
        };
      }
    }
    
    // Default response for other questions
    return {
      response: "I have all your farm data available. What specific information would you like to know about your crops or soil conditions?",
      continue_conversation: true
    };
    
  } catch (error) {
    console.error('Webhook error:', error);
    return {
      response: "I'm having trouble accessing your data right now, but I can still help with general farming advice.",
      continue_conversation: true
    };
  }
}

/**
 * Get farmer data by phone number for inbound calls
 * @param {string} phoneNumber - Caller's phone number
 * @returns {Promise<Object>} Farmer data
 */
async function getFarmerByPhoneNumber(phoneNumber) {
  try {
    // Clean phone number (remove + and format consistently)
    const cleanNumber = phoneNumber.replace(/[\+\s\-\(\)]/g, '');
    
    const supabase = require('../config/database');
    
    const { data, error } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        mobile_number,
        crop_name,
        land_size_acres,
        latitude,
        longitude,
        location_address,
        district_id
      `)
      .or(`mobile_number.eq.${phoneNumber},mobile_number.eq.+${cleanNumber},mobile_number.eq.${cleanNumber}`)
      .single();

    if (error) {
      console.log(`📞 Phone number ${phoneNumber} not found in database`);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error finding farmer by phone:', error);
    return null;
  }
}

/**
 * Get fresh sensor data for live conversation
 * @param {string} farmerId - Farmer's user ID
 * @returns {Promise<Object>} Latest sensor data
 */
async function getFreshSensorData(farmerId) {
  try {
    const supabase = require('../config/database');
    
    const { data, error } = await supabase
      .from('current_sensor_data')
      .select('*')
      .eq('user_id', farmerId)
      .single();

    if (error) {
      console.log(`📊 No sensor data found for farmer ${farmerId}`);
      return null;
    }

    return {
      soilMoisture: data.moisture_level,
      soilPH: data.ph_level,
      soilTemperature: data.temperature,
      humidity: data.humidity,
      lightIntensity: data.light_intensity,
      soilConductivity: data.soil_conductivity,
      nutrients: {
        nitrogen: data.nitrogen_level,
        phosphorus: data.phosphorus_level,
        potassium: data.potassium_level
      },
      lastUpdated: data.last_updated
    };
  } catch (error) {
    console.error('Failed to fetch fresh sensor data:', error);
    return null;
  }
}

/**
 * Get current weather data for farmer's location
 * @param {number} latitude - Farmer's latitude
 * @param {number} longitude - Farmer's longitude
 * @returns {Promise<Object>} Weather data
 */
async function getCurrentWeather(latitude, longitude) {
  try {
    if (!latitude || !longitude) return null;

    if (!WEATHER_API_KEY) {
      console.warn('WEATHER_API_KEY not set; cannot fetch weather');
      return null;
    }

    console.log('🌤️ Fetching weather directly from OpenWeather with', { latitude, longitude });
    const response = await axios.get(`${WEATHER_API_URL}/weather`, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: WEATHER_API_KEY,
        units: 'metric'
      }
    });

    const data = response.data;
    const ts = data?.dt ? new Date(data.dt * 1000) : new Date();
    const dateStr = ts.toISOString().split('T')[0];
    const dayStr = ts.toLocaleDateString('en-US', { weekday: 'short' });
    const description = data?.weather?.[0]?.description || null;
    const normalized = {
      temperature: data?.main?.temp ?? null,
      humidity: data?.main?.humidity ?? null,
      rainfall: data?.rain?.['1h'] || data?.rain?.['3h'] || 0,
      forecast: description,
      description,
      date: dateStr,
      day: dayStr
    };
    console.log('🌤️ Normalized weather:', normalized);
    return normalized;
  } catch (error) {
    console.error('Failed to fetch weather data:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

/**
 * Get 5-day forecast summarized per day
 */
async function getForecastWeather(latitude, longitude) {
  try {
    if (!latitude || !longitude) return null;
    if (!WEATHER_API_KEY) {
      console.warn('WEATHER_API_KEY not set; cannot fetch forecast');
      return null;
    }

    console.log('🌤️ Fetching 5-day forecast from OpenWeather with', { latitude, longitude });
    const response = await axios.get(`${WEATHER_API_URL}/forecast`, {
      params: {
        lat: latitude,
        lon: longitude,
        appid: WEATHER_API_KEY,
        units: 'metric'
      }
    });

    const list = response.data?.list || [];
    const dailyMap = new Map();

    list.forEach(item => {
      const d = new Date(item.dt * 1000);
      const date = d.toISOString().split('T')[0];
      const day = d.toLocaleDateString('en-US', { weekday: 'short' });
      const min = item.main?.temp_min;
      const max = item.main?.temp_max;
      const humidity = item.main?.humidity;
      const weather = item.weather?.[0];

      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          day,
          temp_min: min,
          temp_max: max,
          humidity,
          description: weather?.description || null
        });
      } else {
        const existing = dailyMap.get(date);
        existing.temp_min = Math.min(existing.temp_min, min);
        existing.temp_max = Math.max(existing.temp_max, max);
      }
    });

    const days = Array.from(dailyMap.values()).slice(0, 5);
    console.log('🌤️ Forecast days:', days.length);
    return days;
  } catch (error) {
    console.error('Failed to fetch forecast data:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

/**
 * Generate personalized response based on farmer's question and data
 * @param {string} userMessage - Farmer's question
 * @param {Object} farmerData - Farmer profile data
 * @param {Object} sensorData - Current sensor readings
 * @param {Object} weatherData - Current weather
 * @returns {Promise<string>} Personalized response
 */
async function generatePersonalizedResponse(userMessage, farmerData, sensorData, weatherData) {
  try {
    // Create context for personalized response
    const context = {
      farmer: farmerData.full_name,
      crop: farmerData.crop_name,
      location: farmerData.location_address,
      question: userMessage,
      sensors: sensorData,
      weather: weatherData
    };

    // Simple logic for common questions
    if (userMessage.toLowerCase().includes('moisture') || userMessage.toLowerCase().includes('পানি')) {
      const moisture = sensorData?.soilMoisture || 'Unknown';
      return `আপনার মাটির moisture level এখন ${moisture}%। ${moisture < 30 ? 'এখনি সেচ দিতে হবে!' : moisture > 70 ? 'মাটিতে পর্যাপ্ত পানি আছে।' : 'মাটির পানি ঠিক আছে।'} ${farmerData.full_name} ভাই, আর কিছু জানতে চান?`;
    }

    if (userMessage.toLowerCase().includes('ph') || userMessage.toLowerCase().includes('অম্ল')) {
      const ph = sensorData?.soilPH || 'Unknown';
      return `আপনার মাটির pH level ${ph}। ${ph < 6 ? 'মাটি অম্লীয়, চুন প্রয়োগ করুন।' : ph > 8 ? 'মাটি ক্ষারীয়, সালফার দিন।' : 'মাটির pH ঠিক আছে।'} ${farmerData.crop_name} চাষের জন্য এটা কেমন লাগছে?`;
    }

    if (userMessage.toLowerCase().includes('weather') || userMessage.toLowerCase().includes('আবহাওয়া')) {
      const temp = weatherData?.temperature || 'Unknown';
      const humidity = weatherData?.humidity || 'Unknown';
      return `আজকের আবহাওয়া: তাপমাত্রা ${temp}°C, আর্দ্রতা ${humidity}%। ${farmerData.full_name} ভাই, এই আবহাওয়ায় ${farmerData.crop_name} চাষে কোন সমস্যা হচ্ছে?`;
    }

    // Default personalized response
    return `আসসালামু আলাইকুম ${farmerData.full_name} ভাই! আমি আপনার ${farmerData.crop_name} ক্ষেতের সব তথ্য দেখতে পাচ্ছি। আপনার কি জানতে চান - মাটির অবস্থা, সেচ, সার, নাকি অন্য কিছু?`;

  } catch (error) {
    console.error('Error generating personalized response:', error);
    return `আসসালামু আলাইকুম! আমি AgriSense AI। আপনার খামারের ব্যাপারে কি জানতে চান?`;
  }
}

/**
 * Get call analytics and status
 * @param {string} callId - Retell call ID
 * @returns {Promise<Object>} Call details
 */
async function getCallStatus(callId) {
  try {
    const response = await axios.get(
      `${RETELL_BASE_URL}/get-call/${callId}`,
      {
        headers: {
          'Authorization': `Bearer ${RETELL_API_KEY}`
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('Failed to get call status:', error);
    return null;
  }
}

module.exports = {
  createCriticalAlertCall,
  handleConversationWebhook,
  getCallStatus,
  getFreshSensorData,
  getFarmerByPhoneNumber,
  getCurrentWeather,
  getForecastWeather,
  generatePersonalizedResponse
};

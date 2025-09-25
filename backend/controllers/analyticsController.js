const { analyzeData } = require('../services/openaiService');
const { sendSMS, formatMobileNumber, isValidBangladeshiMobile } = require('../services/smsService');
const { createCriticalAlertCall } = require('../services/retellService');
const supabase = require('../config/database');

/**
 * Get comprehensive farm analysis using OpenAI
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getFarmAnalysis = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get user/farmer information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        full_name,
        mobile_number,
        crop_name,
        land_size_acres,
        latitude,
        longitude,
        location_address,
        districts(name)
      `)
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      console.error('User query error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const farmer = {
      full_name: userData.full_name,
      crop_name: userData.crop_name,
      land_size_acres: userData.land_size_acres,
      latitude: userData.latitude,
      longitude: userData.longitude,
      location_address: userData.location_address,
      district_name: userData.districts?.name
    };
    
    // Get device information for this user
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    if (deviceError || !deviceData || deviceData.length === 0) {
      console.error('Device query error:', deviceError);
      return res.status(404).json({ error: 'No active device found for this user' });
    }
    
    const deviceId = deviceData[0].id;
    
    // Get latest sensor data
    const { data: sensorData, error: sensorError } = await supabase
      .from('current_sensor_data')
      .select(`
        moisture_level,
        ph_level,
        temperature,
        humidity,
        light_intensity,
        soil_conductivity,
        nitrogen_level,
        phosphorus_level,
        potassium_level,
        last_updated
      `)
      .eq('device_id', deviceId)
      .single();
    
    if (sensorError || !sensorData) {
      console.error('Sensor query error:', sensorError);
      return res.status(404).json({ error: 'No sensor data found for this device' });
    }
    
    // Get latest weather data from cache (specifically current weather)
    // Use same 30-minute cache expiration as weather controller
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_cache')
      .select('data')
      .eq('type', 'current')
      .eq('latitude', parseFloat(farmer.latitude).toFixed(4))
      .eq('longitude', parseFloat(farmer.longitude).toFixed(4))
      .gt('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let weatherInfo = {};
    
    if (weatherError || !weatherData) {
      console.warn('Weather data not found or expired, attempting to fetch fresh data');
      console.warn('Weather error:', weatherError);
      console.warn('Coordinates being searched:', parseFloat(farmer.latitude).toFixed(4), parseFloat(farmer.longitude).toFixed(4));
      console.warn('Cache expiration time:', thirtyMinutesAgo);
      
      // Try to fetch fresh weather data if cache is expired
      try {
        const axios = require('axios');
        const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
        const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';
        
        const response = await axios.get(`${WEATHER_API_URL}/weather`, {
          params: {
            lat: farmer.latitude,
            lon: farmer.longitude,
            appid: WEATHER_API_KEY,
            units: 'metric'
          }
        });
        
        // Cache the fresh response
        await supabase.from('weather_cache').insert({
          type: 'current',
          latitude: parseFloat(farmer.latitude).toFixed(4),
          longitude: parseFloat(farmer.longitude).toFixed(4),
          data: JSON.stringify(response.data)
        });
        
        // Extract the correct fields from fresh OpenWeatherMap data
        weatherInfo = {
          temperature: response.data.main?.temp || 25,
          humidity: response.data.main?.humidity || 60,
          rainfall: response.data.rain?.['1h'] || response.data.rain?.['3h'] || 0,
          forecast: response.data.weather?.[0]?.description || 'Based on current conditions'
        };
        
        console.log('Fresh weather data fetched and cached:', weatherInfo);
      } catch (fetchError) {
        console.error('Failed to fetch fresh weather data:', fetchError.message);
        weatherInfo = {
          temperature: 25,
          humidity: 60,
          rainfall: 0,
          forecast: 'No weather data available'
        };
      }
    } else {
      // Parse the cached weather data (it's stored as JSON string)
      const parsedWeatherData = typeof weatherData.data === 'string' 
        ? JSON.parse(weatherData.data) 
        : weatherData.data;
      
      console.log('Parsed weather data for OpenAI:', {
        original: parsedWeatherData.main,
        rainfall: parsedWeatherData.rain,
        weather: parsedWeatherData.weather?.[0]
      });
      
      // Extract the correct fields from OpenWeatherMap data structure
      weatherInfo = {
        temperature: parsedWeatherData.main?.temp || 25,
        humidity: parsedWeatherData.main?.humidity || 60,
        rainfall: parsedWeatherData.rain?.['1h'] || parsedWeatherData.rain?.['3h'] || 0,
        forecast: parsedWeatherData.weather?.[0]?.description || 'Based on current conditions'
      };
      
      console.log('Final weather info for OpenAI:', weatherInfo);
    }
    
    // Prepare data for OpenAI analysis
    const analysisData = {
      farmer: {
        name: farmer.full_name,
        location: farmer.location_address || farmer.district_name || 'Unknown',
        landSize: farmer.land_size_acres || 'Unknown',
        coordinates: {
          latitude: farmer.latitude,
          longitude: farmer.longitude
        }
      },
      crop: {
        type: farmer.crop_name || 'Unknown',
        plantingDate: 'Unknown' // Could be added to user schema in future
      },
      weather: {
        temperature: weatherInfo.temperature,
        humidity: weatherInfo.humidity,
        rainfall: weatherInfo.rainfall,
        forecast: weatherInfo.forecast
      },
      sensors: {
        soilMoisture: sensorData.moisture_level,
        soilPH: sensorData.ph_level,
        soilTemperature: sensorData.temperature,
        lightIntensity: sensorData.light_intensity,
        soilConductivity: sensorData.soil_conductivity,
        nutrients: {
          nitrogen: sensorData.nitrogen_level,
          phosphorus: sensorData.phosphorus_level,
          potassium: sensorData.potassium_level
        }
      },
      meta: {
        userId: userId
      }
    };
    
    console.log('===== ANALYTICS REQUEST =====');
    console.log(`User: ${farmer.full_name} (${userId})`);
    console.log(`Device: ${deviceId}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('============================');
    
    // Send to OpenAI for analysis
    const analysis = await analyzeData(analysisData);
    
    // Handle critical alerts if action is required
    let alertRecord = null;
    if (analysis.actionRequired && analysis.message) {
      console.log('\n🚨 CRITICAL ALERT DETECTED! 🚨');
      console.log('Alert Message:', analysis.message);
      console.log('Farmer:', farmer.full_name);
      console.log('Mobile:', userData.mobile_number);
      
      try {
        // Determine alert type based on sensor data
        const alertType = determineAlertType(sensorData);
        
        // Store alert in database
        const { data: newAlert, error: alertError } = await supabase
          .from('farm_alerts')
          .insert([{
            user_id: userId,
            device_id: deviceId,
            alert_type: alertType,
            message_bangla: analysis.message,
            message_english: analysis.analysis,
            sensor_data: {
              moisture_level: sensorData.moisture_level,
              ph_level: sensorData.ph_level,
              temperature: sensorData.temperature,
              humidity: sensorData.humidity,
              timestamp: sensorData.last_updated
            }
          }])
          .select()
          .single();

        if (alertError) {
          console.error('Failed to store alert:', alertError);
        } else {
          alertRecord = newAlert;
          console.log('✅ Alert stored in database with ID:', newAlert.id);
        }

        // Send SMS if mobile number is valid
        if (isValidBangladeshiMobile(userData.mobile_number)) {
          const formattedNumber = formatMobileNumber(userData.mobile_number);
          console.log('📱 Sending SMS to:', formattedNumber);
          
          const smsResult = await sendSMS(formattedNumber, analysis.message);
          
          // Update alert record with SMS status
          if (alertRecord) {
            await supabase
              .from('farm_alerts')
              .update({
                is_sms_sent: smsResult.success,
                sms_sent_at: smsResult.success ? new Date().toISOString() : null,
                sms_response: smsResult
              })
              .eq('id', alertRecord.id);
          }

          if (smsResult.success) {
            console.log('✅ SMS sent successfully!');
            
            // Initiate voice call for critical alerts
            console.log('🔊 Initiating voice call for critical alert...');
            
            // Prepare complete farm data for voice call
            const completeFarmData = {
              farmer: {
                id: userId,
                name: userData.full_name,
                location: userData.location_address || userData.districts?.name || 'Unknown',
                landSize: userData.land_size_acres,
                mobile: userData.mobile_number
              },
              crop: {
                type: userData.crop_name || 'Unknown'
              },
              sensors: {
                soilMoisture: sensorData.moisture_level,
                soilPH: sensorData.ph_level,
                soilTemperature: sensorData.temperature,
                humidity: sensorData.humidity,
                lightIntensity: sensorData.light_intensity,
                soilConductivity: sensorData.soil_conductivity,
                nutrients: {
                  nitrogen: sensorData.nitrogen_level,
                  phosphorus: sensorData.phosphorus_level,
                  potassium: sensorData.potassium_level
                }
              },
              weather: {
                temperature: weatherInfo.temperature || 25,
                humidity: weatherInfo.humidity || 60,
                rainfall: weatherInfo.rainfall || 0
              },
              alert: {
                type: alertType
              },
              device: {
                id: deviceId
              }
            };

            // Create voice call
            const voiceResult = await createCriticalAlertCall(
              completeFarmData,
              formattedNumber,
              analysis.message
            );

            // Update alert record with voice call status
            if (alertRecord) {
              await supabase
                .from('farm_alerts')
                .update({
                  voice_call_initiated: voiceResult.success,
                  voice_call_id: voiceResult.callId,
                  voice_call_status: voiceResult.status,
                  voice_call_response: voiceResult
                })
                .eq('id', alertRecord.id);
            }

            if (voiceResult.success) {
              console.log('✅ Voice call initiated successfully!');
              console.log('📞 Call ID:', voiceResult.callId);
            } else {
              console.error('❌ Voice call failed:', voiceResult.error);
            }
            
          } else {
            console.error('❌ SMS sending failed:', smsResult.error);
          }
        } else {
          console.warn('⚠️ Invalid mobile number format:', userData.mobile_number);
        }

      } catch (alertError) {
        console.error('Error handling alert:', alertError);
      }
    }
    
    // Return the analysis results
    return res.status(200).json({
      success: true,
      data: {
        analysis: analysis,
        alert: alertRecord,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Farm analysis error:', error);
    return res.status(500).json({ 
      error: 'Failed to analyze farm data',
      message: error.message 
    });
  }
};

/**
 * Get comprehensive farm data for chatbot with OpenAI analysis
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
exports.getChatbotFarmData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { message } = req.body;
    
    if (!message || message.trim() === '') {
      return res.status(400).json({ error: 'Message is required' });
    }
    
    // Get user/farmer information
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select(`
        full_name,
        mobile_number,
        crop_name,
        land_size_acres,
        latitude,
        longitude,
        location_address,
        districts(name)
      `)
      .eq('id', userId)
      .single();
    
    if (userError || !userData) {
      console.error('User query error:', userError);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const farmer = {
      full_name: userData.full_name,
      crop_name: userData.crop_name,
      land_size_acres: userData.land_size_acres,
      latitude: userData.latitude,
      longitude: userData.longitude,
      location_address: userData.location_address,
      district_name: userData.districts?.name
    };
    
    // Get device information for this user
    const { data: deviceData, error: deviceError } = await supabase
      .from('devices')
      .select('id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .limit(1);
    
    let sensorData = null;
    if (deviceData && deviceData.length > 0) {
      const deviceId = deviceData[0].id;
      
      // Get latest sensor data
      const { data: sensors, error: sensorError } = await supabase
        .from('current_sensor_data')
        .select(`
          moisture_level,
          ph_level,
          temperature,
          humidity,
          light_intensity,
          soil_conductivity,
          nitrogen_level,
          phosphorus_level,
          potassium_level,
          last_updated
        `)
        .eq('device_id', deviceId)
        .single();
      
      if (!sensorError && sensors) {
        sensorData = sensors;
      }
    }
    
    // Get latest weather data from cache (specifically current weather)
    // Use same 30-minute cache expiration as weather controller
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_cache')
      .select('data')
      .eq('type', 'current')
      .eq('latitude', parseFloat(farmer.latitude).toFixed(4))
      .eq('longitude', parseFloat(farmer.longitude).toFixed(4))
      .gt('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let weatherInfo = {};
    if (weatherError || !weatherData) {
      console.warn('Chatbot: Weather data not found or expired, attempting to fetch fresh data');
      
      // Try to fetch fresh weather data if cache is expired
      try {
        const axios = require('axios');
        const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
        const WEATHER_API_URL = 'https://api.openweathermap.org/data/2.5';
        
        const response = await axios.get(`${WEATHER_API_URL}/weather`, {
          params: {
            lat: farmer.latitude,
            lon: farmer.longitude,
            appid: WEATHER_API_KEY,
            units: 'metric'
          }
        });
        
        // Cache the fresh response
        await supabase.from('weather_cache').insert({
          type: 'current',
          latitude: parseFloat(farmer.latitude).toFixed(4),
          longitude: parseFloat(farmer.longitude).toFixed(4),
          data: JSON.stringify(response.data)
        });
        
        // Extract the correct fields from fresh OpenWeatherMap data
        weatherInfo = {
          temperature: response.data.main?.temp || 25,
          humidity: response.data.main?.humidity || 60,
          rainfall: response.data.rain?.['1h'] || response.data.rain?.['3h'] || 0,
          forecast: response.data.weather?.[0]?.description || 'Based on current conditions'
        };
        
        console.log('Chatbot: Fresh weather data fetched and cached:', weatherInfo);
      } catch (fetchError) {
        console.error('Chatbot: Failed to fetch fresh weather data:', fetchError.message);
        weatherInfo = {
          temperature: 25,
          humidity: 60,
          rainfall: 0,
          forecast: 'No weather data available'
        };
      }
    } else {
      // Parse the cached weather data (it's stored as JSON string)
      const parsedWeatherData = typeof weatherData.data === 'string' 
        ? JSON.parse(weatherData.data) 
        : weatherData.data;
      
      console.log('Chatbot: Parsed weather data:', {
        original: parsedWeatherData.main,
        rainfall: parsedWeatherData.rain,
        weather: parsedWeatherData.weather?.[0]
      });
      
      // Extract the correct fields from OpenWeatherMap data structure
      weatherInfo = {
        temperature: parsedWeatherData.main?.temp || 25,
        humidity: parsedWeatherData.main?.humidity || 60,
        rainfall: parsedWeatherData.rain?.['1h'] || parsedWeatherData.rain?.['3h'] || 0,
        forecast: parsedWeatherData.weather?.[0]?.description || 'Based on current conditions'
      };
      
      console.log('Chatbot: Final weather info:', weatherInfo);
    }
    
    // Fetch crop price for user's crop (if available) and all crop prices
    let allPricesList = [];
    try {
      // All crop prices
      const { data: allPriceRows } = await supabase
        .from('crop_prices')
        .select('crop_name, unit, price, updated_at')
        .order('crop_name', { ascending: true });
      if (Array.isArray(allPriceRows)) {
        allPricesList = allPriceRows.map(p => ({
          cropName: p.crop_name,
          unit: p.unit,
          price: p.price,
          updatedAt: p.updated_at
        }));
      }
    } catch (e) {
      console.warn('Chatbot: Failed to fetch crop prices:', e.message);
    }

    // Prepare comprehensive farm context for chatbot
    const farmContext = {
      farmer: {
        name: farmer.full_name,
        location: farmer.location_address || farmer.district_name || 'Unknown',
        landSize: farmer.land_size_acres || 'Unknown',
        coordinates: {
          latitude: farmer.latitude,
          longitude: farmer.longitude
        }
      },
      crop: {
        type: farmer.crop_name || 'Unknown',
        plantingDate: 'Unknown'
      },
      prices: allPricesList,
      weather: {
        temperature: weatherInfo.temperature,
        humidity: weatherInfo.humidity,
        rainfall: weatherInfo.rainfall,
        forecast: weatherInfo.forecast
      },
      sensors: sensorData ? {
        soilMoisture: sensorData.moisture_level,
        soilPH: sensorData.ph_level,
        soilTemperature: sensorData.temperature,
        lightIntensity: sensorData.light_intensity,
        soilConductivity: sensorData.soil_conductivity,
        nutrients: {
          nitrogen: sensorData.nitrogen_level,
          phosphorus: sensorData.phosphorus_level,
          potassium: sensorData.potassium_level
        },
        lastUpdated: sensorData.last_updated
      } : null
    };
    
    console.log('\n===== CHATBOT REQUEST =====');
    console.log(`User: ${farmer.full_name} (${userId})`);
    console.log(`Message: ${message}`);
    console.log(`Timestamp: ${new Date().toISOString()}`);
    console.log('============================');
    
    // Send to OpenAI for personalized response
    const { chatResponse } = require('../services/openaiService');
    const response = await chatResponse(farmContext, message);
    
    return res.status(200).json({
      success: true,
      data: {
        response: response,
        farmContext: farmContext,
        timestamp: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('Chatbot farm data error:', error);
    return res.status(500).json({ 
      error: 'Failed to process chatbot request',
      message: error.message 
    });
  }
};

/**
 * Determine alert type based on sensor readings
 * @param {Object} sensorData - Current sensor readings
 * @returns {string} Alert type for categorization
 */
function determineAlertType(sensorData) {
  const moisture = parseFloat(sensorData.moisture_level);
  const ph = parseFloat(sensorData.ph_level);
  const temperature = parseFloat(sensorData.temperature);

  // Check for critical moisture levels
  if (moisture < 20) {
    return 'critical_drought';
  } else if (moisture > 90) {
    return 'critical_waterlogging';
  }

  // Check for pH problems
  if (ph < 5.5) {
    return 'ph_too_acidic';
  } else if (ph > 8.5) {
    return 'ph_too_alkaline';
  }

  // Check for temperature extremes
  if (temperature < 10) {
    return 'temperature_too_cold';
  } else if (temperature > 40) {
    return 'temperature_too_hot';
  }

  // Default for other critical conditions
  return 'critical_condition';
}
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
    
    // Get latest weather data from cache
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_cache')
      .select('data')
      .eq('latitude', farmer.latitude)
      .eq('longitude', farmer.longitude)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let weatherInfo = {};
    
    if (weatherError || !weatherData) {
      console.warn('Weather data not found, using default values');
      weatherInfo = {
        temperature: 25,
        humidity: 60,
        rainfall: 0,
        forecast: 'No weather data available'
      };
    } else {
      weatherInfo = weatherData.data;
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
        temperature: weatherInfo.temperature || weatherInfo.current?.temp,
        humidity: weatherInfo.humidity || weatherInfo.current?.humidity,
        rainfall: weatherInfo.rainfall || weatherInfo.daily?.[0]?.rain || 0,
        forecast: weatherInfo.forecast || 'Based on current conditions'
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
                temperature: weatherInfo.temperature || weatherInfo.current?.temp || 25,
                humidity: weatherInfo.humidity || weatherInfo.current?.humidity || 60,
                rainfall: weatherInfo.rainfall || weatherInfo.daily?.[0]?.rain || 0
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
    
    // Get latest weather data from cache
    const { data: weatherData, error: weatherError } = await supabase
      .from('weather_cache')
      .select('data')
      .eq('latitude', farmer.latitude)
      .eq('longitude', farmer.longitude)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    let weatherInfo = {};
    if (weatherError || !weatherData) {
      weatherInfo = {
        temperature: 25,
        humidity: 60,
        rainfall: 0,
        forecast: 'No weather data available'
      };
    } else {
      weatherInfo = weatherData.data;
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
      weather: {
        temperature: weatherInfo.temperature || weatherInfo.current?.temp,
        humidity: weatherInfo.humidity || weatherInfo.current?.humidity,
        rainfall: weatherInfo.rainfall || weatherInfo.daily?.[0]?.rain || 0,
        forecast: weatherInfo.forecast || 'Based on current conditions'
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
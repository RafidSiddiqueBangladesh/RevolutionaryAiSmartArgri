const cron = require('node-cron');
const supabase = require('../config/database');
const { analyzeData } = require('./openaiService');
const { sendSMS } = require('./smsService');
const { createCriticalAlertCall } = require('./retellService');

class ScheduledAnalyticsService {
  constructor() {
    this.isRunning = false;
    this.setupScheduledTasks();
  }

  setupScheduledTasks() {
    // Daily morning analytics at 7:00 AM
    cron.schedule('0 7 * * *', async () => {
      console.log('🌅 Starting daily morning analytics...');
      await this.runDailyAnalytics();
    }, {
      scheduled: true,
      timezone: "Asia/Dhaka"
    });

    // Check for critical soil moisture every 2 hours
    cron.schedule('0 */2 * * *', async () => {
      console.log('💧 Checking soil moisture levels...');
      await this.checkCriticalMoisture();
    }, {
      scheduled: true,
      timezone: "Asia/Dhaka"
    });

    console.log('📅 Scheduled analytics tasks initialized');
    console.log('   - Daily morning analytics: 7:00 AM (Asia/Dhaka)');
    console.log('   - Soil moisture check: Every 2 hours');
  }

  async runDailyAnalytics() {
    try {
      this.isRunning = true;
      console.log('🔍 Running daily analytics for all farmers...');

      // Get all farmers with devices
      const { data: farmers, error: farmersError } = await supabase
        .from('users')
        .select(`
          id,
          full_name,
          mobile_number,
          latitude,
          longitude,
          location_address,
          land_size_acres,
          crop_name,
          devices (
            id,
            device_name,
            is_active
          )
        `)
        .eq('role', 'farmer')
        .not('devices', 'is', null);

      if (farmersError) {
        console.error('Error fetching farmers:', farmersError);
        return;
      }

      console.log(`📊 Found ${farmers.length} farmers with devices`);

      for (const farmer of farmers) {
        try {
          await this.processFarmerAnalytics(farmer);
          // Add delay between farmers to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Error processing farmer ${farmer.full_name}:`, error.message);
        }
      }

      console.log('✅ Daily analytics completed');
    } catch (error) {
      console.error('Daily analytics error:', error);
    } finally {
      this.isRunning = false;
    }
  }

  async processFarmerAnalytics(farmer) {
    try {
      console.log(`🌾 Processing analytics for ${farmer.full_name}...`);

      // Get active devices for this farmer
      const activeDevices = farmer.devices.filter(device => device.is_active);
      if (activeDevices.length === 0) {
        console.log(`   ⚠️  No active devices for ${farmer.full_name}`);
        return;
      }

      const deviceId = activeDevices[0].id;

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
        console.log(`   ⚠️  No sensor data for ${farmer.full_name}`);
        return;
      }

      // Get latest weather data
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
        // Try to fetch fresh weather data
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
          
          await supabase.from('weather_cache').insert({
            type: 'current',
            latitude: parseFloat(farmer.latitude).toFixed(4),
            longitude: parseFloat(farmer.longitude).toFixed(4),
            data: JSON.stringify(response.data)
          });
          
          weatherInfo = {
            temperature: response.data.main?.temp || 25,
            humidity: response.data.main?.humidity || 60,
            rainfall: response.data.rain?.['1h'] || response.data.rain?.['3h'] || 0,
            forecast: response.data.weather?.[0]?.description || 'Based on current conditions'
          };
        } catch (fetchError) {
          console.error(`Failed to fetch weather for ${farmer.full_name}:`, fetchError.message);
          weatherInfo = {
            temperature: 25,
            humidity: 60,
            rainfall: 0,
            forecast: 'No weather data available'
          };
        }
      } else {
        const parsedWeatherData = typeof weatherData.data === 'string' 
          ? JSON.parse(weatherData.data) 
          : weatherData.data;
        
        weatherInfo = {
          temperature: parsedWeatherData.main?.temp || 25,
          humidity: parsedWeatherData.main?.humidity || 60,
          rainfall: parsedWeatherData.rain?.['1h'] || parsedWeatherData.rain?.['3h'] || 0,
          forecast: parsedWeatherData.weather?.[0]?.description || 'Based on current conditions'
        };
      }

      // Prepare data for analysis
      const analysisData = {
        farmer: {
          name: farmer.full_name,
          location: farmer.location_address || 'Unknown',
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
        }
      };

      // Run AI analysis
      const analysisResult = await analyzeData(analysisData);
      
      console.log(`   📈 Analysis completed for ${farmer.full_name}`);
      console.log(`   📊 Soil moisture: ${sensorData.moisture_level}%`);
      console.log(`   🌡️  Temperature: ${weatherInfo.temperature}°C`);
      console.log(`   ⚠️  Action required: ${analysisResult.actionRequired}`);

      // Store analysis result
      await supabase.from('farm_analyses').insert({
        user_id: farmer.id,
        device_id: deviceId,
        analysis_data: analysisData,
        ai_analysis: analysisResult.analysis,
        action_required: analysisResult.actionRequired,
        sms_message: analysisResult.message,
        created_at: new Date().toISOString()
      });

      // Send SMS if action is required
      if (analysisResult.actionRequired && analysisResult.message && farmer.mobile_number) {
        try {
          await sendSMS(farmer.mobile_number, analysisResult.message);
          console.log(`   📱 SMS sent to ${farmer.full_name}`);
        } catch (smsError) {
          console.error(`   ❌ SMS failed for ${farmer.full_name}:`, smsError.message);
        }
      }

      // Check for critical conditions and trigger voice call
      if (this.isCriticalCondition(sensorData, weatherInfo) && farmer.mobile_number) {
        try {
          const farmData = {
            farmer: {
              id: farmer.id,
              name: farmer.full_name,
              location: farmer.location_address || 'Unknown',
              landSize: farmer.land_size_acres,
              mobile: farmer.mobile_number
            },
            crop: {
              type: farmer.crop_name || 'Unknown'
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
              temperature: weatherInfo.temperature,
              humidity: weatherInfo.humidity,
              rainfall: weatherInfo.rainfall
            },
            alert: {
              type: 'critical_condition'
            },
            device: {
              id: deviceId
            }
          };
          await createCriticalAlertCall(farmData, farmer.mobile_number, analysisResult.message || 'গুরুত্বপূর্ণ সতর্কতা।');
          console.log(`   📞 Critical alert call initiated for ${farmer.full_name}`);
        } catch (callError) {
          console.error(`   ❌ Voice call failed for ${farmer.full_name}:`, callError.message);
        }
      }

    } catch (error) {
      console.error(`Error in processFarmerAnalytics for ${farmer.full_name}:`, error);
    }
  }

  async checkCriticalMoisture() {
    try {
      console.log('💧 Checking for critical soil moisture levels...');

      // First, let's check all sensor data for debugging
      const { data: allSensorData, error: allDataError } = await supabase
        .from('current_sensor_data')
        .select(`
          device_id,
          moisture_level,
          last_updated,
          devices!inner (
            id,
            device_name,
            user_id,
            is_active,
            users!inner (
              id,
              full_name,
              mobile_number
            )
          )
        `);

      if (allDataError) {
        console.error('Error fetching all sensor data:', allDataError);
        return;
      }

      console.log(`📊 Total sensor data entries: ${allSensorData.length}`);
      if (allSensorData.length > 0) {
        console.log('📊 Sample sensor data:', allSensorData[0]);
        console.log(`📊 Moisture levels: ${allSensorData.map(d => d.moisture_level).join(', ')}`);
      }

      // Get all active devices with low moisture
      const { data: criticalDevices, error: devicesError } = await supabase
        .from('current_sensor_data')
        .select(`
          device_id,
          moisture_level,
          last_updated,
          devices!inner (
            id,
            device_name,
            user_id,
            users!inner (
              id,
              full_name,
              mobile_number,
              latitude,
              longitude,
              location_address,
              district_name,
              land_size_acres,
              crop_name
            )
          )
        `)
        .lt('moisture_level', 15)
        .eq('devices.is_active', true);

      if (devicesError) {
        console.error('Error fetching critical devices:', devicesError);
        return;
      }

      if (criticalDevices.length === 0) {
        console.log('   ✅ No critical moisture levels found');
        return;
      }

      console.log(`   ⚠️  Found ${criticalDevices.length} devices with critical moisture`);

      for (const device of criticalDevices) {
        try {
          const farmer = device.devices.users;
          const moistureLevel = device.moisture_level;
          
          console.log(`   🚨 Critical moisture alert for ${farmer.full_name}: ${moistureLevel}%`);

          // Send immediate SMS alert
          const alertMessage = `🚨 জরুরি সতর্কতা! আপনার মাটির আর্দ্রতা ${moistureLevel}% যা খুবই কম। দ্রুত সেচ দিন। - AgriSense`;
          
          if (farmer.mobile_number) {
            try {
              await sendSMS(farmer.mobile_number, alertMessage);
              console.log(`   📱 Critical SMS sent to ${farmer.full_name}`);
            } catch (smsError) {
              console.error(`   ❌ Critical SMS failed for ${farmer.full_name}:`, smsError.message);
            }
          }

          // Trigger immediate voice call
          try {
            await createCriticalAlertCall(farmer.id, 'low_moisture');
            console.log(`   📞 Critical voice call initiated for ${farmer.full_name}`);
          } catch (callError) {
            console.error(`   ❌ Critical voice call failed for ${farmer.full_name}:`, callError.message);
          }

          // Store critical alert
          await supabase.from('farm_alerts').insert({
            user_id: farmer.id,
            device_id: device.device_id,
            alert_type: 'low_moisture',
            severity: 'critical',
            message_bangla: alertMessage,
            message_english: `Critical Alert! Your soil moisture is ${moistureLevel}% which is very low. Please irrigate immediately. - AgriSense`,
            sensor_data: {
              moisture_level: moistureLevel,
              timestamp: device.last_updated
            },
            created_at: new Date().toISOString()
          });

          // Add delay between alerts
          await new Promise(resolve => setTimeout(resolve, 3000));

        } catch (error) {
          console.error(`Error processing critical alert for device ${device.device_id}:`, error);
        }
      }

    } catch (error) {
      console.error('Critical moisture check error:', error);
    }
  }

  isCriticalCondition(sensorData, weatherInfo) {
    // Define critical conditions
    const criticalMoisture = sensorData.moisture_level < 15;
    const criticalPH = sensorData.ph_level < 5.5 || sensorData.ph_level > 8.5;
    const criticalTemperature = sensorData.temperature > 40 || sensorData.temperature < 5;
    const criticalWeather = weatherInfo.temperature > 35 && weatherInfo.humidity < 30;

    return criticalMoisture || criticalPH || criticalTemperature || criticalWeather;
  }

  // Manual trigger methods for testing
  async triggerDailyAnalytics() {
    console.log('🔄 Manually triggering daily analytics...');
    await this.runDailyAnalytics();
  }

  async triggerMoistureCheck() {
    console.log('🔄 Manually triggering moisture check...');
    await this.checkCriticalMoisture();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      scheduledTasks: [
        {
          name: 'Daily Morning Analytics',
          schedule: '0 7 * * *',
          timezone: 'Asia/Dhaka',
          description: 'Runs comprehensive farm analysis for all farmers at 7:00 AM'
        },
        {
          name: 'Critical Moisture Check',
          schedule: '0 */2 * * *',
          timezone: 'Asia/Dhaka',
          description: 'Checks soil moisture levels every 2 hours and triggers alerts if < 15%'
        }
      ]
    };
  }
}

// Create singleton instance
const scheduledAnalyticsService = new ScheduledAnalyticsService();

module.exports = scheduledAnalyticsService;

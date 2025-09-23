const supabase = require('../config/database');
const { validationResult } = require('express-validator');

// Link device to user account
const linkDevice = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { apiKey, deviceName } = req.body;
    const userId = req.user.id;

    // Check if device exists and is available
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_api_key', apiKey)
      .single();

    if (deviceError || !device) {
      return res.status(404).json({ error: 'Invalid API key. Device not found.' });
    }

    if (device.user_id) {
      return res.status(400).json({ error: 'Device is already linked to another account.' });
    }

    // Link device to user
    const { data: updatedDevice, error: updateError } = await supabase
      .from('devices')
      .update({
        user_id: userId,
        device_name: deviceName || device.device_name,
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('device_api_key', apiKey)
      .select()
      .single();

    if (updateError) {
      return res.status(500).json({ error: 'Failed to link device' });
    }

    res.json({
      message: 'Device linked successfully',
      device: {
        id: updatedDevice.id,
        apiKey: updatedDevice.device_api_key,
        name: updatedDevice.device_name,
        status: 'linked'
      }
    });
  } catch (error) {
    console.error('Link device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get user's linked devices
const getUserDevices = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: devices, error } = await supabase
      .from('device_dashboard')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }

    res.json({ devices });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Unlink device from user account
const unlinkDevice = async (req, res) => {
  try {
    const { deviceId } = req.params;
    const userId = req.user.id;

    // Verify device belongs to user
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('id', deviceId)
      .eq('user_id', userId)
      .single();

    if (deviceError || !device) {
      return res.status(404).json({ error: 'Device not found or not owned by user' });
    }

    // Unlink device
    const { error: updateError } = await supabase
      .from('devices')
      .update({
        user_id: null,
        is_active: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', deviceId);

    if (updateError) {
      return res.status(500).json({ error: 'Failed to unlink device' });
    }

    res.json({ message: 'Device unlinked successfully' });
  } catch (error) {
    console.error('Unlink device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Receive sensor data from ESP32 (UPSERT approach)
const receiveSensorData = async (req, res) => {
  try {
    const { apiKey, moistureLevel } = req.body;

    // Validate API key and get device
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('*')
      .eq('device_api_key', apiKey)
      .eq('is_active', true)
      .single();

    if (deviceError || !device) {
      return res.status(401).json({ error: 'Invalid API key or inactive device' });
    }

    if (!device.user_id) {
      return res.status(400).json({ error: 'Device not linked to any user' });
    }

    // Generate mock sensor data
    const mockData = generateMockSensorData();

    // UPSERT sensor data (update if exists, insert if not)
    const { data: sensorData, error: upsertError } = await supabase
      .from('current_sensor_data')
      .upsert({
        device_id: device.id,
        user_id: device.user_id,
        moisture_level: moistureLevel,
        ...mockData,
        last_updated: new Date().toISOString()
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Upsert sensor data error:', upsertError);
      return res.status(500).json({ error: 'Failed to store sensor data' });
    }

    // Update device last seen
    await supabase
      .from('devices')
      .update({ last_seen: new Date().toISOString() })
      .eq('id', device.id);

    res.json({
      message: 'Sensor data updated successfully',
      deviceId: device.id,
      lastUpdated: sensorData.last_updated
    });
  } catch (error) {
    console.error('Receive sensor data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current sensor data for user
const getSensorData = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.query;

    let query = supabase
      .from('current_sensor_data')
      .select('*')
      .eq('user_id', userId)
      .order('last_updated', { ascending: false });

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { data: sensorData, error } = await query;

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch sensor data' });
    }

    res.json({ sensorData });
  } catch (error) {
    console.error('Get sensor data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate mock sensor data
function generateMockSensorData() {
  return {
    ph_level: (Math.random() * (8.5 - 6.0) + 6.0).toFixed(2), // pH 6.0-8.5
    temperature: (Math.random() * (35 - 18) + 18).toFixed(2), // 18-35°C
    humidity: (Math.random() * (90 - 40) + 40).toFixed(2), // 40-90%
    light_intensity: (Math.random() * (1000 - 100) + 100).toFixed(2), // 100-1000 lux
    soil_conductivity: (Math.random() * (500 - 100) + 100).toFixed(2), // 100-500 µS/cm
    nitrogen_level: (Math.random() * (80 - 20) + 20).toFixed(2), // 20-80 ppm
    phosphorus_level: (Math.random() * (50 - 10) + 10).toFixed(2), // 10-50 ppm
    potassium_level: (Math.random() * (70 - 20) + 20).toFixed(2) // 20-70 ppm
  };
}

module.exports = {
  linkDevice,
  getUserDevices,
  unlinkDevice,
  receiveSensorData,
  getSensorData
};

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

    // Prefer the database view for consolidated device + sensor snapshot
    const { data: devices, error } = await supabase
      .from('device_dashboard')
      .select('*')
      .eq('user_id', userId)
      .order('last_seen', { ascending: false });

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to fetch devices' });
    }

    // Normalize from view (and backfill status if view doesn't provide it)
    const now = Date.now();
    let normalized = (devices || []).map(d => {
      const lastSeenMs = d.last_seen ? new Date(d.last_seen).getTime() : 0;
      let derivedStatus = 'Offline';
      if (lastSeenMs) {
        const diffMin = (now - lastSeenMs) / 60000;
        if (diffMin <= 5) derivedStatus = 'Online';
        else if (diffMin <= 1440) derivedStatus = 'Recently Active';
      }
      return {
        device_id: d.device_id || d.id,
        device_name: d.device_name || 'Unnamed Device',
        device_api_key: d.device_api_key,
        status: d.status || derivedStatus,
        last_seen: d.last_seen,
        moisture_level: d.moisture_level ?? null,
        ph_level: d.ph_level ?? null,
        temperature: d.temperature ?? null,
        humidity: d.humidity ?? null,
        light_intensity: d.light_intensity ?? null,
        soil_conductivity: d.soil_conductivity ?? null,
        nitrogen_level: d.nitrogen_level ?? null,
        phosphorus_level: d.phosphorus_level ?? null,
        potassium_level: d.potassium_level ?? null,
        sensor_last_updated: d.sensor_last_updated ?? d.last_updated ?? null
      };
    });

    // Fallback: if some devices have no readings from the view, fetch directly from current_sensor_data
    const missingIds = normalized
      .filter(x => x.moisture_level === null && x.ph_level === null && x.temperature === null && x.humidity === null)
      .map(x => x.device_id);

    if (missingIds.length > 0) {
      const { data: directReadings } = await supabase
        .from('current_sensor_data')
        .select('*')
        .in('device_id', missingIds);
      const byId = (directReadings || []).reduce((acc, r) => { acc[r.device_id] = r; return acc; }, {});
      normalized = normalized.map(x => {
        if (byId[x.device_id]) {
          const r = byId[x.device_id];
          return {
            ...x,
            moisture_level: r.moisture_level ?? x.moisture_level,
            ph_level: r.ph_level ?? x.ph_level,
            temperature: r.temperature ?? x.temperature,
            humidity: r.humidity ?? x.humidity,
            light_intensity: r.light_intensity ?? x.light_intensity,
            soil_conductivity: r.soil_conductivity ?? x.soil_conductivity,
            nitrogen_level: r.nitrogen_level ?? x.nitrogen_level,
            phosphorus_level: r.phosphorus_level ?? x.phosphorus_level,
            potassium_level: r.potassium_level ?? x.potassium_level,
            sensor_last_updated: r.last_updated ?? x.sensor_last_updated
          };
        }
        return x;
      });
    }

    res.json({ devices: normalized });
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

    // Also persist to history table if present
    try {
      const historyPayload = {
        device_id: device.id,
        user_id: device.user_id,
        moisture_level: Number(sensorData.moisture_level),
        ph_level: Number(sensorData.ph_level),
        temperature: Number(sensorData.temperature),
        humidity: Number(sensorData.humidity),
        light_intensity: Number(sensorData.light_intensity),
        soil_conductivity: Number(sensorData.soil_conductivity),
        nitrogen_level: Number(sensorData.nitrogen_level),
        phosphorus_level: Number(sensorData.phosphorus_level),
        potassium_level: Number(sensorData.potassium_level),
        recorded_at: sensorData.last_updated || new Date().toISOString()
      };
      const { error: histErr } = await supabase
        .from('sensor_data_history')
        .insert(historyPayload);
      if (histErr) {
        console.warn('sensor_data_history insert failed:', histErr.message, 'payload:', historyPayload);
      } else {
        console.log('sensor_data_history insert ok for device', device.id);
      }
    } catch (e) {
      console.warn('sensor_data_history insert exception:', e.message);
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

// Get sensor readings history for a device (from sensor_data_history)
const getSensorHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId, limit = 100, range, from, to } = req.query;
    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Verify device ownership (admins can access any device)
    const { data: device, error: devErr } = await supabase
      .from('devices')
      .select('id, user_id')
      .eq('id', deviceId)
      .single();
    const isAdmin = req.user?.role === 'admin';
    if (devErr || !device || (!isAdmin && device.user_id !== userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const lim = Math.min(parseInt(limit, 10) || 100, 5000);
    let query = supabase
      .from('sensor_data_history')
      .select('*')
      .eq('device_id', deviceId);

    // Time range filter
    const now = Date.now();
    let startIso = null;
    if (from) {
      startIso = new Date(from).toISOString();
    } else if (range) {
      const unit = String(range).toLowerCase();
      let ms = 0;
      if (unit === '1h') ms = 60 * 60 * 1000;
      else if (unit === '1d') ms = 24 * 60 * 60 * 1000;
      else if (unit === '1w') ms = 7 * 24 * 60 * 60 * 1000;
      else if (unit === '1m') ms = 30 * 24 * 60 * 60 * 1000;
      else if (unit === '1y') ms = 365 * 24 * 60 * 60 * 1000;
      if (ms > 0) startIso = new Date(now - ms).toISOString();
    }
    if (startIso) query = query.gte('recorded_at', startIso);
    if (to) query = query.lte('recorded_at', new Date(to).toISOString());

    const { data, error } = await query
      .order('recorded_at', { ascending: false })
      .limit(lim);
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch sensor history' });
    }
    return res.json({ success: true, data });
  } catch (e) {
    console.error('Get sensor history error:', e);
    return res.status(500).json({ error: 'Failed to fetch sensor history' });
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
  getSensorData,
  getSensorHistory,
  // Return saved optimal settings for the authenticated farmer
  async getOptimalSettings(req, res) {
    try {
      const userId = req.user.id;
      const { data, error } = await supabase
        .from('farmer_optimal_settings')
        .select('optimal_json, updated_at, crop_name')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return res.json({ success: true, data: null });
      }

      return res.json({ success: true, data: data });
    } catch (e) {
      console.error('Get optimal settings error:', e);
      return res.status(500).json({ error: 'Failed to fetch optimal settings' });
    }
  },
  // Return optimal settings history if the history table exists
  async getOptimalSettingsHistory(req, res) {
    try {
      const userId = req.user.id;
      const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
      const { data, error } = await supabase
        .from('farmer_optimal_settings_history')
        .select('optimal_json, created_at, crop_name')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) return res.status(500).json({ error: 'Failed to fetch optimal settings history' });
      return res.json({ success: true, data });
    } catch (e) {
      console.error('Get optimal settings history error:', e);
      return res.status(500).json({ error: 'Failed to fetch optimal settings history' });
    }
  }
};

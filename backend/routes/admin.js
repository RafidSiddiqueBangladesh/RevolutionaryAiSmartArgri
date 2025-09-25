const express = require('express');
const { authenticateToken, requireRole } = require('../middleware/auth');
const supabase = require('../config/database');

const router = express.Router();

// GET /api/admin/farmers - list farmers with filters and device info
router.get('/farmers', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const { page = 1, limit = 12, name, mobile, districtId, district, crop } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 12;
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    // Base query
    let query = supabase
      .from('users')
      .select(`
        id,
        full_name,
        mobile_number,
        crop_name,
        district_id,
        land_size_acres,
        latitude,
        longitude,
        location_address,
        created_at,
        districts(name),
        devices(
          id,
          device_name,
          is_active,
          last_seen
        )
      `)
      .eq('role', 'farmer')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (name) {
      query = query.ilike('full_name', `%${name}%`);
    }
    if (mobile) {
      query = query.ilike('mobile_number', `%${mobile}%`);
    }
    if (districtId) {
      query = query.eq('district_id', Number(districtId));
    }
    if (crop) {
      query = query.ilike('crop_name', `%${crop}%`);
    }

    // Execute main query
    const { data: farmers, error } = await query;
    if (error) {
      console.error('Admin farmers query error:', error);
      return res.status(500).json({ error: 'Failed to fetch farmers' });
    }

    // Optional client-side district name filter (since cross-table ilike is not trivial)
    const filtered = district
      ? (farmers || []).filter(f => (f.districts?.name || '').toLowerCase().includes(String(district).toLowerCase()))
      : farmers || [];

    // Fetch current sensor data for first device per farmer (batch)
    const deviceIds = filtered
      .map(f => (Array.isArray(f.devices) && f.devices.length > 0 ? f.devices[0].id : null))
      .filter(Boolean);

    let readingsByDeviceId = {};
    if (deviceIds.length > 0) {
      const { data: readings, error: readingsError } = await supabase
        .from('current_sensor_data')
        .select('*')
        .in('device_id', deviceIds);
      if (readingsError) {
        console.warn('Admin: current_sensor_data query error:', readingsError);
      } else {
        readingsByDeviceId = (readings || []).reduce((acc, r) => {
          acc[r.device_id] = r;
          return acc;
        }, {});
      }
    }

    // Count query (without range)
    let countQuery = supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'farmer');
    if (name) countQuery = countQuery.ilike('full_name', `%${name}%`);
    if (mobile) countQuery = countQuery.ilike('mobile_number', `%${mobile}%`);
    if (districtId) countQuery = countQuery.eq('district_id', Number(districtId));
    if (crop) countQuery = countQuery.ilike('crop_name', `%${crop}%`);
    const { count, error: countError } = await countQuery;
    if (countError) {
      console.error('Admin farmers count error:', countError);
    }

    // Shape response for UI cards
    const items = filtered.map(f => ({
      id: f.id,
      fullName: f.full_name,
      mobileNumber: f.mobile_number,
      cropName: f.crop_name,
      district: f.districts?.name || null,
      landSizeAcres: f.land_size_acres,
      locationAddress: f.location_address,
      createdAt: f.created_at,
      device: Array.isArray(f.devices) && f.devices.length > 0 ? (() => {
        const d = f.devices[0];
        const r = readingsByDeviceId[d.id];
        return {
          id: d.id,
          name: d.device_name,
          isActive: d.is_active,
          lastSeen: d.last_seen,
          apiKey: d.device_api_key || null,
          readings: r ? {
            moisture_level: r.moisture_level,
            ph_level: r.ph_level,
            temperature: r.temperature,
            humidity: r.humidity,
            light_intensity: r.light_intensity,
            soil_conductivity: r.soil_conductivity,
            nitrogen_level: r.nitrogen_level,
            phosphorus_level: r.phosphorus_level,
            potassium_level: r.potassium_level,
            last_updated: r.last_updated
          } : null
        };
      })() : null
    }));

    return res.json({
      success: true,
      data: {
        items,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count ?? items.length,
          pages: count ? Math.ceil(count / limitNum) : 1
        }
      }
    });
  } catch (err) {
    console.error('Admin farmers endpoint error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;

/**
 * POST /api/admin/analyze-optimal
 * Admin-only: Iterate all farmers with active devices, gather weather + latest sensor snapshot,
 * call AI to get optimal ranges, and upsert into farmer_optimal_settings table.
 */
router.post('/analyze-optimal', authenticateToken, requireRole(['admin']), async (req, res) => {
  try {
    const supabase = require('../config/database');
    const { analyzeOptimalConditions } = require('../services/openaiService');

    // Get farmers that have at least one active device
    const { data: farmers, error: farmersError } = await supabase
      .from('users')
      .select(`
        id,
        full_name,
        land_size_acres,
        latitude,
        longitude,
        location_address,
        crop_name,
        devices(id, is_active)
      `)
      .eq('role', 'farmer');

    if (farmersError) {
      return res.status(500).json({ error: 'Failed to fetch farmers' });
    }

    const activeFarmers = (farmers || []).filter(f => Array.isArray(f.devices) && f.devices.some(d => d.is_active));

    let processed = 0;
    const results = [];
    for (const farmer of activeFarmers) {
      try {
        // Latest sensor snapshot for first active device
        const activeDevice = farmer.devices.find(d => d.is_active);
        const { data: sensor, error: sensorErr } = await supabase
          .from('current_sensor_data')
          .select('*')
          .eq('device_id', activeDevice.id)
          .single();

        // Weather from cache (<=30m) or skip
        let weather = null;
        try {
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
          const { data: wx } = await supabase
            .from('weather_cache')
            .select('data')
            .eq('type', 'current')
            .eq('latitude', String(parseFloat(farmer.latitude).toFixed(4)))
            .eq('longitude', String(parseFloat(farmer.longitude).toFixed(4)))
            .gt('created_at', thirtyMinutesAgo)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
          if (wx?.data) {
            const d = typeof wx.data === 'string' ? JSON.parse(wx.data) : wx.data;
            weather = {
              temperature: d?.main?.temp ?? null,
              humidity: d?.main?.humidity ?? null,
              rainfall: d?.rain?.['1h'] || d?.rain?.['3h'] || 0,
              forecast: d?.weather?.[0]?.description || null
            };
          }
        } catch (e) {}

        const context = {
          farmer: {
            id: farmer.id,
            name: farmer.full_name,
            location: farmer.location_address,
            landSize: farmer.land_size_acres
          },
          crop: { type: farmer.crop_name },
          weather: weather || {},
          sensors: sensor ? {
            soilMoisture: sensor.moisture_level,
            soilPH: sensor.ph_level,
            soilTemperature: sensor.temperature,
            humidity: sensor.humidity,
            lightIntensity: sensor.light_intensity,
            soilConductivity: sensor.soil_conductivity,
            nutrients: {
              nitrogen: sensor.nitrogen_level,
              phosphorus: sensor.phosphorus_level,
              potassium: sensor.potassium_level
            }
          } : {}
        };

        const ai = await analyzeOptimalConditions(context);

        // Upsert into farmer_optimal_settings (latest)
        const { error: upsertErr } = await supabase
          .from('farmer_optimal_settings')
          .upsert({
            user_id: farmer.id,
            crop_name: farmer.crop_name || null,
            optimal_json: ai.optimal,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (upsertErr) throw upsertErr;

        // Also append a history record (if table exists)
        try {
          await supabase
            .from('farmer_optimal_settings_history')
            .insert({
              user_id: farmer.id,
              crop_name: farmer.crop_name || null,
              optimal_json: ai.optimal,
              created_at: new Date().toISOString()
            });
        } catch (ignore) {}
        processed += 1;
        results.push({ userId: farmer.id, success: true });

        // small delay to avoid rate limits
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        results.push({ userId: farmer.id, success: false, error: err.message });
      }
    }

    return res.json({ success: true, processed, total: activeFarmers.length, results });
  } catch (err) {
    console.error('analyze-optimal error:', err);
    return res.status(500).json({ error: 'Failed to analyze optimal settings' });
  }
});


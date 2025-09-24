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



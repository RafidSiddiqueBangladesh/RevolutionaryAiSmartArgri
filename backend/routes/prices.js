const express = require('express');
const { body, param } = require('express-validator');
const supabase = require('../config/database');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Units allowed
const ALLOWED_UNITS = ['kg', 'mon', 'quintal', 'ton'];

// GET /api/prices - list all crop prices (auth: any logged-in user)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crop_prices')
      .select('*')
      .order('crop_name', { ascending: true });

    if (error) {
      console.error('Get prices error:', error);
      return res.status(500).json({ error: 'Failed to fetch prices' });
    }

    return res.json({ prices: data || [] });
  } catch (err) {
    console.error('Prices list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/prices/public - list all crop prices (no auth)
router.get('/public', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('crop_prices')
      .select('crop_name, unit, price')
      .order('crop_name', { ascending: true });

    if (error) {
      console.error('Get public prices error:', error);
      return res.status(500).json({ error: 'Failed to fetch prices' });
    }

    const simplified = (data || []).map(p => ({
      name: p.crop_name,
      unit: p.unit,
      price: p.price
    }));

    return res.json({ prices: simplified });
  } catch (err) {
    console.error('Public prices list error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/prices - create or upsert a crop price (admin)
router.post(
  '/',
  authenticateToken,
  requireRole(['admin']),
  [
    body('cropName').trim().isLength({ min: 2, max: 100 }),
    body('unit').isIn(ALLOWED_UNITS),
    body('price').isFloat({ min: 0 })
  ],
  async (req, res) => {
    try {
      const { cropName, unit, price } = req.body;

      // Upsert one row per crop_name
      const { data, error } = await supabase
        .from('crop_prices')
        .upsert({
          crop_name: cropName,
          unit: unit,
          price: price,
          updated_at: new Date().toISOString()
        }, { onConflict: 'crop_name' })
        .select()
        .single();

      if (error) {
        console.error('Create/Upsert price error:', error);
        return res.status(500).json({ error: 'Failed to save price' });
      }

      return res.status(201).json({ price: data });
    } catch (err) {
      console.error('Create price error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// PUT /api/prices/:id - update existing price (admin)
router.put(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  [
    param('id').isString(),
    body('cropName').optional().trim().isLength({ min: 2, max: 100 }),
    body('unit').optional().isIn(ALLOWED_UNITS),
    body('price').optional().isFloat({ min: 0 })
  ],
  async (req, res) => {
    try {
      const { id } = req.params;
      const { cropName, unit, price } = req.body;

      const update = { updated_at: new Date().toISOString() };
      if (cropName) update.crop_name = cropName;
      if (unit) update.unit = unit;
      if (price !== undefined) update.price = price;

      const { data, error } = await supabase
        .from('crop_prices')
        .update(update)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update price error:', error);
        return res.status(500).json({ error: 'Failed to update price' });
      }

      return res.json({ price: data });
    } catch (err) {
      console.error('Update price err:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// DELETE /api/prices/:id - delete price (admin)
router.delete(
  '/:id',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { error } = await supabase
        .from('crop_prices')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete price error:', error);
        return res.status(500).json({ error: 'Failed to delete price' });
      }

      return res.json({ success: true });
    } catch (err) {
      console.error('Delete price err:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;



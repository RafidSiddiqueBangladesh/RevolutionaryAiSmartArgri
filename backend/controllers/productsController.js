const { validationResult } = require('express-validator');
const supabase = require('../config/database');

// Public: list products with search and pagination
async function listPublic(req, res) {
  try {
    const { page = 1, limit = 12, search } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 12, 50);
    const from = (pageNum - 1) * limitNum;
    const to = from + limitNum - 1;

    let query = supabase
      .from('products')
      .select(`
        id,
        user_id,
        product_name,
        unit_price,
        unit,
        description,
        created_at,
        users(full_name, mobile_number, location_address)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.ilike('product_name', `%${search}%`);
    }

    const { data: items, error } = await query;
    if (error) {
      return res.status(500).json({ error: 'Failed to fetch products' });
    }

    // Count (without range)
    let countQuery = supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true);
    if (search) countQuery = countQuery.ilike('product_name', `%${search}%`);
    const { count } = await countQuery;

    return res.json({
      success: true,
      data: {
        items: items || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count ?? (items ? items.length : 0),
          pages: count ? Math.ceil(count / limitNum) : 1
        }
      }
    });
  } catch (e) {
    console.error('listPublic products error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Auth: list my products
async function listMine(req, res) {
  try {
    const userId = req.user.id;
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'Failed to fetch products' });
    return res.json({ success: true, items: data || [] });
  } catch (e) {
    console.error('listMine products error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Auth: create product
async function createProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.user.id;
    const { productName, unitPrice, unit, description } = req.body;

    const { data, error } = await supabase
      .from('products')
      .insert({
        user_id: userId,
        product_name: productName,
        unit_price: unitPrice,
        unit: unit,
        description: description || null,
        is_active: true
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: 'Failed to create product' });
    return res.status(201).json({ success: true, product: data });
  } catch (e) {
    console.error('createProduct error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Auth: update product (owner only)
async function updateProduct(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const userId = req.user.id;
    const { id } = req.params;
    const { productName, unitPrice, unit, description, isActive } = req.body;

    // Verify ownership
    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (findErr || !existing || existing.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const update = { updated_at: new Date().toISOString() };
    if (productName !== undefined) update.product_name = productName;
    if (unitPrice !== undefined) update.unit_price = unitPrice;
    if (unit !== undefined) update.unit = unit;
    if (description !== undefined) update.description = description;
    if (typeof isActive === 'boolean') update.is_active = isActive;

    const { data, error } = await supabase
      .from('products')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) return res.status(500).json({ error: 'Failed to update product' });
    return res.json({ success: true, product: data });
  } catch (e) {
    console.error('updateProduct error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Auth: delete product (owner only)
async function deleteProduct(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    // Verify ownership
    const { data: existing, error: findErr } = await supabase
      .from('products')
      .select('id, user_id')
      .eq('id', id)
      .single();
    if (findErr || !existing || existing.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);
    if (error) return res.status(500).json({ error: 'Failed to delete product' });
    return res.json({ success: true });
  } catch (e) {
    console.error('deleteProduct error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = {
  listPublic,
  listMine,
  createProduct,
  updateProduct,
  deleteProduct
};



const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const supabase = require('../config/database');

// Generate JWT token
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Signup (Farmers only)
const signup = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { fullName, mobileNumber, password, cropName, districtId, landSizeAcres, latitude, longitude, locationAddress } = req.body;

    // Check if mobile number already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('mobile_number', mobileNumber)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert new farmer
    const { data: newUser, error } = await supabase
      .from('users')
      .insert([{
        full_name: fullName,
        mobile_number: mobileNumber,
        password: hashedPassword,
        crop_name: cropName,
        district_id: districtId,
        land_size_acres: landSizeAcres,
        latitude: latitude,
        longitude: longitude,
        location_address: locationAddress,
        role: 'farmer'
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ error: 'Failed to create account' });
    }

    // Generate token
    const token = generateToken(newUser.id, newUser.role);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user: {
        id: newUser.id,
        fullName: newUser.full_name,
        mobileNumber: newUser.mobile_number,
        cropName: newUser.crop_name,
        districtId: newUser.district_id,
        landSizeAcres: newUser.land_size_acres,
        latitude: newUser.latitude,
        longitude: newUser.longitude,
        locationAddress: newUser.location_address,
        role: newUser.role
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Login (Both farmers and admins)
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { mobileNumber, password } = req.body;

    // Find user by mobile number
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('mobile_number', mobileNumber)
      .single();

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get district information separately
    let districtName = null;
    if (user.district_id) {
      const { data: district } = await supabase
        .from('districts')
        .select('name')
        .eq('id', user.district_id)
        .single();
      
      districtName = district?.name || null;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = generateToken(user.id, user.role);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        fullName: user.full_name,
        mobileNumber: user.mobile_number,
        cropName: user.crop_name,
        district: districtName,
        landSizeAcres: user.land_size_acres,
        latitude: user.latitude,
        longitude: user.longitude,
        locationAddress: user.location_address,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get district information separately
    let districtName = null;
    if (user.district_id) {
      const { data: district } = await supabase
        .from('districts')
        .select('name')
        .eq('id', user.district_id)
        .single();
      
      districtName = district?.name || null;
    }

    res.json({
      user: {
        id: user.id,
        fullName: user.full_name,
        mobileNumber: user.mobile_number,
        cropName: user.crop_name,
        district: districtName,
        landSizeAcres: user.land_size_acres,
        latitude: user.latitude,
        longitude: user.longitude,
        locationAddress: user.location_address,
        role: user.role,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all districts
const getDistricts = async (req, res) => {
  try {
    const { data: districts, error } = await supabase
      .from('districts')
      .select('*')
      .order('name');

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch districts' });
    }

    res.json({ districts });
  } catch (error) {
    console.error('Districts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  signup,
  login,
  getProfile,
  getDistricts
};

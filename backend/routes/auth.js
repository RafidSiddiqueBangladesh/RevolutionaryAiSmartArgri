const express = require('express');
const { body } = require('express-validator');
const { signup, login, getProfile, getDistricts } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const signupValidation = [
  body('fullName')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Full name must be between 2 and 100 characters'),
  body('mobileNumber')
    .matches(/^\+8801[3-9]\d{8}$/)
    .withMessage('Please provide a valid Bangladeshi mobile number (+8801XXXXXXXXX)'),
  body('password')
    .isLength({ min: 6, max: 100 })
    .withMessage('Password must be between 6 and 100 characters'),
  body('cropName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Crop name must be between 2 and 50 characters'),
  body('districtId')
    .isInt({ min: 1, max: 64 })
    .withMessage('Please select a valid district'),
  body('landSizeAcres')
    .isFloat({ min: 0.01, max: 10000 })
    .withMessage('Land size must be between 0.01 and 10000 acres'),
  body('latitude')
    .optional()
    .isFloat({ min: -90, max: 90 })
    .withMessage('Invalid latitude'),
  body('longitude')
    .optional()
    .isFloat({ min: -180, max: 180 })
    .withMessage('Invalid longitude'),
  body('locationAddress')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Location address must be less than 500 characters')
];

const loginValidation = [
  body('mobileNumber')
    .matches(/^\+8801[3-9]\d{8}$/)
    .withMessage('Please provide a valid mobile number (+8801XXXXXXXXX)'),
  body('password')
    .isLength({ min: 1 })
    .withMessage('Password is required')
];

// Routes
router.post('/signup', signupValidation, signup);
router.post('/login', loginValidation, login);
router.get('/profile', authenticateToken, getProfile);
router.get('/districts', getDistricts);

module.exports = router;

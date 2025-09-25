const express = require('express');
const { body, param, query } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const controller = require('../controllers/productsController');

const router = express.Router();

// Public listing with search/pagination
router.get(
  '/',
  [
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('search').optional().trim().isLength({ min: 1, max: 100 })
  ],
  controller.listPublic
);

// Authenticated: list my products
router.get('/mine', authenticateToken, controller.listMine);

// Create product
router.post(
  '/',
  authenticateToken,
  [
    body('productName').trim().isLength({ min: 2, max: 120 }),
    body('unitPrice').isFloat({ min: 0 }),
    body('unit').isIn(['kg', 'mon', 'quintal', 'ton']),
    body('description').optional().trim().isLength({ max: 1000 })
  ],
  controller.createProduct
);

// Update product
router.put(
  '/:id',
  authenticateToken,
  [
    param('id').isString(),
    body('productName').optional().trim().isLength({ min: 2, max: 120 }),
    body('unitPrice').optional().isFloat({ min: 0 }),
    body('unit').optional().isIn(['kg', 'mon', 'quintal', 'ton']),
    body('description').optional().trim().isLength({ max: 1000 }),
    body('isActive').optional().isBoolean()
  ],
  controller.updateProduct
);

// Delete product
router.delete(
  '/:id',
  authenticateToken,
  [param('id').isString()],
  controller.deleteProduct
);

module.exports = router;



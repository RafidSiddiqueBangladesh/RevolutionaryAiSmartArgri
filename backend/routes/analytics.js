const express = require('express');
const { getFarmAnalysis, getChatbotFarmData } = require('../controllers/analyticsController');
const { sendTestSMS } = require('../services/smsService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Get farm analysis with AI recommendations
router.get('/farm-analysis', authenticateToken, getFarmAnalysis);

// Chatbot endpoint with comprehensive farm data
router.post('/chatbot', authenticateToken, getChatbotFarmData);

// Test SMS endpoint (for development/testing)
router.post('/test-sms', authenticateToken, async (req, res) => {
  try {
    const { testNumber } = req.body;
    
    if (!testNumber) {
      return res.status(400).json({ error: 'Test number is required' });
    }

    console.log('Testing SMS to:', testNumber);
    const result = await sendTestSMS(testNumber);
    
    res.json({
      success: true,
      smsResult: result,
      message: 'SMS test completed'
    });
  } catch (error) {
    console.error('SMS test error:', error);
    res.status(500).json({ 
      error: 'SMS test failed',
      message: error.message 
    });
  }
});

module.exports = router;
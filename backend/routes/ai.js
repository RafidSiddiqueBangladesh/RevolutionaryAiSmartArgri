const express = require('express');
const router = express.Router();

// Simple in-memory store for last callback payloads (dev utility)
let lastAnalysisCallback = null;
let lastChatbotCallback = null;

// Get current AI provider and callback status
router.get('/provider', (req, res) => {
  res.json({
    provider: (process.env.AI_PROVIDER || 'openai').toLowerCase(),
    callbacks: {
      analysisCallbackConfigured: !!process.env.SMYTHOS_ANALYSIS_CALLBACK_URL,
      chatbotCallbackConfigured: !!process.env.SMYTHOS_CHATBOT_CALLBACK_URL
    }
  });
});

// Smythos analysis callback endpoint (external system posts processed analysis here)
router.post('/callback/analysis', async (req, res) => {
  try {
    lastAnalysisCallback = {
      receivedAt: new Date().toISOString(),
      body: req.body
    };
    // Accept either flat or nested Smythos format
    const raw = req.body || {};
    const output = raw?.result?.Output || raw;
    const meta = raw?.meta || {};
    if (!output || typeof output.actionRequired === 'undefined' || !('analysis' in output)) {
      return res.status(400).json({ error: 'Invalid analysis callback payload' });
    }

    // Extract identifiers for pipeline continuation
    const userId = output.userId || raw.userId || meta.userId || req.query.userId || req.headers['x-user-id'] || null;

    // Optionally, you could enqueue work here using userId
    return res.json({ success: true });
  } catch (error) {
    console.error('Analysis callback error:', error);
    return res.status(500).json({ error: 'Failed to process analysis callback' });
  }
});

// Smythos chatbot callback endpoint (external system posts chatbot text response here)
router.post('/callback/chatbot', async (req, res) => {
  try {
    lastChatbotCallback = {
      receivedAt: new Date().toISOString(),
      body: req.body
    };
    const raw = req.body || {};
    const responseText = raw?.result?.Output?.response ?? raw?.response;
    if (typeof responseText !== 'string') {
      return res.status(400).json({ error: 'Invalid chatbot callback payload' });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Chatbot callback error:', error);
    return res.status(500).json({ error: 'Failed to process chatbot callback' });
  }
});

// Dev utility: fetch last received callback payloads (protected by env token if set)
router.get('/callbacks/last', (req, res) => {
  const token = req.headers['x-internal-token'];
  if (process.env.INTERNAL_API_TOKEN && token !== process.env.INTERNAL_API_TOKEN) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  res.json({ lastAnalysisCallback, lastChatbotCallback });
});

module.exports = router;



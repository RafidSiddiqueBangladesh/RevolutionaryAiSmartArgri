// Import required modules
const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const imageUpload = require('../middleware/imageUpload');
const openaiService = require('../services/openaiService');

// Simple in-memory store for last callback payloads (dev utility)
let lastAnalysisCallback = null;
let lastChatbotCallback = null;

// AI provider status endpoint
router.get('/status', (req, res) => {
  res.json({ status: 'operational' });
});

// Callback endpoint for AI analysis
router.post('/callback', (req, res) => {
  // Handle callback from external AI system (Smythos)
  const payload = req.body;
  
  // Extract user ID for pipeline continuation
  const userId = payload.metadata?.userId;
  
  res.status(200).json({ received: true });
});

// Receipt scanning endpoint
router.post('/scan-receipt', imageUpload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Read the uploaded file
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');

    // Analyze the receipt using OpenAI
    const analysis = await openaiService.analyzeReceipt(base64Image);

    // Delete the temporary file
    fs.unlinkSync(imagePath);

    res.json({ success: true, data: analysis.data });
  } catch (error) {
    console.error('Receipt scanning error:', error);
    res.status(500).json({ error: 'Failed to scan receipt' });
  }
});

// Process image in chat endpoint
router.post('/process-image', imageUpload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Read the uploaded file
    const imagePath = req.file.path;
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Get the user's message if provided
    const userMessage = req.body.message || 'What can you tell me about this image?';
    
    // Get conversation history if provided
    const conversationHistory = req.body.conversationHistory || [];

    // Process the image using OpenAI with conversation history
    const response = await openaiService.processImageInChat(base64Image, userMessage, conversationHistory);

    // Delete the temporary file
    fs.unlinkSync(imagePath);

    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('Image processing error:', error);
    res.status(500).json({ error: 'Failed to process image' });
  }
});

module.exports = router;



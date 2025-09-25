import api from './api';

/**
 * Send message to AgriSense AI chatbot with comprehensive farm context
 * @param {string} message - User's message/question
 * @returns {Promise<Object>} Chatbot response with farm context
 */
export const sendChatMessage = async (message) => {
  try {
    const response = await api.post('/analytics/chatbot', {
      message: message.trim()
    });
    
    return {
      success: true,
      data: response.data.data,
      timestamp: response.data.data.timestamp
    };
  } catch (error) {
    console.error('Chatbot service error:', error);
    
    // Return error response
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to send message',
      fallbackResponse: "আমি এখন সংযোগ স্থাপনে সমস্যা হচ্ছে। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।"
    };
  }
};

/**
 * Get a welcome message with current farm status
 * @returns {string} Welcome message
 */
export const getWelcomeMessage = () => {
  const currentTime = new Date().getHours();
  let greeting;
  
  if (currentTime < 12) {
    greeting = "সুপ্রভাত!";
  } else if (currentTime < 17) {
    greeting = "শুভ দুপুর!";
  } else {
    greeting = "শুভ সন্ধ্যা!";
  }
  
  return `${greeting} আমি আপনার AgriSense AI সহায়ক। আমার কাছে আপনার খামারের সকল তথ্য রয়েছে যার মধ্যে রয়েছে লাইভ সেন্সর রিডিং, আবহাওয়ার অবস্থা এবং ফসলের তথ্য। আজ আমি কিভাবে আপনাকে সাহায্য করতে পারি?`;
};

/**
 * Get suggested questions for the chatbot
 * @returns {Array<string>} List of suggested questions
 */
export const getSuggestedQuestions = () => {
  return [
    "আমার মাটির আর্দ্রতা কেমন?",
    "কখন ফসলে পানি দিতে হবে?",
    "আমার মাটির pH কত?",
    "সার দেওয়ার প্রয়োজন আছে কি?",
    "আমার NPK লেভেল কেমন?",
    "আবহাওয়ার পূর্বাভাস কেমন?",
    "আমার ফসলের জন্য কোন পরামর্শ?",
    "কোন বিষয়ে চিন্তিত হওয়ার আছে?"
  ];
};

/**
 * Send image to chatbot with user message
 * @param {File} imageFile - The image file to upload
 * @param {string} message - User's message about the image
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Promise<Object>} Chatbot response with image analysis
 */
export const sendImageMessage = async (imageFile, message = '', conversationHistory = []) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);
    formData.append('message', message);
    
    // Add conversation history to the request
    if (conversationHistory.length > 0) {
      formData.append('conversationHistory', JSON.stringify(conversationHistory));
    }
    
    const response = await api.post('/ai/process-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    return {
      success: true,
      data: response.data.data,
      isImageResponse: true
    };
  } catch (error) {
    console.error('Image upload error:', error);
    return {
      success: false,
      error: error.response?.data?.error || 'Failed to process image',
      fallbackResponse: "আমি এই ছবিটি প্রক্রিয়া করতে অক্ষম। অনুগ্রহ করে আবার চেষ্টা করুন।"
    };
  }
};

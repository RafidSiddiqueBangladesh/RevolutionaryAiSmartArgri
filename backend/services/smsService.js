const axios = require('axios');
require('dotenv').config();

/**
 * SMS Service using BulkSMSBD API
 * Sends critical farm alerts to farmers via SMS
 */

const SMS_API_KEY = process.env.SMS_API_KEY || 'VsBKoj5dLZ6aNa3AgWtD';
const SMS_API_URL = 'http://bulksmsbd.net/api/smsapi';
const SMS_SENDER_ID = '8809648904226';

/**
 * Send SMS using BulkSMSBD API
 * @param {string} mobileNumber - Farmer's mobile number in +8801XXXXXXXXX format
 * @param {string} message - SMS message in Bangla
 * @returns {Promise<Object>} SMS API response
 */
async function sendSMS(mobileNumber, message) {
  try {
    console.log('\n===== SENDING SMS =====');
    console.log('Recipient:', mobileNumber);
    console.log('Message:', message);
    console.log('API Key:', SMS_API_KEY.substring(0, 8) + '...');
    console.log('Sender ID:', SMS_SENDER_ID);
    console.log('======================');

    // Format mobile number (ensure it includes + prefix)
    const formattedNumber = mobileNumber.startsWith('+') ? mobileNumber : '+' + mobileNumber;
    
    // Build URL with query parameters (GET request format)
    const params = new URLSearchParams({
      api_key: SMS_API_KEY,
      type: 'text',
      number: formattedNumber,
      senderid: SMS_SENDER_ID,
      message: message
    });

    const url = `${SMS_API_URL}?${params.toString()}`;
    
    console.log('SMS Request URL:', url);

    const response = await axios.get(url, {
      timeout: 10000, // 10 second timeout
    });

    console.log('SMS Response Status:', response.status);
    console.log('SMS Response Data:', JSON.stringify(response.data, null, 2));

    // Check if SMS was sent successfully
    // BulkSMSBD returns response_code 202 for success
    const success = response.status === 200 && response.data?.response_code === 202;
    
    return {
      success: success,
      response: response.data,
      timestamp: new Date().toISOString(),
      recipient: mobileNumber,
      message: message,
      messageId: response.data?.message_id,
      responseCode: response.data?.response_code,
      successMessage: response.data?.success_message,
      errorMessage: response.data?.error_message
    };

  } catch (error) {
    console.error('SMS sending error:', error.message);
    console.error('SMS error details:', error.response?.data || 'No additional details');
    
    return {
      success: false,
      error: error.message,
      response: error.response?.data || null,
      timestamp: new Date().toISOString(),
      recipient: mobileNumber,
      message: message
    };
  }
}

/**
 * Validate mobile number format for Bangladesh
 * @param {string} mobileNumber - Mobile number to validate
 * @returns {boolean} True if valid Bangladeshi mobile number
 */
function isValidBangladeshiMobile(mobileNumber) {
  // Bangladeshi mobile format: +8801XXXXXXXXX or 8801XXXXXXXXX
  const regex = /^(\+?880)?1[3-9]\d{8}$/;
  return regex.test(mobileNumber);
}

/**
 * Format mobile number to standard format
 * @param {string} mobileNumber - Mobile number to format
 * @returns {string} Formatted mobile number with +880 prefix
 */
function formatMobileNumber(mobileNumber) {
  // Remove any spaces or special characters
  let cleaned = mobileNumber.replace(/\s+/g, '');
  
  // Add +880 prefix if not present
  if (cleaned.startsWith('01')) {
    cleaned = '+880' + cleaned.substring(1);
  } else if (cleaned.startsWith('1') && cleaned.length === 10) {
    cleaned = '+880' + cleaned;
  } else if (cleaned.startsWith('880')) {
    cleaned = '+' + cleaned;
  } else if (!cleaned.startsWith('+880')) {
    cleaned = '+880' + cleaned;
  }
  
  return cleaned;
}

/**
 * Send test SMS to verify configuration
 * @param {string} testNumber - Test mobile number
 * @returns {Promise<Object>} Test result
 */
async function sendTestSMS(testNumber) {
  const testMessage = 'AgriSense পরীক্ষা বার্তা। আপনার খামারের জন্য স্মার্ট কৃষি সেবা।';
  console.log('Sending test SMS with BulkSMSBD API...');
  return await sendSMS(testNumber, testMessage);
}

module.exports = {
  sendSMS,
  isValidBangladeshiMobile,
  formatMobileNumber,
  sendTestSMS
};

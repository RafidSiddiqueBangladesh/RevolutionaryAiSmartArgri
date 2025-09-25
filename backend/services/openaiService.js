const { OpenAI } = require('openai');
const axios = require('axios');
require('dotenv').config();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze receipt image using OpenAI Vision API
 * @param {string} base64Image - Base64 encoded image
 * @returns {Promise<Object>} Receipt analysis results
 */
async function analyzeReceipt(base64Image) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "This is a receipt image. Please extract the following information in JSON format: date, vendor name, items purchased (with prices if available), total amount, and payment method." },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 1000
    });

    return {
      success: true,
      data: response.choices[0].message.content
    };
  } catch (error) {
    console.error("OpenAI receipt analysis error:", error);
    throw new Error(`Failed to analyze receipt: ${error.message}`);
  }
}

/**
 * Analyze farm data using OpenAI
 * @param {Object} data - Combined data for analysis
 * @param {Object} data.weather - Weather data
 * @param {Object} data.farmer - Farmer information
 * @param {Object} data.sensors - Sensor readings
 * @param {Object} data.crop - Crop information
 * @returns {Promise<Object>} Analysis results and recommendations
 */
async function analyzeData(data) {
  try {
    const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
    if (provider === 'smythos') {
      // Forward request to Smythos external agent and expect compatible response
      const url = process.env.SMYTHOS_OUTBOUND_ANALYSIS_URL || 'https://cmfwuqtpo168o23qufoye75r8.agent.pa.smyth.ai/api/analyze_farmer_data';
      if (!url) {
        throw new Error('SMYTHOS_OUTBOUND_ANALYSIS_URL is not set');
      }

      const response = await axios.post(url, {
        farmerData: data,
        userId: data?.meta?.userId || null
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-ai-provider': 'smythos',
          'x-webhook-callback': process.env.SMYTHOS_ANALYSIS_CALLBACK_URL || ''
        },
        timeout: 20000
      });

      // Support two shapes:
      // 1) { analysis, actionRequired, message }
      // 2) { id, name, result: { Output: { analysis, actionRequired, message } } }
      const raw = response.data || {};
      const output = raw?.result?.Output || raw;
      if (!output || typeof output.actionRequired === 'undefined' || !('analysis' in output)) {
        throw new Error('Smythos response missing required fields (analysis/actionRequired)');
      }

      return {
        timestamp: new Date().toISOString(),
        analysis: output.analysis,
        actionRequired: Boolean(output.actionRequired),
        message: output.message ?? null,
        userId: output.userId || data?.meta?.userId || null,
        provider: 'smythos'
      };
    }

    const { weather, farmer, sensors, crop } = data;
    
    // Enhanced logging for OpenAI requests
    console.log('\n===== DATA BEING SENT TO OPENAI =====');
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log('SOURCE TYPE:', data.analysisType || 'on-demand');
    console.log('FARMER INFO:', JSON.stringify(farmer, null, 2));
    console.log('CROP INFO:', JSON.stringify(crop, null, 2));
    console.log('WEATHER DATA:', JSON.stringify(weather, null, 2));
    console.log('SENSOR READINGS:', JSON.stringify(sensors, null, 2));
    console.log('=====================================\n');
    
    // Prepare the prompt with all relevant data including NPK values
    const prompt = `
    Analyze this agricultural data and provide recommendations in STRICT JSON format:
    
    FARM INFORMATION:
    - Farmer: ${farmer.name || 'Unknown'}
    - Location: ${farmer.location || 'Unknown'}
    - Land Size: ${farmer.landSize || 'Unknown'} acres
    - Crop Type: ${crop.type || 'Unknown'}
    
    WEATHER DATA:
    - Temperature: ${weather.temperature || 'Unknown'}°C
    - Humidity: ${weather.humidity || 'Unknown'}%
    - Rainfall: ${weather.rainfall || 'Unknown'} mm
    - Forecast: ${weather.forecast || 'Unknown'}
    
    SENSOR READINGS:
    - Soil Moisture (Critical parameter and most important): ${sensors.soilMoisture !== undefined && sensors.soilMoisture !== null ? sensors.soilMoisture : 'Unknown'}%
    - Soil pH: ${sensors.soilPH !== undefined && sensors.soilPH !== null ? sensors.soilPH : 'Unknown'}
    - Soil Temperature: ${sensors.soilTemperature !== undefined && sensors.soilTemperature !== null ? sensors.soilTemperature : 'Unknown'}°C
    - Light Intensity: ${sensors.lightIntensity !== undefined && sensors.lightIntensity !== null ? sensors.lightIntensity : 'Unknown'} lux
    - Soil Conductivity: ${sensors.soilConductivity !== undefined && sensors.soilConductivity !== null ? sensors.soilConductivity : 'Unknown'} μS/cm
    
    SOIL NUTRIENTS:
    - Nitrogen (N): ${sensors.nutrients?.nitrogen !== undefined && sensors.nutrients?.nitrogen !== null ? sensors.nutrients.nitrogen : 'Unknown'} ppm
    - Phosphorus (P): ${sensors.nutrients?.phosphorus !== undefined && sensors.nutrients?.phosphorus !== null ? sensors.nutrients.phosphorus : 'Unknown'} ppm
    - Potassium (K): ${sensors.nutrients?.potassium !== undefined && sensors.nutrients?.potassium !== null ? sensors.nutrients.potassium : 'Unknown'} ppm
    
    RETURN RESPONSE IN THIS EXACT JSON FORMAT:
    {
      "analysis": "Detailed analysis and recommendations in Bengali (Bangla) language for the farmer dashboard. Use simple Bengali that farmers can understand easily. Use 4-5 points on analitics.",
      "actionRequired": true/false,
      "message": "Very short 2-3 sentence instruction in Bangla for SMS if actionRequired is true, null if false"
    }
    
    CRITICAL CONDITIONS for actionRequired=true:
    - Soil moisture below 20% (drought stress) - MOST CRITICAL! 0% moisture = SEVERE DROUGHT
    - Soil moisture above 90% (waterlogging risk)
    - pH below 5.5 or above 8.5 (nutrient lockout)
    - Temperature below 10°C or above 40°C (extreme temperature)
    - Any combination that poses immediate crop risk
    
    IMPORTANT: 0% soil moisture is NOT missing data - it means IMMEDIATE irrigation needed!
    
    when action is required provide your suggestion in bangla messege in 1-2 sentence. first priority to moisture.
    `;

    // Call OpenAI API
    console.log('Sending request to OpenAI API...');
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: "You are an agricultural expert AI that analyzes farm data and provides structured JSON responses. You MUST respond with valid JSON only - no additional text before or after. Focus on practical advice and identify critical conditions requiring immediate farmer action. Always write your analysis in Bengali (Bangla) language using proper Unicode Bengali script as this is for farmers in Bangladesh who prefer Bengali."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`OpenAI API response received in ${duration} seconds`);
    console.log('Response tokens:', response.usage);

    // Parse the JSON response from OpenAI
    const rawResponse = response.choices[0].message.content;
    console.log('Raw OpenAI Response:', rawResponse);
    
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(rawResponse);
    } catch (parseError) {
      console.error('Failed to parse OpenAI JSON response:', parseError);
      console.error('Raw response:', rawResponse);
      throw new Error('OpenAI returned invalid JSON format');
    }

    // Validate response structure
    if (!parsedResponse.analysis || typeof parsedResponse.actionRequired !== 'boolean') {
      console.error('Invalid response structure:', parsedResponse);
      throw new Error('OpenAI response missing required fields');
    }

    // Extract and structure the response
    const analysis = {
      timestamp: new Date().toISOString(),
      analysis: parsedResponse.analysis,
      actionRequired: parsedResponse.actionRequired,
      message: parsedResponse.message,
      usage: response.usage,
      processingTime: `${duration} seconds`
    };

    // Log a summary of the analysis
    console.log('\n===== ANALYSIS RESULTS =====');
    console.log('Analysis completed at:', analysis.timestamp);
    console.log('Processing time:', analysis.processingTime);
    console.log('Token usage:', analysis.usage.total_tokens);
    console.log('Action Required:', analysis.actionRequired);
    if (analysis.actionRequired) {
      console.log('Alert Message (Bangla):', analysis.message);
    }
    console.log('============================\n');

    return analysis;
  } catch (error) {
    console.error('OpenAI analysis error:', error);
    throw new Error(`Failed to analyze farm data: ${error.message}`);
  }
}

/**
 * Generate chatbot response using OpenAI with complete farm context
 * @param {Object} farmContext - Complete farm data including sensors, weather, farmer info
 * @param {string} userMessage - User's question/message
 * @returns {Promise<string>} Personalized response
 */
async function chatResponse(farmContext, userMessage) {
  try {
    console.log('\n===== CHATBOT OPENAI REQUEST =====');
    console.log('TIMESTAMP:', new Date().toISOString());
    console.log('USER MESSAGE:', userMessage);
    console.log('FARM CONTEXT:', JSON.stringify(farmContext, null, 2));
    console.log('==================================\n');
    
    // Prepare comprehensive prompt with all farm data
    const prompt = `
    You are AgriSense AI, a friendly and knowledgeable agricultural assistant specifically helping ${farmContext.farmer.name}. 
    
    FARMER PROFILE:
    - Name: ${farmContext.farmer.name}
    - Location: ${farmContext.farmer.location}
    - Land Size: ${farmContext.farmer.landSize} acres
    - Crop Type: ${farmContext.crop.type}
    - Coordinates: ${farmContext.farmer.coordinates?.latitude || 'Unknown'}, ${farmContext.farmer.coordinates?.longitude || 'Unknown'}
    
    CURRENT WEATHER:
    - Temperature: ${farmContext.weather.temperature}°C
    - Humidity: ${farmContext.weather.humidity}%
    - Rainfall: ${farmContext.weather.rainfall} mm
    - Forecast: ${farmContext.weather.forecast}
    
    ${Array.isArray(farmContext.prices) && farmContext.prices.length > 0 ? `
    ALL CROP PRICES (Summary):
    ${farmContext.prices.slice(0, 20).map(p => `- ${p.cropName}: ${p.price} per ${p.unit}`).join('\n')}
    ${farmContext.prices.length > 20 ? `...and ${farmContext.prices.length - 20} more` : ''}
    ` : ''}
    
    ${farmContext.sensors ? `
    LIVE SENSOR DATA (Last Updated: ${farmContext.sensors.lastUpdated}):
    - Soil Moisture: ${farmContext.sensors.soilMoisture}% ${farmContext.sensors.soilMoisture < 30 ? '⚠️ LOW' : farmContext.sensors.soilMoisture > 70 ? '✅ GOOD' : '🔵 MODERATE'}
    - Soil pH: ${farmContext.sensors.soilPH} ${farmContext.sensors.soilPH < 6 ? '⚠️ ACIDIC' : farmContext.sensors.soilPH > 8 ? '⚠️ ALKALINE' : '✅ OPTIMAL'}
    - Soil Temperature: ${farmContext.sensors.soilTemperature}°C
    - Light Intensity: ${farmContext.sensors.lightIntensity} lux
    - Soil Conductivity: ${farmContext.sensors.soilConductivity} μS/cm
    - Nitrogen (N): ${farmContext.sensors.nutrients.nitrogen} ppm
    - Phosphorus (P): ${farmContext.sensors.nutrients.phosphorus} ppm
    - Potassium (K): ${farmContext.sensors.nutrients.potassium} ppm
    ` : `
    SENSOR STATUS: No active IoT device connected. Encourage farmer to connect their AgriSense device for real-time monitoring.
    `}
    
    USER'S QUESTION: "${userMessage}"
    
    INSTRUCTIONS:
    1. Address the farmer by name (${farmContext.farmer.name})
    2. Use the specific sensor data and weather information to provide personalized advice
    3. If asked about conditions, reference the exact current readings
    4. Provide practical, actionable advice for ${farmContext.crop.type} cultivation
    5. ALWAYS respond in Bengali (Bangla) language as farmers in Bangladesh prefer Bengali communication
    6. If the question is about irrigation, fertilization, or crop care, use the sensor data to give specific recommendations
    7. If sensor readings indicate problems, mention them and provide solutions
    8. Keep responses concise but informative (2-4 sentences) in simple Bengali that farmers can understand
    9. If relevant, use the market price list to answer price questions directly and to advise on harvest timing/sales decisions.
    
    EXPERTISE AREAS:
    - Soil moisture and irrigation scheduling
    - pH management and soil amendments
    - NPK nutrient management
    - Weather-based farming decisions
    - Crop-specific care for ${farmContext.crop.type}
    - Pest and disease prevention
    - Seasonal farming advice
    
    Respond naturally and helpfully to the farmer's question using all available data. Always use Bengali (Bangla) language.
    `;

    console.log('Sending chatbot request to OpenAI API...');
    const startTime = Date.now();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are AgriSense AI, a helpful agricultural assistant that provides personalized farming advice based on real-time sensor data, weather conditions, and farmer profiles. Always be friendly, practical, and use the specific data provided to give actionable recommendations. You MUST always respond in Bengali (Bangla) language as you are serving farmers in Bangladesh who prefer Bengali communication."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Chatbot OpenAI API response received in ${duration} seconds`);
    console.log('Response tokens:', response.usage);

    const botResponse = response.choices[0].message.content;
    console.log('Chatbot Response:', botResponse);

    return botResponse;
  } catch (error) {
    console.error('Chatbot OpenAI error:', error);
    // Fallback response with available data in Bengali
    if (farmContext.sensors) {
      return `আসসালামু আলাইকুম ${farmContext.farmer.name}! আমি এখন আপনার প্রশ্নটি প্রক্রিয়া করতে সমস্যা হচ্ছে, তবে আমি দেখতে পাচ্ছি আপনার বর্তমান মাটির আর্দ্রতা ${farmContext.sensors.soilMoisture}% এবং pH ${farmContext.sensors.soilPH}। আপনার ${farmContext.crop.type} খামারে কিভাবে সাহায্য করতে পারি?`;
    } else {
      return `আসসালামু আলাইকুম ${farmContext.farmer.name}! আমি কিছু প্রযুক্তিগত সমস্যার সম্মুখীন হচ্ছি, তবে আমি আপনার ${farmContext.crop.type} চাষের প্রশ্নে সাহায্য করতে এখানে আছি। অনুগ্রহ করে একটু পরে আবার চেষ্টা করুন।`;
    }
  }
}

/**
 * Schedule daily morning analysis
 * @param {Object} farmData - Farm data to analyze
 * @returns {Promise<Object>} Analysis results
 */
async function performDailyAnalysis(farmData) {
  try {
    // Add time context for daily analysis
    const dataWithTimeContext = {
      ...farmData,
      analysisType: 'daily',
      timestamp: new Date().toISOString()
    };
    
    return await analyzeData(dataWithTimeContext);
  } catch (error) {
    console.error('Daily analysis error:', error);
    throw new Error(`Failed to perform daily analysis: ${error.message}`);
  }
}

module.exports = {
  analyzeData,
  performDailyAnalysis,
  chatResponse,
  analyzeReceipt,
  // Export additional functions for image upload functionality
  processImageUpload: analyzeReceipt,
  
  /**
   * Analyze and propose optimal sensor ranges for a specific farm context
   * Returns STRICT JSON only. Shape:
   * {
   *   "moisture": {"min":0,"max":100,"optimalMin":45,"optimalMax":65},
   *   "ph": {"min":0,"max":14,"optimalMin":6.0,"optimalMax":7.5},
   *   "temperature": {"min":0,"max":50,"optimalMin":18,"optimalMax":30},
   *   "humidity": {"min":0,"max":100,"optimalMin":40,"optimalMax":70},
   *   "light": {"min":0,"max":2000,"optimalMin":300,"optimalMax":800},
   *   "conductivity": {"min":0,"max":1000,"optimalMin":200,"optimalMax":400},
   *   "n": {"min":0,"max":100,"optimalMin":30,"optimalMax":50},
   *   "p": {"min":0,"max":80,"optimalMin":15,"optimalMax":35},
   *   "k": {"min":0,"max":100,"optimalMin":30,"optimalMax":60}
   * }
   */
  async analyzeOptimalConditions(farmContext) {
    const { farmer, crop, weather, sensors } = farmContext || {};
    try {
      const prompt = `
You are an expert agronomist optimizing sensor thresholds for precision farming. Using the provided context (farmer region, crop, recent weather, last sensor snapshot), return STRICT JSON ONLY matching this exact schema with no extra keys or text:

{
  "moisture": {"min":0,"max":100,"optimalMin":45,"optimalMax":65},
  "ph": {"min":0,"max":14,"optimalMin":6.0,"optimalMax":7.5},
  "temperature": {"min":0,"max":50,"optimalMin":18,"optimalMax":30},
  "humidity": {"min":0,"max":100,"optimalMin":40,"optimalMax":70},
  "light": {"min":0,"max":2000,"optimalMin":300,"optimalMax":800},
  "conductivity": {"min":0,"max":1000,"optimalMin":200,"optimalMax":400},
  "n": {"min":0,"max":100,"optimalMin":30,"optimalMax":50},
  "p": {"min":0,"max":80,"optimalMin":15,"optimalMax":35},
  "k": {"min":0,"max":100,"optimalMin":30,"optimalMax":60}
}

Rules:
- The min/max are fixed bounds as shown above and MUST be kept exactly.
- Choose optimalMin/optimalMax tailored to crop=${crop?.type || 'Unknown'} and Bangladesh agronomy for the farmer's district.
- Use recent weather and sensor snapshot to slightly shift optimal ranges if justified (e.g., raise optimal moisture in heat).
- Respond with VALID JSON only. No commentary.

Context:
Farmer: ${farmer?.name || 'Unknown'} (${farmer?.location || 'Unknown'})
Crop: ${crop?.type || 'Unknown'}
Weather: ${JSON.stringify(weather || {}, null, 2)}
Sensors: ${JSON.stringify(sensors || {}, null, 2)}
`;

      const response = await openai.chat.completions.create({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: "You return only valid JSON. Never include any explanation." },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 600
      });

      const raw = response.choices?.[0]?.message?.content || '{}';
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        throw new Error('AI returned invalid JSON for optimal settings');
      }

      // Basic shape validation
      const requiredKeys = ["moisture","ph","temperature","humidity","light","conductivity","n","p","k"];
      for (const k of requiredKeys) {
        if (!parsed[k] || typeof parsed[k].optimalMin === 'undefined' || typeof parsed[k].optimalMax === 'undefined') {
          throw new Error(`Missing optimal range for ${k}`);
        }
      }

      return {
        success: true,
        optimal: parsed,
        usage: response.usage
      };
    } catch (error) {
      console.error('Optimal analysis error:', error);
      throw error;
    }
  },
  
  /**
   * Process image in chat using OpenAI Vision API
   * @param {string} base64Image - Base64 encoded image
   * @param {string} userMessage - User's message/question about the image
   * @param {Array} conversationHistory - Previous conversation messages
   * @returns {Promise<Object>} Image analysis results
   */
  async processImageInChat(base64Image, userMessage, conversationHistory = []) {
    try {
      // Format conversation history for OpenAI
      const formattedHistory = conversationHistory.map(msg => ({
        role: msg.isUser ? "user" : "assistant",
        content: msg.content
      }));
      
      // Prepare messages array with system message and conversation history
      const messages = [
        {
          role: "system",
          content: "You are AgriSense AI, a helpful agricultural assistant that provides personalized farming advice. Always respond in Bengali (Bangla) language as you are serving farmers in Bangladesh."
        },
        ...formattedHistory,
        {
          role: "user",
          content: [
            { type: "text", text: userMessage },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`
              }
            }
          ]
        }
      ];

      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 1000
      });

      return {
        success: true,
        data: response.choices[0].message.content
      };
    } catch (error) {
      console.error("OpenAI image processing error:", error);
      throw new Error(`Failed to process image: ${error.message}`);
    }
  }
};
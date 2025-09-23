# 🎙️ Retell AI Voice Integration Setup Guide

## Overview
Your AgriSense platform now sends **SMS + Voice Calls** for critical farm alerts. Farmers receive:
1. **SMS alert** in Bengali
2. **Voice call** with full farm advisory capabilities
3. **Interactive conversation** about their farm data

## 🚀 **Setup Steps**

### **Step 1: Create Retell AI Account**
1. Go to [Retell AI Dashboard](https://beta.retellai.com)
2. Sign up and get your API key
3. Note your account limits and pricing

### **Step 2: Create Agricultural Voice Agent**
```bash
# Create a new agent via Retell AI API
curl -X POST https://api.retellai.com/v2/create-agent \
  -H "Authorization: Bearer YOUR_RETELL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_name": "AgriSense Farm Advisor",
    "voice_id": "11labs-adriel",
    "language": "en",
    "response_engine": {
      "type": "retell-llm",
      "llm_websocket_url": "wss://your-backend.com/llm-websocket"
    },
    "agent_prompt": "You are an expert agricultural advisor..."
  }'
```

### **Step 3: Configure Environment Variables**
Add to your production `.env`:
```env
RETELL_API_KEY=key_xxxxxxxxxxxxxxxxxx
RETELL_AGENT_ID=agent_xxxxxxxxxxxxxxxxxx
AGRISENSE_BACKEND_URL=https://agrisense-z6ks.onrender.com
INTERNAL_API_TOKEN=secure_random_token_for_webhooks
```

### **Step 4: Set Up Webhooks**
Configure Retell AI webhook URL:
```
https://agrisense-z6ks.onrender.com/api/voice/retell-webhook
```

### **Step 5: Run Database Migration**
```sql
-- Execute in Supabase SQL Editor
\i voice_call_schema_update.sql
```

## 🎯 **How It Works**

### **Critical Alert Flow**
```
1. Sensor detects critical condition (0% moisture, pH extremes)
   ↓
2. OpenAI analyzes and returns structured JSON
   ↓
3. System sends SMS alert
   ↓
4. System initiates voice call via Retell AI
   ↓
5. Farmer receives call with personalized farm advisory
```

### **Voice Call Features**
- **Bengali-English Mix**: Natural conversation style
- **Complete Farm Data**: AI has access to all sensor readings
- **Real-time Updates**: Can fetch fresh data during conversation
- **Interactive Q&A**: Farmer can ask about any aspect of their farm
- **Agricultural Expertise**: Irrigation, fertilizer, pest control advice

## 📞 **Voice Call Capabilities**

### **What the AI Agent Knows:**
- ✅ Farmer's name and location
- ✅ Current sensor readings (moisture, pH, temperature, NPK levels)
- ✅ Weather conditions
- ✅ Crop type and land size
- ✅ Historical alert patterns
- ✅ Critical condition details

### **What Farmers Can Ask:**
- *"আমার মাটির অবস্থা কেমন?"* (How is my soil condition?)
- *"কখন সেচ দিতে হবে?"* (When should I irrigate?)
- *"সার দেওয়ার পরামর্শ দিন"* (Give fertilizer recommendations)
- *"আবহাওয়া কেমন আছে?"* (How's the weather?)
- *"ফসলের যত্ন নেওয়ার উপায়"* (How to care for crops)

## 🧪 **Testing the Integration**

### **Test Voice Call API**
```bash
curl -X POST https://agrisense-z6ks.onrender.com/api/voice/test-call \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"testNumber": "+8801XXXXXXXXX"}'
```

### **Test Critical Alert**
```bash
# Trigger analytics with critical sensor data
curl -X GET https://agrisense-z6ks.onrender.com/api/analytics/farm-analysis \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📊 **Console Logs**

### **Successful Voice Call Initiation:**
```
🔊 ===== INITIATING VOICE CALL =====
📞 Calling: +8801712345678
🚨 Alert: মাটির আর্দ্রতা একেবারে নেই। দ্রুত সেচ দিন।
👨‍🌾 Farmer: Abdul Rahman
====================================
✅ Voice call initiated successfully!
📞 Call ID: call_xxxxxxxxxxxxxxxxxx
```

### **Voice Call Conversation:**
```
🎤 ===== RETELL WEBHOOK =====
📞 Call call_xxx: Farmer asked: "আমার মাটির pH কত?"
Response: Your soil pH is currently 6.5, which is optimal for rice cultivation...
============================
```

## 💰 **Cost Considerations**

### **Retell AI Pricing (Approximate):**
- **Voice calls**: ~$0.05-0.15 per minute
- **Phone number**: ~$1-5 per month
- **API usage**: Based on call volume

### **Cost Optimization:**
- Only call for **critical alerts** (not routine notifications)
- Set maximum call duration limits
- Use SMS for non-critical updates

## 🎛️ **Voice Agent Configuration**

### **Recommended Voice Settings:**
```json
{
  "voice_id": "11labs-adriel",
  "language": "en",
  "speaking_speed": 0.9,
  "stability": 0.8,
  "similarity_boost": 0.8,
  "style": 0.2
}
```

### **Bengali Voice Options:**
- Consider using Retell's multilingual voices
- Test different voice IDs for Bengali pronunciation
- Adjust speaking speed for clarity

## 🔒 **Security Considerations**

- **Webhook Authentication**: Verify Retell signatures
- **API Key Security**: Store securely in environment variables
- **Data Privacy**: Log call metadata, not conversation content
- **Rate Limiting**: Prevent API abuse

## 📈 **Monitoring & Analytics**

### **Key Metrics to Track:**
- Voice call success rate
- Call duration averages
- Farmer satisfaction feedback
- Cost per alert delivery
- Response time to critical alerts

### **Database Queries:**
```sql
-- Voice call success rate
SELECT 
  COUNT(*) as total_alerts,
  SUM(CASE WHEN voice_call_initiated THEN 1 ELSE 0 END) as calls_initiated,
  SUM(CASE WHEN voice_call_status = 'completed' THEN 1 ELSE 0 END) as calls_completed
FROM farm_alerts 
WHERE created_at > NOW() - INTERVAL '7 days';
```

## 🚀 **Next Steps**

1. **Deploy to Production**: Update your Render environment variables
2. **Test with Real Farmers**: Start with a small group
3. **Monitor Performance**: Track call success rates
4. **Gather Feedback**: Improve based on farmer responses
5. **Scale Gradually**: Expand to more users as system stabilizes

## 🎯 **Expected Impact**

- **Immediate Alert Response**: Farmers get called within seconds of critical conditions
- **Reduced Crop Loss**: Faster response to drought/waterlogging
- **Better Farmer Education**: Interactive learning about soil conditions
- **Increased Trust**: Personal voice contact builds confidence
- **Language Accessibility**: Bengali support for rural farmers

---

**Your AgriSense platform now has enterprise-level alert capabilities with both SMS and voice channels!** 🌾📞

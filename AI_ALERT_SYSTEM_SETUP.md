# 🚨 AgriSense AI Alert System Setup

## Overview
The AI Alert System provides critical farm condition monitoring with automated SMS notifications to farmers when immediate action is required.

## 🏗️ New Components

### 1. Database Schema
- **Table**: `farm_alerts` - Stores critical alerts and SMS delivery status
- **Features**: Alert categorization, SMS tracking, duplicate prevention

### 2. SMS Service (`backend/services/smsService.js`)
- **Provider**: CloudSMSBD API
- **Features**: Bangladeshi mobile validation, SMS delivery tracking
- **API Key**: `csb_ececa28e-9f0e-4d78-9dc4-3ba45af3c6d2`

### 3. Enhanced OpenAI Service
- **Response Format**: Structured JSON with analysis + alerts
- **Critical Conditions**: Moisture < 20%, pH extremes, temperature alerts
- **Language**: Bengali messages for SMS alerts

### 4. Analytics Controller Updates
- **Alert Detection**: Automatic critical condition identification
- **Database Storage**: Alert logging with sensor data
- **SMS Integration**: Automated SMS sending for critical alerts

## 📋 Setup Instructions

### Step 1: Run Database Migration
```sql
-- Run the farm_alerts_schema.sql in your Supabase SQL editor
\i farm_alerts_schema.sql
```

### Step 2: Environment Variables
Add to your `.env` file:
```env
SMS_API_KEY=csb_ececa28e-9f0e-4d78-9dc4-3ba45af3c6d2
OPENAI_API_KEY=your_openai_api_key_here
```

### Step 3: Test the System

#### Test SMS Service
```bash
# Make a POST request to test SMS
curl -X POST http://localhost:5000/api/analytics/test-sms \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"testNumber": "+8801700000000"}'
```

#### Test AI Analysis with Alerts
```bash
# Trigger analysis (requires linked device with sensor data)
curl -X GET http://localhost:5000/api/analytics/farm-analysis \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 🔧 Critical Alert Conditions

### Moisture Levels
- **< 20%**: "মাটিতে পানির অভাব। অবিলম্বে সেচ দিন।"
- **> 90%**: "মাটিতে অতিরিক্ত পানি। নিকাশের ব্যবস্থা করুন।"

### pH Levels
- **< 5.5**: "মাটির pH অস্বাভাবিক। বিশেষজ্ঞের পরামর্শ নিন।"
- **> 8.5**: "মাটির pH অস্বাভাবিক। বিশেষজ্ঞের পরামর্শ নিন।"

### Temperature
- **< 10°C**: Temperature too cold alert
- **> 40°C**: Temperature too hot alert

## 📱 SMS Integration

### CloudSMSBD API
- **Endpoint**: `https://api.cloudsmsbd.com/sms/`
- **Method**: POST
- **Format**: JSON with message and recipient
- **Validation**: Bangladeshi mobile format (+8801XXXXXXXXX)

### SMS Tracking
- All SMS attempts are logged in `farm_alerts` table
- Success/failure status tracked
- API responses stored for debugging

## 🧪 Testing & Debugging

### Console Logging
All critical operations log to console:
- OpenAI requests/responses
- SMS sending attempts
- Alert creation and database operations

### Sample Console Output
```
🚨 CRITICAL ALERT DETECTED! 🚨
Alert Message: মাটিতে পানির অভাব। অবিলম্বে সেচ দিন।
Farmer: জন ডো
Mobile: +8801712345678
✅ Alert stored in database with ID: uuid-here
📱 Sending SMS to: +8801712345678
✅ SMS sent successfully!
```

## 🔄 Response Format

### New OpenAI Response Structure
```json
{
  "analysis": "Detailed farming recommendations in English",
  "actionRequired": true,
  "message": "মাটিতে পানির অভাব। অবিলম্বে সেচ দিন।"
}
```

### API Response to Frontend
```json
{
  "success": true,
  "data": {
    "analysis": {
      "analysis": "Your soil moisture...",
      "actionRequired": true,
      "message": "Bengali alert message",
      "timestamp": "2023-...",
      "processingTime": "2.5 seconds"
    },
    "alert": {
      "id": "uuid",
      "alert_type": "critical_drought",
      "is_sms_sent": true,
      "created_at": "2023-..."
    },
    "timestamp": "2023-..."
  }
}
```

## 🚀 Frontend Integration

### AnalyticsReport Component
- Shows critical alert banners
- Displays SMS delivery status
- Maintains existing analysis display

### Alert Display Features
- Warning banner for critical conditions
- Bengali alert message display
- SMS delivery status indicator

## 📊 Database Queries

### Check Recent Alerts
```sql
SELECT * FROM recent_farm_alerts 
WHERE created_at > NOW() - INTERVAL '24 hours';
```

### SMS Delivery Status
```sql
SELECT 
  alert_type,
  COUNT(*) as total_alerts,
  SUM(CASE WHEN is_sms_sent THEN 1 ELSE 0 END) as sms_sent
FROM farm_alerts 
GROUP BY alert_type;
```

## 🔐 Security Considerations

- SMS API key stored in environment variables
- Row Level Security (RLS) on farm_alerts table
- JWT authentication required for all endpoints
- Input validation on mobile numbers

## 📈 Next Steps

1. **Monitor SMS delivery rates** - Track success/failure patterns
2. **Add more alert types** - Expand critical condition detection
3. **Implement rate limiting** - Prevent SMS spam
4. **Add alert history** - Dashboard for farmers to view past alerts
5. **Voice calls** - For extremely critical conditions

---

**System is now ready for testing! Check console logs for detailed operation tracking.**

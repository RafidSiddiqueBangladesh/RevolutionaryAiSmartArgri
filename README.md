# 🌾 AgriSense - Smart Farming Platform

AgriSense is an end‑to‑end precision agriculture platform for farmers in Bangladesh. It combines low‑cost IoT devices (ESP32), real‑time dashboards, AI analytics, weather data, SMS/voice alerts, and market pricing to deliver actionable insights.

## Features

- **Role-based Authentication**: JWT with farmer/admin roles
- **IoT Device Linking**: Link devices by 32‑char device API key
- **Live Monitoring**: Current sensor snapshot and historical trends
- **AI Analytics**: Bengali advisory, strict JSON outputs for reports
- **Weather Integration**: Current + forecast with internal token bypass
- **Alerts**: SMS and optional voice calls for critical events
- **Chatbot**: Context‑aware OpenAI chatbot (Bengali)
- **Market & Products**: Prices and farmer product listings

## Project Structure

```
AgriSense/
├── backend/                 # Node.js Express APIs
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   └── server.js
├── frontend/                # React + Vite app
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
├── esp32_agrisense_complete.ino  # ESP32 firmware
└── README.md
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express, node-cron, Supabase JS
- **Frontend**: React, Vite, Axios
- **Database**: Supabase (PostgreSQL)
- **AI**: OpenAI (GPT‑4.1, GPT‑4o/4o‑mini)
- **Telephony**: Retell AI (optional outbound calls)
- **Auth**: JWT + bcryptjs

## 📋 Prerequisites

- Node.js ≥ 18
- npm (or yarn/pnpm)
- Supabase project (URL + Service Role key)
- OpenAI API key
- Optional: Retell AI account and phone number

## ⚙️ Local Setup

### 1) Clone
```bash
git clone <repository-url>
cd Agrisense
```

### 2) Backend
```bash
cd backend
npm install
cp .env.example .env
# Then fill values in backend/.env
```

Required environment variables (see `.env.example`):

- `PORT` (default 5000)
- `JWT_SECRET` (long random string)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`
- `WEATHER_API_KEY` (if using external weather provider)
- `INTERNAL_API_TOKEN` (random secret for internal service calls)
- Optional Retell: `RETELL_API_KEY`, `RETELL_AGENT_ID`, `RETELL_PHONE_NUMBER`
- `AGRISENSE_BACKEND_URL` (public base URL when deployed)

Start the API:
```bash
npm run dev
# API at http://localhost:5000
```

### 3) Frontend
```bash
cd ../frontend
npm install
cp .env.example .env
# Then set VITE_API_BASE_URL (e.g. http://localhost:5000/api)
npm run dev
# App at http://localhost:5173
```

## 🗄️ Database (Supabase)

1. Create a Supabase project
2. In SQL Editor, create tables according to your schema (users, devices, current_sensor_data, sensor_data_history, products, etc.)
3. Get `SUPABASE_URL`, `SERVICE_ROLE_KEY`, and `ANON_KEY` from Project Settings → API

## 🔐 Authentication

- JWT issued on login and verified on each request
- Use `Authorization: Bearer <token>` in frontend requests
- Role checks supported (e.g., admin‑only routes)

## 📡 IoT Device Data Flow

1. Admin registers devices with generated 32‑char `device_api_key`
2. Farmer links device in dashboard using the API key
3. ESP32 posts JSON to backend ingestion URL:

```json
{
  "apiKey": "<DEVICE_API_KEY>",
  "moistureLevel": 52.3
}
```

- Endpoint upserts to `current_sensor_data`, appends to `sensor_data_history`, and updates device `last_seen`
- Non‑moisture metrics may be mocked if not sent by firmware (configurable in code)

## 🤖 AI & Analytics

- OpenAI used for Bengali analytics and chatbot; responses are validated as JSON where required
- Scheduled jobs (node‑cron):
  - Daily analytics: 07:00 Asia/Dhaka
  - Moisture checks: every 2 hours (SMS/voice alerts)

## ☁️ Deployment

You can deploy on Render/Railway/Heroku (backend) and Netlify/Vercel (frontend).

Backend notes:
- Set all environment variables exactly as in `backend/.env.example`
- Expose `AGRISENSE_BACKEND_URL` (e.g., `https://yourapp.onrender.com`)
- Ensure webhook/voice routes are reachable publicly if using Retell

Frontend notes:
- Set `VITE_API_BASE_URL` to your public backend `.../api` URL
- Rebuild after changes to env vars

## 🔧 Environment Variables

Complete examples are in:
- `backend/.env.example`
- `frontend/.env.example`

Never commit real secrets. Rotate any leaked keys immediately.

## 📬 API Overview (selected)

- `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/profile`
- `POST /api/device/link`, `GET /api/device/my-devices`
- `POST /api/device/sensor-data` (ingestion by ESP32)
- `GET /api/analytics/...`, `GET /api/weather/...`
- `POST /api/voice/get-farmer-data`, `POST /api/voice/add-product-by-phone` (unauth endpoints for voice function)

## 🧪 Running Locally

```bash
# terminal 1
cd backend && npm run dev

# terminal 2
cd frontend && npm run dev
```

## 🤝 Contributing

1. Fork repository
2. Create a branch: `git checkout -b feature/your-change`
3. Commit: `git commit -m "feat: your change"`
4. Push: `git push origin feature/your-change`
5. Open a Pull Request

## 👥 Authors

Ginger

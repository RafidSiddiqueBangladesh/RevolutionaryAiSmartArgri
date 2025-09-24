# 🌾 AgriSense - Smart Farming Platform

AgriSense is a comprehensive agricultural technology platform designed to help farmers in Bangladesh make data-driven decisions using IoT sensors, AI recommendations, and real-time monitoring.

## Features

- **Role-based Authentication**: Separate access for farmers and administrators
- **Smart Dashboard**: Real-time monitoring of soil conditions and crop health
- **AI Recommendations**: Intelligent suggestions for irrigation, nutrients, and crop care
- **Multi-channel Communication**: Web dashboard, SMS alerts, and voice support
- **Weather Integration**: Location-based weather forecasts and alerts
- **Knowledge Sharing**: Farmer-to-farmer experience sharing platform
- **Market Price Updates**: Real-time crop price information

## Project Structure

```
AgriSense/
├── backend/                 # Node.js Express APIs
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   └── server.js
├── frontend/                # React Application
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── services/
│   │   └── App.jsx
│   └── package.json
├── database_schema.sql      # Supabase database schema
└── README.md
```

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js, JWT Authentication
- **Frontend**: React, Vite, React Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT + bcryptjs
- **Styling**: Custom CSS with modern design

## 📋 Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd AgriSense
```

### 2. Database Setup (Supabase)

1. Create a new project in [Supabase](https://supabase.com)
2. Go to the SQL Editor in your Supabase dashboard
3. Copy and paste the contents of `database_schema.sql`
4. Run the SQL commands to create tables and insert initial data

### 3. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the backend directory:
```env
PORT=5000
JWT_SECRET=your_super_secret_jwt_key_here
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Frontend Setup

```bash
cd ../frontend
npm install
```

### 5. Run the Application

Start the backend server:
```bash
cd backend
npm run dev
```

In a new terminal, start the frontend:
```bash
cd frontend
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:5000

## 🔐 Authentication

### Default Admin Account
- **Mobile**: 01700000000
- **Password**: admin123

*Change this password in production!*

### Farmer Registration
Farmers can sign up by providing:
- Full Name
- Mobile Number (Bangladeshi format: 01XXXXXXXXX)
- Crop Name
- District (from 64 districts of Bangladesh)

##  Usage

1. **Login/Signup**: Access the authentication page
2. **Dashboard**: View personalized dashboard based on user role
3. **Farmer Dashboard**: Monitor crop data, receive recommendations
4. **Admin Dashboard**: Overview of all farmers and system-wide data

## Upcoming Features

- IoT sensor integration (soil moisture, pH, temperature)
- AI-powered crop recommendations
- SMS notification system
- Voice chat with AI assistant
- Weather API integration
- Market price tracking
- Knowledge sharing platform
- Mobile app (React Native)

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Farmer registration
- `POST /api/auth/login` - User login
- `GET /api/auth/profile` - Get user profile
- `GET /api/auth/districts` - Get all districts

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request


## 👥 Team

Ginger


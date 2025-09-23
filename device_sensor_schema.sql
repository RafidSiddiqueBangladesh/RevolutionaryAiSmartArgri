-- AgriSense Device and Sensor Data Schema
-- Run this in your Supabase SQL editor

-- Create devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_api_key VARCHAR(32) NOT NULL UNIQUE,
    device_name VARCHAR(100),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create sensor_data table
CREATE TABLE IF NOT EXISTS sensor_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Real sensor data
    moisture_level DECIMAL(5,2) NOT NULL, -- From ESP32
    
    -- Mock sensor data (will be random generated)
    ph_level DECIMAL(4,2) DEFAULT 7.0,
    temperature DECIMAL(5,2) DEFAULT 25.0,
    humidity DECIMAL(5,2) DEFAULT 60.0,
    light_intensity DECIMAL(6,2) DEFAULT 500.0,
    soil_conductivity DECIMAL(6,2) DEFAULT 200.0,
    nitrogen_level DECIMAL(5,2) DEFAULT 50.0,
    phosphorus_level DECIMAL(5,2) DEFAULT 30.0,
    potassium_level DECIMAL(5,2) DEFAULT 40.0,
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_devices_api_key ON devices(device_api_key);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_device_id ON sensor_data(device_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_user_id ON sensor_data(user_id);
CREATE INDEX IF NOT EXISTS idx_sensor_data_timestamp ON sensor_data(timestamp DESC);

-- Create updated_at trigger for devices
CREATE TRIGGER update_devices_updated_at 
    BEFORE UPDATE ON devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE sensor_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for devices
CREATE POLICY "Users can view their own devices" ON devices
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own devices" ON devices
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for sensor_data  
CREATE POLICY "Users can view their own sensor data" ON sensor_data
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Devices can insert sensor data" ON sensor_data
    FOR INSERT WITH CHECK (true); -- We'll handle this in backend

-- Function to generate random API key
CREATE OR REPLACE FUNCTION generate_device_api_key()
RETURNS TEXT AS $$
BEGIN
    RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 32));
END;
$$ LANGUAGE plpgsql;

-- Insert some sample devices with API keys (for testing)
INSERT INTO devices (device_api_key, device_name) VALUES
    (generate_device_api_key(), 'AgriSense Device #001'),
    (generate_device_api_key(), 'AgriSense Device #002'),
    (generate_device_api_key(), 'AgriSense Device #003'),
    (generate_device_api_key(), 'AgriSense Device #004'),
    (generate_device_api_key(), 'AgriSense Device #005')
ON CONFLICT (device_api_key) DO NOTHING;

-- View for device status with user info
CREATE OR REPLACE VIEW device_status AS
SELECT 
    d.id,
    d.device_api_key,
    d.device_name,
    d.user_id,
    u.full_name as owner_name,
    u.mobile_number as owner_mobile,
    d.is_active,
    d.last_seen,
    d.created_at,
    CASE 
        WHEN d.user_id IS NULL THEN 'Available'
        WHEN d.is_active = false THEN 'Inactive' 
        WHEN d.last_seen > NOW() - INTERVAL '5 minutes' THEN 'Online'
        WHEN d.last_seen > NOW() - INTERVAL '1 hour' THEN 'Recently Active'
        ELSE 'Offline'
    END as status
FROM devices d
LEFT JOIN users u ON d.user_id = u.id;

-- Add comments
COMMENT ON TABLE devices IS 'IoT devices with API keys for farmer linking';
COMMENT ON TABLE sensor_data IS 'Sensor readings from IoT devices - moisture from device, others mock';
COMMENT ON COLUMN devices.device_api_key IS 'Unique 32-character API key for device authentication';
COMMENT ON COLUMN sensor_data.moisture_level IS 'Real moisture data from ESP32 sensor (0-100%)';
COMMENT ON COLUMN sensor_data.ph_level IS 'Mock pH level data (4.0-9.0)';
COMMENT ON COLUMN sensor_data.temperature IS 'Mock temperature data (15-40°C)';

-- Display available devices for testing
SELECT 
    device_api_key as "API Key",
    device_name as "Device Name",
    CASE WHEN user_id IS NULL THEN 'Available' ELSE 'Linked' END as "Status"
FROM devices 
ORDER BY created_at;

SELECT 'Device and sensor schema created successfully! 🌾' as message;

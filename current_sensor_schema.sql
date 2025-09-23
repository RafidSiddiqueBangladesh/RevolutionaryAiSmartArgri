-- AgriSense Current Sensor Data Schema (UPDATE Approach)
-- Run this in your Supabase SQL editor

-- Keep the devices table as is
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

-- Replace sensor_data table with current_sensor_data (one record per device)
DROP TABLE IF EXISTS sensor_data;

CREATE TABLE current_sensor_data (
    device_id UUID PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    
    -- Real sensor data from ESP32
    moisture_level DECIMAL(5,2) NOT NULL,
    
    -- Mock sensor data (generated on server)
    ph_level DECIMAL(4,2) DEFAULT 7.0,
    temperature DECIMAL(5,2) DEFAULT 25.0,
    humidity DECIMAL(5,2) DEFAULT 60.0,
    light_intensity DECIMAL(6,2) DEFAULT 500.0,
    soil_conductivity DECIMAL(6,2) DEFAULT 200.0,
    nitrogen_level DECIMAL(5,2) DEFAULT 50.0,
    phosphorus_level DECIMAL(5,2) DEFAULT 30.0,
    potassium_level DECIMAL(5,2) DEFAULT 40.0,
    
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_devices_api_key ON devices(device_api_key);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_current_sensor_user_id ON current_sensor_data(user_id);
CREATE INDEX IF NOT EXISTS idx_current_sensor_updated ON current_sensor_data(last_updated DESC);

-- Create updated_at trigger for devices
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_devices_updated_at 
    BEFORE UPDATE ON devices 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE current_sensor_data ENABLE ROW LEVEL SECURITY;

-- RLS Policies for devices
CREATE POLICY "Users can view their own devices" ON devices
    FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own devices" ON devices
    FOR UPDATE USING (user_id = auth.uid());

-- RLS Policies for current_sensor_data
CREATE POLICY "Users can view their own sensor data" ON current_sensor_data
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Devices can upsert sensor data" ON current_sensor_data
    FOR ALL WITH CHECK (true); -- We'll handle this in backend

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

-- View for device status with current sensor data
CREATE OR REPLACE VIEW device_dashboard AS
SELECT 
    d.id as device_id,
    d.device_api_key,
    d.device_name,
    d.user_id,
    u.full_name as owner_name,
    u.mobile_number as owner_mobile,
    d.is_active,
    d.last_seen,
    s.moisture_level,
    s.ph_level,
    s.temperature,
    s.humidity,
    s.light_intensity,
    s.soil_conductivity,
    s.nitrogen_level,
    s.phosphorus_level,
    s.potassium_level,
    s.last_updated as sensor_last_updated,
    CASE 
        WHEN d.user_id IS NULL THEN 'Available'
        WHEN d.is_active = false THEN 'Inactive' 
        WHEN d.last_seen > NOW() - INTERVAL '2 minutes' THEN 'Online'
        WHEN d.last_seen > NOW() - INTERVAL '10 minutes' THEN 'Recently Active'
        ELSE 'Offline'
    END as status
FROM devices d
LEFT JOIN users u ON d.user_id = u.id
LEFT JOIN current_sensor_data s ON d.id = s.device_id;

-- Add comments
COMMENT ON TABLE devices IS 'IoT devices with API keys for farmer linking';
COMMENT ON TABLE current_sensor_data IS 'Current sensor readings - one record per device, updated every 30 seconds';
COMMENT ON COLUMN devices.device_api_key IS 'Unique 32-character API key for device authentication';
COMMENT ON COLUMN current_sensor_data.moisture_level IS 'Real moisture data from ESP32 sensor (0-100%)';
COMMENT ON COLUMN current_sensor_data.last_updated IS 'When this sensor data was last updated (every 30 seconds)';

-- Display available devices for testing
SELECT 
    device_api_key as "API Key",
    device_name as "Device Name",
    CASE WHEN user_id IS NULL THEN 'Available' ELSE 'Linked' END as "Status"
FROM devices 
ORDER BY created_at;

SELECT 'Current sensor data schema created successfully! 🌾' as message,
       'Each device will have ONE record that updates every 30 seconds' as details;

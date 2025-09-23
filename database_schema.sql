-- AgriSense Database Schema for Supabase
-- Run these commands in your Supabase SQL editor

-- Create districts table (64 districts of Bangladesh)
CREATE TABLE IF NOT EXISTS districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert all 64 districts of Bangladesh
INSERT INTO districts (name) VALUES
    ('Bagerhat'), ('Bandarban'), ('Barguna'), ('Barishal'), ('Bhola'),
    ('Bogura'), ('Brahmanbaria'), ('Chandpur'), ('Chattogram'), ('Chuadanga'),
    ('Comilla'), ('Coxs Bazar'), ('Cumilla'), ('Dhaka'), ('Dinajpur'),
    ('Faridpur'), ('Feni'), ('Gaibandha'), ('Gazipur'), ('Gopalganj'),
    ('Habiganj'), ('Jamalpur'), ('Jashore'), ('Jhalokathi'), ('Jhenaidah'),
    ('Joypurhat'), ('Khagrachhari'), ('Khulna'), ('Kishoreganj'), ('Kurigram'),
    ('Kushtia'), ('Lakshmipur'), ('Lalmonirhat'), ('Madaripur'), ('Magura'),
    ('Manikganj'), ('Meherpur'), ('Moulvibazar'), ('Munshiganj'), ('Mymensingh'),
    ('Naogaon'), ('Narail'), ('Narayanganj'), ('Narsingdi'), ('Natore'),
    ('Netrakona'), ('Nilphamari'), ('Noakhali'), ('Pabna'), ('Panchagarh'),
    ('Patuakhali'), ('Pirojpur'), ('Rajbari'), ('Rajshahi'), ('Rangamati'),
    ('Rangpur'), ('Satkhira'), ('Shariatpur'), ('Sherpur'), ('Sirajganj'),
    ('Sunamganj'), ('Sylhet'), ('Tangail'), ('Thakurgaon')
ON CONFLICT (name) DO NOTHING;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(100) NOT NULL,
    mobile_number VARCHAR(15) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'farmer' CHECK (role IN ('farmer', 'admin')),
    crop_name VARCHAR(50),
    district_id INTEGER REFERENCES districts(id),
    land_size_acres DECIMAL(10,2),
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    location_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_mobile ON users(mobile_number);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_district ON users(district_id);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE districts ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data" ON users
    FOR SELECT USING (true); -- We'll handle this in the backend for now

-- Policy: Users can update their own data
CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (true); -- We'll handle this in the backend for now

-- Policy: Anyone can read districts (needed for signup)
CREATE POLICY "Anyone can read districts" ON districts
    FOR SELECT USING (true);

-- Policy: Only admins can modify districts
CREATE POLICY "Only admins can modify districts" ON districts
    FOR ALL USING (false); -- We'll handle admin operations through service role

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert a default admin user (you can change the password later)
-- Password is hashed version of 'admin123' - change this in production!
INSERT INTO users (full_name, mobile_number, password, role) VALUES
    ('System Admin', '01700000000', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
ON CONFLICT (mobile_number) DO NOTHING;

-- Create a view for user data with district names (optional, for easier queries)
CREATE OR REPLACE VIEW user_profiles AS
SELECT 
    u.id,
    u.full_name,
    u.mobile_number,
    u.role,
    u.crop_name,
    u.district_id,
    d.name as district_name,
    u.land_size_acres,
    u.latitude,
    u.longitude,
    u.location_address,
    u.created_at,
    u.updated_at
FROM users u
LEFT JOIN districts d ON u.district_id = d.id;

-- Grant necessary permissions (Supabase handles most of this automatically)
-- These are mainly for reference

-- GRANT USAGE ON SCHEMA public TO anon, authenticated;
-- GRANT SELECT ON districts TO anon, authenticated;
-- GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE districts_id_seq TO authenticated;

COMMENT ON TABLE districts IS 'All 64 districts of Bangladesh';
COMMENT ON TABLE users IS 'User accounts for farmers and admins';
COMMENT ON COLUMN users.role IS 'User role: farmer or admin';
COMMENT ON COLUMN users.mobile_number IS 'Bangladeshi mobile number format: 01XXXXXXXXX';
COMMENT ON COLUMN users.crop_name IS 'Primary crop grown by the farmer';
COMMENT ON COLUMN users.land_size_acres IS 'Farm land size in acres';
COMMENT ON COLUMN users.latitude IS 'GPS latitude for weather data';
COMMENT ON COLUMN users.longitude IS 'GPS longitude for weather data';
COMMENT ON COLUMN users.location_address IS 'Human readable address from GPS';

-- Display success message
SELECT 'AgriSense database schema created successfully! 🌾' as message;

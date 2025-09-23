-- AgriSense Database Migration - Add Land Size and Location Fields
-- Run these commands in your Supabase SQL editor to update existing database

-- Add new columns to the users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS land_size_acres DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10,8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11,8),
ADD COLUMN IF NOT EXISTS location_address TEXT;

-- Create index for location queries (for weather data lookups)
CREATE INDEX IF NOT EXISTS idx_users_location ON users(latitude, longitude);

-- Drop and recreate the user_profiles view to include new fields
DROP VIEW IF EXISTS user_profiles;

CREATE VIEW user_profiles AS
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

-- Add comments for the new columns
COMMENT ON COLUMN users.mobile_number IS 'Bangladeshi mobile number format: +8801XXXXXXXXX';
COMMENT ON COLUMN users.land_size_acres IS 'Farm land size in acres';
COMMENT ON COLUMN users.latitude IS 'GPS latitude for weather data';
COMMENT ON COLUMN users.longitude IS 'GPS longitude for weather data';
COMMENT ON COLUMN users.location_address IS 'Human readable address from GPS';

-- Update admin mobile number to new format (optional - only if you want to change it)
-- UPDATE users SET mobile_number = '+8801700000000' WHERE mobile_number = '01700000000' AND role = 'admin';

-- Display success message
SELECT 'Database migration completed successfully!' as message,
       'New fields added: land_size_acres, latitude, longitude, location_address' as details;

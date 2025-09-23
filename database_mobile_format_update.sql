-- AgriSense Database Update - Mobile Number Format Change
-- Run this in your Supabase SQL editor to update mobile number format from 01XXXXXXXXX to +8801XXXXXXXXX

-- Update existing admin user mobile number format
UPDATE users 
SET mobile_number = '+88' || mobile_number 
WHERE mobile_number LIKE '01%' 
AND role = 'admin';

-- Update existing farmer users mobile number format (if any)
UPDATE users 
SET mobile_number = '+88' || mobile_number 
WHERE mobile_number LIKE '01%' 
AND role = 'farmer';

-- Update the comment to reflect new format
COMMENT ON COLUMN users.mobile_number IS 'Bangladeshi mobile number format: +8801XXXXXXXXX';

-- Verify the update
SELECT 
    id, 
    full_name, 
    mobile_number, 
    role,
    'Updated to +88 format' as status
FROM users 
WHERE mobile_number LIKE '+8801%';

-- Display success message
SELECT 'Mobile number format updated successfully!' as message,
       'All mobile numbers now use +8801XXXXXXXXX format' as details;

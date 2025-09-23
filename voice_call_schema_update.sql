-- Add voice call tracking fields to farm_alerts table
-- Run this in your Supabase SQL editor

ALTER TABLE farm_alerts ADD COLUMN IF NOT EXISTS voice_call_initiated BOOLEAN DEFAULT false;
ALTER TABLE farm_alerts ADD COLUMN IF NOT EXISTS voice_call_id VARCHAR(255);
ALTER TABLE farm_alerts ADD COLUMN IF NOT EXISTS voice_call_status VARCHAR(50);
ALTER TABLE farm_alerts ADD COLUMN IF NOT EXISTS voice_call_response JSONB;
ALTER TABLE farm_alerts ADD COLUMN IF NOT EXISTS voice_call_duration INTEGER; -- in seconds
ALTER TABLE farm_alerts ADD COLUMN IF NOT EXISTS voice_call_completed_at TIMESTAMP WITH TIME ZONE;

-- Create index for voice call queries
CREATE INDEX IF NOT EXISTS idx_farm_alerts_voice_call_id ON farm_alerts(voice_call_id);
CREATE INDEX IF NOT EXISTS idx_farm_alerts_voice_initiated ON farm_alerts(voice_call_initiated, created_at) WHERE voice_call_initiated = true;

-- Drop and recreate the recent alerts view to include voice call data
DROP VIEW IF EXISTS recent_farm_alerts;

CREATE VIEW recent_farm_alerts AS
SELECT 
    fa.*,
    u.full_name,
    u.mobile_number,
    u.crop_name,
    d.device_name,
    CASE 
        WHEN fa.voice_call_initiated AND fa.voice_call_status = 'completed' THEN 'SMS + Voice Call Completed'
        WHEN fa.voice_call_initiated AND fa.voice_call_status = 'in-progress' THEN 'SMS + Voice Call Active'
        WHEN fa.voice_call_initiated THEN 'SMS + Voice Call Initiated'
        WHEN fa.is_sms_sent THEN 'SMS Only'
        ELSE 'Alert Created'
    END as notification_status
FROM farm_alerts fa
JOIN users u ON fa.user_id = u.id
LEFT JOIN devices d ON fa.device_id = d.id
WHERE fa.created_at > NOW() - INTERVAL '24 hours'
ORDER BY fa.created_at DESC;

-- Add comments for new columns
COMMENT ON COLUMN farm_alerts.voice_call_initiated IS 'Whether a voice call was initiated via Retell AI';
COMMENT ON COLUMN farm_alerts.voice_call_id IS 'Retell AI call ID for tracking';
COMMENT ON COLUMN farm_alerts.voice_call_status IS 'Status: initiated, ringing, answered, completed, failed';
COMMENT ON COLUMN farm_alerts.voice_call_response IS 'Full response from Retell AI API';
COMMENT ON COLUMN farm_alerts.voice_call_duration IS 'Call duration in seconds';

SELECT 'Voice call tracking added to farm_alerts table! 📞' as message;

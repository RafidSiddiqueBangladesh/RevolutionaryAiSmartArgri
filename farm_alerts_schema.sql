-- Farm Alerts Schema for SMS Tracking
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS farm_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'critical_moisture', 'ph_warning', 'temperature_alert', etc.
    message_bangla TEXT NOT NULL, -- The Bangla message sent to farmer
    message_english TEXT, -- English version for logs
    sensor_data JSONB, -- Store the sensor readings that triggered the alert
    is_sms_sent BOOLEAN DEFAULT false,
    sms_sent_at TIMESTAMP WITH TIME ZONE,
    sms_response JSONB, -- Store SMS API response
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_farm_alerts_user_id ON farm_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_farm_alerts_created_at ON farm_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_farm_alerts_pending_sms ON farm_alerts(is_sms_sent, created_at) WHERE is_sms_sent = false;

-- Function to prevent duplicate alerts within the same hour
CREATE OR REPLACE FUNCTION prevent_duplicate_alerts()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there's already an alert of the same type for this user within the last hour
    IF EXISTS (
        SELECT 1 FROM farm_alerts 
        WHERE user_id = NEW.user_id 
        AND alert_type = NEW.alert_type 
        AND created_at > NOW() - INTERVAL '1 hour'
    ) THEN
        -- Return NULL to cancel the insert
        RETURN NULL;
    END IF;
    
    -- Allow the insert
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent duplicate alerts
CREATE TRIGGER prevent_duplicate_alerts_trigger
    BEFORE INSERT ON farm_alerts
    FOR EACH ROW
    EXECUTE FUNCTION prevent_duplicate_alerts();

-- Enable RLS
ALTER TABLE farm_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see their own alerts
CREATE POLICY "Users can view their own alerts" ON farm_alerts
    FOR SELECT USING (user_id = auth.uid());

-- RLS Policy: System can insert alerts
CREATE POLICY "System can insert alerts" ON farm_alerts
    FOR INSERT WITH CHECK (true);

-- RLS Policy: System can update SMS status
CREATE POLICY "System can update SMS status" ON farm_alerts
    FOR UPDATE USING (true);

-- Create a view for recent alerts
CREATE OR REPLACE VIEW recent_farm_alerts AS
SELECT 
    fa.*,
    u.full_name,
    u.mobile_number,
    u.crop_name,
    d.device_name
FROM farm_alerts fa
JOIN users u ON fa.user_id = u.id
LEFT JOIN devices d ON fa.device_id = d.id
WHERE fa.created_at > NOW() - INTERVAL '24 hours'
ORDER BY fa.created_at DESC;

-- Add comments
COMMENT ON TABLE farm_alerts IS 'Stores critical farm alerts and SMS delivery status';
COMMENT ON COLUMN farm_alerts.alert_type IS 'Type of alert: critical_moisture, ph_warning, temperature_alert, etc.';
COMMENT ON COLUMN farm_alerts.message_bangla IS 'Alert message in Bangla for SMS';
COMMENT ON COLUMN farm_alerts.sensor_data IS 'Sensor readings that triggered this alert';
COMMENT ON COLUMN farm_alerts.is_sms_sent IS 'Whether SMS was successfully sent';

SELECT 'Farm alerts schema created successfully! 🚨' as message;

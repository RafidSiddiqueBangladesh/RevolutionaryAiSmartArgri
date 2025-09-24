-- Farm Analyses Table Schema
CREATE TABLE IF NOT EXISTS farm_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  analysis_data JSONB NOT NULL,
  ai_analysis TEXT NOT NULL,
  action_required BOOLEAN NOT NULL DEFAULT false,
  sms_message TEXT,
  sms_sent BOOLEAN DEFAULT false,
  sms_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes for better performance
  CONSTRAINT farm_analyses_user_device_idx UNIQUE (user_id, device_id, created_at)
);

-- Add indexes for faster queries
CREATE INDEX IF NOT EXISTS farm_analyses_user_id_idx ON farm_analyses (user_id);
CREATE INDEX IF NOT EXISTS farm_analyses_device_id_idx ON farm_analyses (device_id);
CREATE INDEX IF NOT EXISTS farm_analyses_created_at_idx ON farm_analyses (created_at);
CREATE INDEX IF NOT EXISTS farm_analyses_action_required_idx ON farm_analyses (action_required);

-- Add comment for documentation
COMMENT ON TABLE farm_analyses IS 'Stores daily farm analysis results from AI processing';

-- Update existing farm_alerts table to add missing columns
ALTER TABLE farm_alerts 
ADD COLUMN IF NOT EXISTS severity VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS acknowledged BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

-- Add indexes for better performance on existing farm_alerts table
CREATE INDEX IF NOT EXISTS farm_alerts_user_id_idx ON farm_alerts (user_id);
CREATE INDEX IF NOT EXISTS farm_alerts_device_id_idx ON farm_alerts (device_id);
CREATE INDEX IF NOT EXISTS farm_alerts_alert_type_idx ON farm_alerts (alert_type);
CREATE INDEX IF NOT EXISTS farm_alerts_severity_idx ON farm_alerts (severity);
CREATE INDEX IF NOT EXISTS farm_alerts_created_at_idx ON farm_alerts (created_at);
CREATE INDEX IF NOT EXISTS farm_alerts_acknowledged_idx ON farm_alerts (acknowledged);

-- Add comment for documentation
COMMENT ON TABLE farm_alerts IS 'Stores critical farm alerts and notifications sent to farmers';

-- Enable Row Level Security (RLS)
ALTER TABLE farm_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE farm_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for farm_analyses
CREATE POLICY "Users can view their own farm analyses" ON farm_analyses
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "System can insert farm analyses" ON farm_analyses
  FOR INSERT WITH CHECK (true);

-- RLS Policies for farm_alerts
CREATE POLICY "Users can view their own farm alerts" ON farm_alerts
  FOR SELECT USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "System can insert farm alerts" ON farm_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own farm alerts" ON farm_alerts
  FOR UPDATE USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

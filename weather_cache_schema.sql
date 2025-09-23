-- Weather Cache Table Schema
CREATE TABLE IF NOT EXISTS weather_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL, -- 'current', 'forecast', or 'alerts'
  latitude VARCHAR(10) NOT NULL,
  longitude VARCHAR(10) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Index for faster lookups
  CONSTRAINT weather_cache_type_location_idx UNIQUE (type, latitude, longitude)
);

-- Add index for timestamp-based queries
CREATE INDEX IF NOT EXISTS weather_cache_created_at_idx ON weather_cache (created_at);

-- Add comment for documentation
COMMENT ON TABLE weather_cache IS 'Caches weather data from external API to reduce API calls and improve performance';
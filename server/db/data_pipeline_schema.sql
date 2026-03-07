-- Data Pipeline Schema Extension
-- Additional tables for automatic data fetching from external sources

-- Enable PostGIS for geographic queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- ==========================================
-- DATA SOURCES CONFIGURATION
-- ==========================================

-- Track external data sources
CREATE TABLE IF NOT EXISTS data_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- 'eop', 'osm', 'egov'
    base_url TEXT,
    api_key VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    last_fetch TIMESTAMP WITH TIME ZONE,
    fetch_interval_minutes INTEGER DEFAULT 60,
    config JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ==========================================
-- OSM DATA STORAGE
-- ==========================================

-- Store OpenStreetMap data for Stara Zagora
CREATE TABLE IF NOT EXISTS osm_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    osm_id BIGINT UNIQUE,
    osm_type VARCHAR(10), -- 'node', 'way', 'relation'
    data_type VARCHAR(50) NOT NULL, -- 'street', 'building', 'bus_stop', 'school', etc.
    name VARCHAR(500),
    tags JSONB DEFAULT '{}',
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    geometry JSONB, -- For complex geometries
    source VARCHAR(50) DEFAULT 'osm',
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_osm_id_type UNIQUE (osm_id, osm_type)
);

-- Index for geo-queries
CREATE INDEX IF NOT EXISTS idx_osm_data_location ON osm_data(lat, lng);
CREATE INDEX IF NOT EXISTS idx_osm_data_type ON osm_data(data_type);
CREATE INDEX IF NOT EXISTS idx_osm_data_name ON osm_data(name);

-- ==========================================
-- EOP (PUBLIC PROCUREMENT) DATA
-- ==========================================

-- Store scraped data from eop.bg
CREATE TABLE IF NOT EXISTS eop_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    eop_id VARCHAR(100) UNIQUE,
    source_url TEXT,
    title VARCHAR(1000),
    description TEXT,
    status VARCHAR(50),
    budget DECIMAL(15, 2),
    currency VARCHAR(3) DEFAULT 'BGN',
    contractor VARCHAR(500),
    contract_number VARCHAR(100),
    awarding_type VARCHAR(100),
    procurement_type VARCHAR(100),
    cpv_code VARCHAR(20),
    address VARCHAR(500),
    settlement VARCHAR(100),
    municipality VARCHAR(100),
    lat DECIMAL(10, 8),
    lng DECIMAL(11, 8),
    start_date DATE,
    end_date DATE,
    publication_date DATE,
    raw_data JSONB,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_eop_data_status ON eop_data(status);
CREATE INDEX IF NOT EXISTS idx_eop_data_budget ON eop_data(budget);
CREATE INDEX IF NOT EXISTS idx_eop_data_settlement ON eop_data(settlement);
CREATE INDEX IF NOT EXISTS idx_eop_data_location ON eop_data(lat, lng);

-- ==========================================
-- E-GOV DATA
-- ==========================================

-- Store data from data.egov.bg
CREATE TABLE IF NOT EXISTS egov_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_id VARCHAR(100),
    dataset_name VARCHAR(200),
    title VARCHAR(1000),
    description TEXT,
    category VARCHAR(100),
    data JSONB,
    source_url TEXT,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_egov_external UNIQUE (external_id, dataset_name)
);

CREATE INDEX IF NOT EXISTS idx_egov_data_category ON egov_data(category);
CREATE INDEX IF NOT EXISTS idx_egov_data_dataset ON egov_data(dataset_name);

-- ==========================================
-- SCRAPER LOGS
-- ==========================================

-- Log all scraper runs
CREATE TABLE IF NOT EXISTS scraper_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'started', 'success', 'failed', 'partial'
    items_fetched INTEGER DEFAULT 0,
    items_added INTEGER DEFAULT 0,
    items_updated INTEGER DEFAULT 0,
    items_skipped INTEGER DEFAULT 0,
    error_message TEXT,
    duration_seconds INTEGER,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_scraper_logs_source ON scraper_logs(source);
CREATE INDEX IF NOT EXISTS idx_scraper_logs_started ON scraper_logs(started_at DESC);

-- ==========================================
-- UNIFIED PROJECTS VIEW
-- ==========================================

-- Combined view of all projects from all sources
CREATE OR REPLACE VIEW unified_projects AS
SELECT 
    id,
    title,
    description,
    status,
    budget,
    'eop' as source_type,
    source_url as source_link,
    lat,
    lng,
    address,
    contractor,
    start_date,
    end_date,
    publication_date as created_at,
    updated_at
FROM eop_data
WHERE lat IS NOT NULL AND lng IS NOT NULL

UNION ALL

SELECT 
    id,
    name as title,
    NULL as description,
    'active' as status,
    NULL as budget,
    'osm' as source_type,
    NULL as source_link,
    lat,
    lng,
    NULL as address,
    NULL as contractor,
    NULL as start_date,
    NULL as end_date,
    fetched_at as created_at,
    fetched_at as updated_at
FROM osm_data
WHERE lat IS NOT NULL AND lng IS NOT NULL 
    AND data_type IN ('building', 'school', 'hospital', 'library');

-- ==========================================
-- DEFAULT DATA SOURCES
-- ==========================================

INSERT INTO data_sources (name, type, base_url, fetch_interval_minutes, enabled) VALUES
    ('ЦАИС ЕОП', 'eop', 'https://app.eop.bg', 60, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO data_sources (name, type, base_url, fetch_interval_minutes, enabled) VALUES
    ('OpenStreetMap', 'osm', 'https://overpass-api.de/api/interpreter', 360, true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO data_sources (name, type, base_url, fetch_interval_minutes, enabled) VALUES
    ('data.egov.bg', 'egov', 'https://data.egov.bg/api/3/action', 120, true)
ON CONFLICT (name) DO NOTHING;

-- Update trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_data_sources_updated_at ON data_sources;
CREATE TRIGGER update_data_sources_updated_at
    BEFORE UPDATE ON data_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


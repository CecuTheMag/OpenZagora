# Map Data Flow Debugging Guide

## Current Issues
1. Database tables (osm_data, eop_data, etc.) don't exist
2. Schema initialization scripts not running on container startup
3. Data pipeline trying to insert data into non-existent tables

## Data Flow Architecture

### 1. Frontend (MapPage.jsx)
```
MapPage.jsx:fetchData()
  ↓
  GET /api/osm/unified/map?limit=2000
  ↓
  Vite Proxy (vite.config.js)
  ↓
  Forwards to http://server:5000/api/osm/unified/map
```

### 2. Backend API (server/routes/osm.js)
```
GET /api/osm/unified/map
  ↓
  router.get('/unified/map', async (req, res) => {...})
  ↓
  Calls: dbService.getAllOsmData(limit)
  Calls: dbService.getEopData(limit)
  ↓
  Transforms data to markers format
  ↓
  Returns: { success: true, total: X, data: [...markers] }
```

### 3. Database Service (server/services/dbService.js)
```
dbService.getAllOsmData(limit)
  ↓
  SELECT * FROM osm_data WHERE lat IS NOT NULL AND lng IS NOT NULL
  ↓
  Returns array of OSM records

dbService.getEopData(limit)
  ↓
  SELECT * FROM eop_data WHERE lat IS NOT NULL AND lng IS NOT NULL
  ↓
  Returns array of EOP records
```

### 4. Data Pipeline (server/services/dataPipeline.js)
```
On server startup:
  ↓
  dataPipeline.initialize()
  ↓
  dbService.initSchema() - Creates tables
  ↓
  runFullPipeline()
  ↓
  fetchOsmData() → overpassClient.fetchAllData() → dbService.upsertOsmData()
  fetchEopData() → eopScraper.fetchTenders() → dbService.upsertEopData()
  fetchEgovData() → egovApiClient.getStaraZagoraData() → dbService.upsertEgovData()
```

## Problem Root Cause

The database initialization scripts in `/docker-entrypoint-initdb.d/` only run when:
- The database is created for the FIRST time
- The data directory is empty

Since you've restarted containers multiple times, the database already exists but the schema wasn't fully initialized.

## Solution Steps

### Step 1: Manually Run Schema (REQUIRED)
```bash
# Stop containers
podman-compose -f docker-compose.dev.yml down

# Remove volumes to start fresh
podman-compose -f docker-compose.dev.yml down -v

# Start containers - this will run init scripts
podman-compose -f docker-compose.dev.yml up --build
```

### Step 2: Verify Tables Exist
```bash
# Connect to database
podman exec -it open-zagora-db-dev psql -U postgres -d open_zagora

# List tables
\dt

# Should see:
# - projects
# - budget_items
# - council_votes
# - osm_data
# - eop_data
# - egov_data
# - data_sources
# - scraper_logs
```

### Step 3: Check Data Pipeline
```bash
# View server logs
podman logs -f open-zagora-server-dev

# Should see:
# ✅ Data pipeline schema initialized
# 🚀 Initializing Data Pipeline...
# 📥 Fetching OSM data...
# ✅ OSM fetch complete: X fetched, Y added
```

### Step 4: Test API Endpoints
```bash
# Test health
curl http://localhost:5000/api/health

# Test debug endpoint
curl http://localhost:5000/api/osm/debug

# Should return:
# {
#   "success": true,
#   "tables": ["osm_data", "eop_data"],
#   "counts": { "osm": X, "eop": Y }
# }

# Test map endpoint
curl http://localhost:5000/api/osm/unified/map?limit=10

# Should return:
# {
#   "success": true,
#   "total": X,
#   "data": [...]
# }
```

## Current Container Status

### Database (open-zagora-db-dev)
- Image: postgis/postgis:15-3.4-alpine ✅
- PostGIS extension: Available ✅
- Schema files mounted: ✅
  - /docker-entrypoint-initdb.d/01-schema.sql
  - /docker-entrypoint-initdb.d/02-budget-schema.sql
  - /docker-entrypoint-initdb.d/03-data-pipeline-schema.sql
- **Issue**: Scripts not running because DB already exists

### Server (open-zagora-server-dev)
- Running: ✅
- Connected to DB: ✅
- Data pipeline initialized: ⚠️ (tables missing)
- **Issue**: Trying to insert data into non-existent tables

### Client (open-zagora-client-dev)
- Running: ✅
- Vite proxy configured: ✅
- API_URL: /api ✅
- **Issue**: Proxy can't connect to server (wrong IP)

## Vite Proxy Issue

The client container is trying to connect to `10.89.0.10:5000` but server might be on different IP.

### Fix Vite Proxy
In `client/vite.config.js`:
```javascript
proxy: {
  '/api': {
    target: 'http://server:5000',  // Use container name, not IP
    changeOrigin: true,
    secure: false,
  }
}
```

This is already correct in your config. The issue is the containers aren't on the same network or server isn't listening.

## Quick Fix Commands

```bash
# 1. Complete reset
podman-compose -f docker-compose.dev.yml down -v

# 2. Rebuild everything
podman-compose -f docker-compose.dev.yml up --build

# 3. Wait for "Database system is ready to accept connections"

# 4. Wait for "✅ Data Pipeline initialized"

# 5. Check browser console - should see:
#    API_URL configured as: /api
#    Markers received: X markers

# 6. If still 0 markers, manually trigger:
#    Click "Fetch Data" button in UI
#    OR
#    curl -X POST http://localhost:5000/api/scraper/run -H "Content-Type: application/json" -d '{"type":"full"}'
```

## Expected Final State

1. Database has all tables created
2. OSM data: ~100-500 records (schools, hospitals, libraries, bus stops)
3. EOP data: 0-5 records (mock data with geocoded coordinates)
4. Map shows markers for all data
5. No errors in browser console
6. No "relation does not exist" errors in server logs

## Monitoring Commands

```bash
# Watch server logs
podman logs -f open-zagora-server-dev

# Watch database logs
podman logs -f open-zagora-db-dev

# Watch client logs
podman logs -f open-zagora-client-dev

# Check container network
podman network inspect open-zagora-dev-network

# Check if server is listening
podman exec open-zagora-server-dev netstat -tlnp | grep 5000
```

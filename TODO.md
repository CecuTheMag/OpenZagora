# OpenZagora Map Tenders Fix - TODO

## Approved Plan Progress
✅ **Phase 1**: Fix immediate geocoding (server restart + test)
✅ **Phase 2**: Add EOP map endpoint + frontend integration  
✅ **Phase 3**: Full data pipeline + cron

## Step-by-Step Execution

### 1. Restart Server (Resolves module state)
```
podman-compose restart server
```
**Status**: ❌ No podman-compose (manual restart needed)

### 2. Test Geocoding Manually
```
curl POST /api/eop/geocode
```
**Status**: ❌ Still "not a function" error

### 3. Verify EOP Data in DB
**Status**: [PENDING] (627 imported, geocoding async)

### 4. Create EOP Map Endpoint
**File**: `server/routes/eop.js`  
**Status**: ✅ `/api/eop/map` added

### 5. Update MapPage Frontend
**File**: `client/src/pages/MapPage.jsx`  
**Status**: [PENDING]

### 6. Test Full Flow
**Status**: [PENDING]

### 2. Test Geocoding Manually
```
curl -X POST http://localhost:5000/api/eop/geocode -H "Content-Type: application/json" -d '{"method":"hybrid"}'
```
**Expected**: `{"success":true,"message":"Geocoding started..."}`  
**Status**: [PENDING] → Verify console logs for Nominatim hits

### 3. Verify EOP Data in DB
Install psql then:
```
psql -h localhost -p 5432 -U postgres -d open_zagora -c "SELECT COUNT(*) FROM eop_data WHERE lat IS NOT NULL;"
```
**Expected**: >0 geocoded tenders  
**Status**: [PENDING]

### 4. Create EOP Map Endpoint
**File**: `server/routes/eop.js`  
**Add**: `GET /api/eop/map` → formatted markers (source: 'eop')  
**Status**: [PENDING]

### 5. Update MapPage Frontend
**File**: `client/src/pages/MapPage.jsx`  
**Changes**: 
- Add EOP fetch in `fetchData()`
- EOP source filter toggle
- Merge EOP+OSM+projects data  
**Status**: [PENDING]

### 6. Test Full Flow
```
1. Refresh MapPage → see EOP markers (blue)
2. "Locate tenders" button → no error
3. Filter toggle: EOP/OSM/Projects
```
**Status**: [PENDING]

### 7. Productionize
- Auto-import cron: New tenders → geocode
- Unified `/osm/unified/map` merges all sources
**Status**: [PENDING]

**Next manual step**: Run server restart + geocode test, then report output!


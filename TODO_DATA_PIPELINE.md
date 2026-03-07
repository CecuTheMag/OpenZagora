# Data Pipeline Implementation TODO

## Phase 1: Dependencies & Database
- [x] 1.1 Add new npm packages to server/package.json
- [x] 1.2 Enable PostGIS extension in schema.sql
- [x] 1.3 Create new tables: osm_data, scraper_log, data_sources

## Phase 2: Scraper Services
- [x] 2.1 Create eopScraper.js - Scrape eop.bg
- [x] 2.2 Create overpassClient.js - Fetch OSM data
- [x] 2.3 Create egovApiClient.js - Fetch data.egov.bg
- [x] 2.4 Create geocoderService.js - Nominatim geocoding
- [x] 2.5 Create dbService.js - Database operations

## Phase 3: Scheduler
- [x] 3.1 Create dataPipeline.js - Orchestrator with node-cron

## Phase 4: API Routes
- [x] 4.1 Create routes/scraper.js - Scraper endpoints
- [x] 4.2 Create routes/osm.js - OSM data endpoints
- [x] 4.3 Update server.js to use new routes

## Phase 5: Frontend
- [x] 5.1 Update MapPage.jsx to show all data sources
- [x] 5.2 Add data source filter UI

## Phase 6: Integration
- [x] 6.1 Update docker-compose to include data pipeline schema
- [x] 6.2 Implementation complete


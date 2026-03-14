/**
 * OSM Data API Routes
 * Endpoints for serving OpenStreetMap and unified project data
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');
const overpassClient = require('../services/overpassClient');
const { Pool } = require('pg');

/**
 * GET /api/osm/debug
 * 
 * Debug endpoint to check data availability
 */
router.get('/debug', async (req, res) => {
    try {
        const { pool } = require('../db/pool');
        
        const result = {
            success: true,
            tables_found: [],
            counts: { osm: 0, eop: 0 },
            samples: { osm: null, eop: null },
            scraper_logs: [],
            data_sources: []
        };
        
        // First check what tables exist
        try {
            const tablesResult = await pool.query(`
                SELECT table_name
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name IN ('osm_data', 'eop_data', 'data_sources', 'scraper_logs')
            `);
            result.tables_found = tablesResult.rows.map(r => r.table_name);
        } catch (e) {
            return res.json({ 
                success: false, 
                error: 'Cannot query information_schema',
                message: e.message 
            });
        }
        
        // Try to get OSM count
        if (result.tables_found.includes('osm_data')) {
            try {
                const osmCount = await pool.query('SELECT COUNT(*)::int as cnt FROM osm_data WHERE lat IS NOT NULL');
                const osmSample = await pool.query('SELECT id, osm_id, data_type, name, lat, lng FROM osm_data WHERE lat IS NOT NULL LIMIT 1');
                result.counts.osm = osmCount.rows[0]?.cnt || 0;
                result.samples.osm = osmSample.rows[0] || null;
            } catch (e) {
                result.osm_error = e.message;
            }
        }
        
        // Try to get EOP count
        if (result.tables_found.includes('eop_data')) {
            try {
                const eopCount = await pool.query('SELECT COUNT(*)::int as cnt FROM eop_data WHERE lat IS NOT NULL');
                const eopSample = await pool.query('SELECT id, eop_id, title, lat, lng FROM eop_data WHERE lat IS NOT NULL LIMIT 1');
                result.counts.eop = eopCount.rows[0]?.cnt || 0;
                result.samples.eop = eopSample.rows[0] || null;
            } catch (e) {
                result.eop_error = e.message;
            }
        }
        
        // Try to get scraper logs
        if (result.tables_found.includes('scraper_logs')) {
            try {
                const logs = await pool.query('SELECT source, status, items_fetched, items_added, items_updated, error_message, completed_at FROM scraper_logs ORDER BY started_at DESC LIMIT 5');
                result.scraper_logs = logs.rows;
            } catch (e) {
                result.logs_error = e.message;
            }
        }
        
        // Try to get data sources
        if (result.tables_found.includes('data_sources')) {
            try {
                const sources = await pool.query('SELECT name, type, enabled, last_fetch FROM data_sources');
                result.data_sources = sources.rows;
            } catch (e) {
                result.sources_error = e.message;
            }
        }
        
        // If no tables found, provide helpful message
        if (result.tables_found.length === 0) {
            result.message = 'No data pipeline tables found. Server should create them on startup. Check server logs.';
            result.hint = 'Make sure server was restarted after code update. Check that pool.js initSchema() is being called.';
        }
        
        res.json(result);
    } catch (error) {
        console.error('Debug error:', error);
        res.status(500).json({
            error: 'Debug failed',
            message: error.message
        });
    }
});

/**
 * POST /api/osm/fetch
 * Fetch OSM data from Overpass API and save to database
 * Fetches schools, hospitals, libraries, bus stops for Stara Zagora
 */
router.post('/fetch', async (req, res) => {
    const pool = new Pool({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'open_zagora',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
    });

    try {
        console.log('🗺️ Starting OSM data fetch from Overpass API...');
        
        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'osm_data'
            ) as exists
        `);
        
        if (!tableCheck.rows[0].exists) {
            throw new Error('Database table "osm_data" does not exist. Please restart the database container with fresh volumes to initialize the schema.');
        }
        
        // Fetch all data types
        const results = await overpassClient.fetchAllData();
        
        let totalSaved = 0;
        
        // Process each data type
        const dataTypes = ['schools', 'hospitals', 'libraries', 'busStops'];
        const typeMap = {
            schools: 'school',
            hospitals: 'hospital',
            libraries: 'library',
            busStops: 'bus_stop'
        };
        
        for (const dataType of dataTypes) {
            const items = results[dataType] || [];
            console.log(`   Processing ${items.length} ${dataType}...`);
            
            for (const item of items) {
                try {
                    await pool.query(`
                        INSERT INTO osm_data (osm_id, osm_type, data_type, name, tags, lat, lng, geometry)
                        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                        ON CONFLICT (osm_id, osm_type) DO UPDATE SET
                            name = EXCLUDED.name,
                            tags = EXCLUDED.tags,
                            lat = EXCLUDED.lat,
                            lng = EXCLUDED.lng,
                            geometry = EXCLUDED.geometry,
                            fetched_at = CURRENT_TIMESTAMP
                    `, [
                        item.osm_id,
                        item.osm_type,
                        typeMap[dataType],
                        item.name,
                        JSON.stringify(item.tags),
                        item.lat,
                        item.lng,
                        item.geometry ? JSON.stringify(item.geometry) : null
                    ]);
                    totalSaved++;
                } catch (err) {
                    // Skip duplicates or errors
                }
            }
        }
        
        console.log(`✅ OSM data fetch complete: ${totalSaved} records saved`);
        
        res.json({
            success: true,
            message: 'OSM data fetched successfully',
            data: {
                schools: results.schools?.length || 0,
                hospitals: results.hospitals?.length || 0,
                libraries: results.libraries?.length || 0,
                busStops: results.busStops?.length || 0,
                totalSaved,
                fetchedAt: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ OSM fetch failed:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch OSM data',
            message: error.message
        });
    } finally {
        pool.end();
    }
});

/**
 * GET /api/osm/:type
 * 
 * Get OSM data by type
 * Types: street, building, bus_stop, school, hospital, library, park, pharmacy
 */
router.get('/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const limit = parseInt(req.query.limit) || 1000;
        
        // Map URL types to database types
        const typeMap = {
            'streets': 'street',
            'buildings': 'building',
            'bus-stops': 'bus_stop',
            'bus_stops': 'bus_stop',
            'schools': 'school',
            'hospitals': 'hospital',
            'libraries': 'library',
            'parks': 'park',
            'pharmacies': 'pharmacy'
        };
        
        const dbType = typeMap[type] || type;
        
        const data = await dbService.getOsmDataByType(dbType, limit);
        
        // Transform to GeoJSON
        const geojson = {
            type: 'FeatureCollection',
            features: data.map(item => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [parseFloat(item.lng), parseFloat(item.lat)]
                },
                properties: {
                    id: item.id,
                    name: item.name,
                    type: item.data_type,
                    tags: item.tags
                }
            }))
        };
        
        res.json({
            success: true,
            type: dbType,
            count: data.length,
            data: geojson
        });
    } catch (error) {
        console.error('Error getting OSM data:', error);
        res.status(500).json({
            error: 'Failed to get OSM data',
            message: error.message
        });
    }
});

/**
 * GET /api/osm
 * 
 * Get all OSM data
 */
router.get('/', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 5000;
        const data = await dbService.getAllOsmData(limit);
        
        // Group by type
        const grouped = {};
        data.forEach(item => {
            const type = item.data_type;
            if (!grouped[type]) {
                grouped[type] = [];
            }
            grouped[type].push({
                id: item.id,
                name: item.name,
                lat: item.lat,
                lng: item.lng,
                tags: item.tags
            });
        });
        
        res.json({
            success: true,
            total: data.length,
            types: Object.keys(grouped),
            data: grouped
        });
    } catch (error) {
        console.error('Error getting all OSM data:', error);
        res.status(500).json({
            error: 'Failed to get OSM data',
            message: error.message
        });
    }
});

/**
 * GET /api/unified/map
 * 
 * Get all projects from all sources for map display
 * This is the main endpoint for the map page
 * 
 * Query params:
 *   - limit: max number of results (default 1000)
 *   - infrastructure: only show infrastructure tenders (default true)
 */
router.get('/unified/map', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 2000;
        const showInfrastructureOnly = req.query.infrastructure === 'true';
        
        // Get data from all sources
        const [osmData, eopData] = await Promise.all([
            dbService.getAllOsmData(limit),
            dbService.getEopData(limit)
        ]);
        
        // Transform to map markers
        const markers = [];
        
        // Infrastructure keywords for filtering tenders
        const infraKeywords = [
            'смр', 'строителств', 'ремонт', 'реконструкц', 'модернизац', 'изграждане',
            'енергийн', 'топлоизолац', 'инфраструктур', 'път', 'улиц', 'мост',
            'канализац', 'водоснабдяван', 'осветлен', 'паркинг', 'благоустройств',
            'училище', 'болница', 'детска', 'ясла', 'социалн', 'култур', 'музей',
            'театър', 'спортн', 'библиотек', 'парк', 'озеленяв', 'сграда', 'жилищн',
            'покрив', 'фасад', 'дограм', 'европейск', 'инженеринг', 'проектиран'
        ];
        
        const excludeKeywords = [
            'хранителн', 'продукт', 'хранене', 'облекло', 'униформа', 'канцеларск',
            'мебели', 'застраховк', 'ветеринар', 'охрана', 'почистван'
        ];
        
        // Helper to check if tender is infrastructure-related
        const isInfrastructure = (text) => {
            const lower = text.toLowerCase();
            // Check excludes first
            for (const ex of excludeKeywords) {
                if (lower.includes(ex)) return false;
            }
            // Check includes
            for (const kw of infraKeywords) {
                if (lower.includes(kw)) return true;
            }
            return false;
        };
        
        // Default coordinates for Stara Zagora (used when tender has no geolocation)
        const defaultLat = 42.4257;
        const defaultLng = 25.6344;
        
        // Add EOP projects - show ALL with coordinates, not just exact ones
        eopData.forEach(item => {
            // Skip records without coordinates
            if (!item.lat || !item.lng) {
                return;
            }
            
            const lat = parseFloat(item.lat);
            const lng = parseFloat(item.lng);
            
            const text = `${item.title || ''} ${item.description || ''}`.toLowerCase();
            
            // If infrastructure filtering is on, skip non-infrastructure
            if (showInfrastructureOnly && !isInfrastructure(text)) {
                return;
            }
            
            markers.push({
                id: item.id,
                source: 'eop',
                title: item.title,
                description: item.description,
                status: item.status,
                budget: item.budget,
                contractor: item.contractor,
                lat: lat,
                lng: lng,
                address: item.address,
                url: item.source_url,
                isInfrastructure: isInfrastructure(text),
                color: item.status === 'completed' ? '#22c55e' : 
                       item.status === 'active' ? '#3b82f6' : '#f59e0b'
            });
        });
        
        // Add OSM points of interest (only important ones)
        const importantTypes = ['school', 'hospital', 'library', 'bus_stop'];
        const osmColors = {
            school: '#8b5cf6',      // purple
            hospital: '#ef4444',     // red
            library: '#0ea5e9',      // sky blue
            bus_stop: '#f97316',     // orange
            building: '#6b7280',     // gray
            park: '#22c55e',         // green
            pharmacy: '#ec4899'      // pink
        };
        
        osmData
            .filter(item => importantTypes.includes(item.data_type) && item.name)
            .forEach(item => {
                markers.push({
                    id: item.id,
                    source: 'osm',
                    title: item.name || item.data_type,
                    type: item.data_type,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lng),
                    color: osmColors[item.data_type] || '#6b7280'
                });
            });
        
        // Calculate stats
        const eopInfra = markers.filter(m => m.source === 'eop' && m.isInfrastructure).length;
        const eopOther = markers.filter(m => m.source === 'eop' && !m.isInfrastructure).length;
        
        res.json({
            success: true,
            total: markers.length,
            sources: {
                eop: {
                    total: eopData.filter(e => e.lat && e.lng).length,
                    infrastructure: eopInfra,
                    other: eopOther
                },
                osm: osmData.filter(item => importantTypes.includes(item.data_type) && item.name).length
            },
            filters: {
                infrastructureOnly: showInfrastructureOnly
            },
            data: markers
        });
    } catch (error) {
        console.error('Error getting unified map data:', error);
        res.status(500).json({
            error: 'Failed to get map data',
            message: error.message
        });
    }
});

/**
 * GET /api/unified/stats
 * 
 * Get statistics from all data sources
 */
router.get('/unified/stats', async (req, res) => {
    try {
        const [osmData, eopData] = await Promise.all([
            dbService.getAllOsmData(10000),
            dbService.getEopData(1000)
        ]);
        
        // Count by type
        const osmByType = {};
        osmData.forEach(item => {
            osmByType[item.data_type] = (osmByType[item.data_type] || 0) + 1;
        });
        
        // EOP stats
        const eopByStatus = {};
        let totalBudget = 0;
        eopData.forEach(item => {
            eopByStatus[item.status] = (eopByStatus[item.status] || 0) + 1;
            if (item.budget) totalBudget += parseFloat(item.budget);
        });
        
        res.json({
            success: true,
            osm: {
                total: osmData.length,
                byType: osmByType
            },
            eop: {
                total: eopData.length,
                byStatus: eopByStatus,
                totalBudget
            },
            unified: {
                totalWithCoords: eopData.filter(e => e.lat && e.lng).length + 
                                 osmData.filter(o => importantTypes && importantTypes.includes(o.data_type)).length
            }
        });
    } catch (error) {
        console.error('Error getting unified stats:', error);
        res.status(500).json({
            error: 'Failed to get stats',
            message: error.message
        });
    }
});

const importantTypes = ['school', 'hospital', 'library', 'bus_stop'];

module.exports = router;

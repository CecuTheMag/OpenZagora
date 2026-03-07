/**
 * OSM Data API Routes
 * Endpoints for serving OpenStreetMap and unified project data
 */

const express = require('express');
const router = express.Router();
const dbService = require('../services/dbService');

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
 */
router.get('/unified/map', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 1000;
        
        // Get data from all sources
        const [osmData, eopData] = await Promise.all([
            dbService.getAllOsmData(limit),
            dbService.getEopData(limit)
        ]);
        
        // Transform to map markers
        const markers = [];
        
        // Add EOP projects (public procurement)
        eopData.forEach(item => {
            if (item.lat && item.lng) {
                markers.push({
                    id: item.id,
                    source: 'eop',
                    title: item.title,
                    description: item.description,
                    status: item.status,
                    budget: item.budget,
                    contractor: item.contractor,
                    lat: parseFloat(item.lat),
                    lng: parseFloat(item.lng),
                    address: item.address,
                    url: item.source_url,
                    color: item.status === 'completed' ? '#22c55e' : 
                           item.status === 'active' ? '#3b82f6' : '#f59e0b'
                });
            }
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
            .filter(item => importantTypes.includes(item.data_type))
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
        
        res.json({
            success: true,
            total: markers.length,
            sources: {
                eop: eopData.length,
                osm: osmData.filter(item => importantTypes.includes(item.data_type)).length
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
                                 osmData.filter(o => importantTypes.includes(o.data_type)).length
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


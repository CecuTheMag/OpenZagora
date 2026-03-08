/**
 * Scraper API Routes
 * Endpoints for controlling and monitoring data scrapers
 */

const express = require('express');
const router = express.Router();
const dataPipeline = require('../services/dataPipeline');
const dbService = require('../services/dbService');

/**
 * GET /api/scraper/status
 * 
 * Get current scraper status and configuration
 */
router.get('/status', async (req, res) => {
    try {
        const status = await dataPipeline.getStatus();
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting scraper status:', error);
        res.status(500).json({
            error: 'Failed to get scraper status',
            message: error.message
        });
    }
});

/**
 * GET /api/scraper/logs
 * 
 * Get recent scraper logs
 */
router.get('/logs', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const logs = await dbService.getScraperLogs(limit);
        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Error getting scraper logs:', error);
        res.status(500).json({
            error: 'Failed to get scraper logs',
            message: error.message
        });
    }
});

/**
 * POST /api/scraper/run
 * 
 * Manually trigger a scraper run
 * Body: { type: 'osm' | 'eop' | 'egov' | 'full' | 'geocode' }
 */
router.post('/run', async (req, res) => {
    try {
        const { type = 'full' } = req.body;
        
        // Validate type
        const validTypes = ['osm', 'eop', 'tenders', 'egov', 'full', 'geocode'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({
                error: 'Invalid scraper type',
                message: `Type must be one of: ${validTypes.join(', ')}`
            });
        }

        // Check if already running
        if (dataPipeline.running && type === 'full') {
            return res.status(409).json({
                error: 'Scraper already running',
                message: 'A pipeline run is already in progress'
            });
        }

        console.log(`📊 Manual scraper trigger: ${type}`);
        
        const result = await dataPipeline.triggerScraper(type);
        
        res.json({
            success: true,
            message: `Scraper ${type} completed`,
            data: result
        });
    } catch (error) {
        console.error('Error running scraper:', error);
        res.status(500).json({
            error: 'Failed to run scraper',
            message: error.message
        });
    }
});

/**
 * GET /api/scraper/sources
 * 
 * Get configured data sources
 */
router.get('/sources', async (req, res) => {
    try {
        const sources = await dbService.getAllDataSources();
        res.json({
            success: true,
            data: sources
        });
    } catch (error) {
        console.error('Error getting data sources:', error);
        res.status(500).json({
            error: 'Failed to get data sources',
            message: error.message
        });
    }
});

/**
 * PUT /api/scraper/sources/:name
 * 
 * Update data source configuration
 */
router.put('/sources/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const { enabled, fetch_interval_minutes, config } = req.body;
        
        // Build update query dynamically
        const updates = [];
        const values = [];
        let paramIndex = 1;
        
        if (typeof enabled === 'boolean') {
            updates.push(`enabled = $${paramIndex++}`);
            values.push(enabled);
        }
        
        if (typeof fetch_interval_minutes === 'number') {
            updates.push(`fetch_interval_minutes = $${paramIndex++}`);
            values.push(fetch_interval_minutes);
        }
        
        if (config && typeof config === 'object') {
            updates.push(`config = $${paramIndex++}`);
            values.push(JSON.stringify(config));
        }
        
        if (updates.length === 0) {
            return res.status(400).json({
                error: 'No valid fields to update',
                message: 'Provide at least one of: enabled, fetch_interval_minutes, config'
            });
        }
        
        values.push(name);
        
        const query = `
            UPDATE data_sources 
            SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE name = $${paramIndex}
            RETURNING *
        `;
        
        const { pool } = require('../db/pool');
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Data source not found',
                message: `No data source found with name: ${name}`
            });
        }
        
        res.json({
            success: true,
            message: 'Data source updated',
            data: result.rows[0]
        });
    } catch (error) {
        console.error('Error updating data source:', error);
        res.status(500).json({
            error: 'Failed to update data source',
            message: error.message
        });
    }
});

/**
 * POST /api/scraper/cleanup
 * 
 * Clean up old data
 * Body: { daysOld?: number }
 */
router.post('/cleanup', async (req, res) => {
    try {
        const { daysOld = 30 } = req.body;
        
        const deleted = await dbService.cleanupOldData(daysOld);
        
        res.json({
            success: true,
            message: `Cleaned up ${deleted} old records`,
            data: { deleted }
        });
    } catch (error) {
        console.error('Error cleaning up data:', error);
        res.status(500).json({
            error: 'Failed to cleanup data',
            message: error.message
        });
    }
});

module.exports = router;


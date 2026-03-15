/**
 * EOP Data Routes
 * API endpoints for fetching and managing EOP tender data
 */


const express = require('express');
const path = require('path');
const router = express.Router();
const eopFetcher = require('../services/eopDataFetcher');
const eopImporter = require('../services/eopDataImporter');
const eopGeocoder = require('../services/eopGeocoder');
const eopAIGeocoder = require('../services/eopAIGeocoder');
const eopExactGeocoder = require('../services/eopExactGeocoder');
const eopHybridGeocoder = require('../services/eopHybridGeocoder');
const eopPoiGeocoder = require('../services/eopPoiGeocoder');

/**
 * GET /api/eop/status
 * Get current EOP data status
 */
router.get('/status', async (req, res) => {
  try {
    // Check if JSON file exists
    const existingData = await eopFetcher.getExistingData();
    
    // Get database stats
    const dbStats = await eopImporter.getStats();
    
    res.json({
      success: true,
      data: {
        jsonFile: {
          exists: !!existingData,
          records: existingData ? existingData.length : 0,
          lastModified: existingData ? new Date().toISOString() : null
        },
        database: {
          records: parseInt(dbStats.total) || 0,
          active: parseInt(dbStats.active) || 0,
          completed: parseInt(dbStats.completed) || 0,
          dateRange: {
            earliest: dbStats.earliest_date,
            latest: dbStats.latest_date
          }
        }
      }
    });
  } catch (error) {
    console.error('Error getting EOP status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get EOP status',
      message: error.message
    });
  }
});

/**
 * POST /api/eop/fetch
 * Fetch fresh data from EOP API and save to JSON
 */
router.post('/fetch', async (req, res) => {
  try {
    console.log('🔄 Starting EOP data fetch...');
    
    // Fetch data from API
    const result = await eopFetcher.fetchAndSave();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'EOP data fetched successfully',
        data: {
          total: result.total,
          filePath: result.filePath,
          fetchedAt: new Date().toISOString()
        }
      });
    } else {
      throw new Error('Fetch failed');
    }
    
  } catch (error) {
    console.error('❌ EOP fetch failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch EOP data',
      message: error.message
    });
  }
});

/**
 * POST /api/eop/import
 * Import JSON data to database
 */
router.post('/import', async (req, res) => {
  try {
    console.log('🔄 Starting EOP data import...');
    
    // Import data from JSON to database
    const result = await eopImporter.importFromJSON();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'EOP data imported successfully',
        data: {
          total: result.total,
          imported: result.imported,
          updated: result.updated,
          skipped: result.skipped,
          importedAt: new Date().toISOString()
        }
      });
    } else {
      throw new Error('Import failed');
    }
    
  } catch (error) {
    console.error('❌ EOP import failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import EOP data',
      message: error.message
    });
  }
});

/**
 * POST /api/eop/geocode
 * Add coordinates to EOP records using geocoding
 */
router.post('/geocode', async (req, res) => {
  try {
    const { method = 'hybrid', limit = 50 } = req.body || {};

    console.log(`🗺️ Starting EOP geocoding (${method})...`);

    let geocodeFn;
    if (method === 'hybrid' || method === 'hybrid-reset') {
      geocodeFn = method === 'hybrid-reset'
        ? () => eopHybridGeocoder.clearAndGeocodeAll()
        : () => eopHybridGeocoder.geocodeAll();
    } else if (method === 'poi') {
      geocodeFn = () => eopPoiGeocoder.geocodeRemaining();
    } else if (method === 'exact') {
      geocodeFn = () => eopExactGeocoder.geocodeAll();
    } else if (method === 'ai') {
      geocodeFn = () => eopAIGeocoder.geocodeAll();
    } else if (method === 'district') {
      const eopDistrictMapper = require('../services/eopDistrictMapper');
      geocodeFn = () => eopDistrictMapper.mapToDistricts();
    } else {
      geocodeFn = () => eopGeocoder.geocodeEOPRecords(limit);
    }

    // Fire and forget — Nominatim takes minutes
    geocodeFn()
      .then(r => console.log(`✅ Geocoding done:`, r))
      .catch(err => console.warn('⚠️ Geocoding error:', err.message));

    res.json({
      success: true,
      message: 'Geocoding started in background. Refresh the map in a few minutes.',
      data: { method, status: 'running_in_background' }
    });

  } catch (error) {
    console.error('❌ EOP geocoding failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to geocode EOP data',
      message: error.message
    });
  }
});

/**
 * POST /api/eop/fetch-and-import
 * Fetch from API and immediately import to database
 */
router.post('/fetch-and-import', async (req, res) => {
  const { Pool } = require('pg');
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'open_zagora',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  });

  try {
    console.log('🚀 Starting full EOP data refresh...');
    
    // First, verify the eop_data table exists
    console.log('Verifying database schema...');
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'eop_data'
      ) as exists
    `);
    
    if (!tableCheck.rows[0].exists) {
      throw new Error('Database table "eop_data" does not exist. Please restart the database container with fresh volumes to initialize the schema.');
    }
    

    // Step 1: Fetch from API (or use existing JSON if available)
    console.log('Step 1: Fetching from EOP API...');
    
    // Check if we already have JSON data
    const existingData = await eopFetcher.getExistingData();
    let fetchResult;
    
    if (existingData && existingData.length > 0) {
      console.log(`📄 Using existing JSON file with ${existingData.length} records`);
      fetchResult = {
        success: true,
        total: existingData.length,
        filePath: path.join(__dirname, '../data/tenders_stara_zagora.json')
      };
    } else {
      fetchResult = await eopFetcher.fetchAndSave();
    }
    
    if (!fetchResult.success) {
      throw new Error('Failed to fetch data from API');
    }
    
    // Step 2: Import to database
    console.log('Step 2: Importing to database...');
    const importResult = await eopImporter.importFromJSON();
    
    if (!importResult.success) {
      throw new Error('Failed to import data to database');
    }
    
    // Step 3: Kick off geocoding async — Nominatim rate-limit means this takes minutes,
    // so we fire-and-forget and return immediately. The map will show new pins after
    // the user refreshes once geocoding finishes.
    pool.query('SELECT COUNT(*) as count FROM eop_data WHERE lat IS NULL OR lng IS NULL')
      .then(r => {
        const needsGeo = parseInt(r.rows[0].count);
        if (needsGeo > 0) {
          console.log(`🗺️ Starting async geocoding for ${needsGeo} records...`);
          eopHybridGeocoder.geocodeAll()
            .then(result => {
              console.log(`✅ Hybrid geocoding done: ${result.updated} placed, ${result.skipped} skipped`);
              return eopPoiGeocoder.geocodeRemaining();
            })
            .then(result => console.log(`✅ POI geocoding done: ${result.placed} placed, ${result.skipped} skipped`))
            .catch(err => console.warn('⚠️ Async geocoding error:', err.message));
        }
      })
      .catch(() => {});

    res.json({
      success: true,
      message: 'EOP data fetched and imported. Geocoding running in background — refresh the map in a few minutes.',
      data: {
        fetch: {
          total: fetchResult.total,
          filePath: fetchResult.filePath
        },
        import: {
          total: importResult.total,
          imported: importResult.imported,
          updated: importResult.updated,
          skipped: importResult.skipped
        },
        geocode: {
          status: 'running_in_background'
        },
        completedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ EOP fetch and import failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch and import EOP data',
      message: error.message,
      hint: error.message.includes('does not exist') 
        ? 'The database schema may not be initialized. Try: podman-compose down -v && podman-compose up --build'
        : null
    });
  } finally {
    pool.end();
  }
});

/**
 * DELETE /api/eop/clear
 * Clear EOP data from database
 */
router.delete('/clear', async (req, res) => {
  try {
    const deletedCount = await eopImporter.clearData();
    
    res.json({
      success: true,
      message: 'EOP data cleared successfully',
      data: {
        deletedCount,
        clearedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ EOP clear failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear EOP data',
      message: error.message
    });
  }
});

/**
 * GET /api/eop/map
 * Get EOP tenders formatted for map display
 */
router.get('/map', async (req, res) => {
  try {
    const { limit = 1000, status } = req.query;
    
    let query = `
      SELECT 
        id,
        title,
        description,
        status,
        budget,
        lat,
        lng,
        eop_id as reference,
        publication_date as start_date,
        end_date,
        contractor,
        address,
        CASE 
          WHEN status = 'active' THEN 'active'
          WHEN status = 'planned' THEN 'planned'
          WHEN status = 'cancelled' THEN 'cancelled'
          ELSE 'completed'
        END as map_status,
        'eop' as source
      FROM eop_data
      WHERE lat IS NOT NULL AND lng IS NOT NULL
    `;
    
    const params = [];
    
    if (status) {
      query += ` AND status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ` ORDER BY publication_date DESC NULLS LAST LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));
    
    const { pool } = require('../db/pool');
    const result = await pool.query(query, params);
    
    // Define colors locally (same as MapPage.jsx)
    const colors = {
      eop: {
        planned: '#f59e0b',
        active: '#3b82f6',
        completed: '#22c55e',
        cancelled: '#ef4444'
      }
    };
    
    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        color: colors.eop[row.map_status] || colors.eop.active
      }))
    });
  } catch (error) {
    console.error('Error fetching EOP map data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch EOP map data',
      message: error.message
    });
  }
});

module.exports = router;

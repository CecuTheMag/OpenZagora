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
    const { method = 'district', limit = 50 } = req.body;
    
    console.log(`🗺️ Starting EOP geocoding (${method})...`);
    
    let updated;
    if (method === 'hybrid') {
      updated = await eopHybridGeocoder.geocodeAll();
    } else if (method === 'exact') {
      updated = await eopExactGeocoder.geocodeAll();
    } else if (method === 'ai') {
      updated = await eopAIGeocoder.geocodeAll();
    } else if (method === 'district') {
      const eopDistrictMapper = require('../services/eopDistrictMapper');
      updated = await eopDistrictMapper.mapToDistricts();
    } else {
      updated = await eopGeocoder.geocodeEOPRecords(limit);
    }
    
    res.json({
      success: true,
      message: `Geocoded ${updated} EOP records`,
      data: {
        method,
        updated,
        geocodedAt: new Date().toISOString()
      }
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
    
    // Step 3: Hybrid geocoding (only if we have records without coordinates)
    console.log('Step 3: Checking for records needing geocoding...');
    let geocodeCount = 0;
    
    try {
      const recordsNeedingGeo = await pool.query(`
        SELECT COUNT(*) as count FROM eop_data WHERE lat IS NULL OR lng IS NULL
      `);
      
      if (parseInt(recordsNeedingGeo.rows[0].count) > 0) {
        console.log(`Found ${recordsNeedingGeo.rows[0].count} records needing geocoding...`);
        const geocodeResult = await eopHybridGeocoder.geocodeAll();
        geocodeCount = geocodeResult.updated || geocodeResult;
      } else {
        console.log('All records already have coordinates, skipping geocoding.');
      }
    } catch (geoError) {
      console.warn('⚠️ Geocoding step skipped:', geoError.message);
      // Continue even if geocoding fails - it's not critical
    }
    
    res.json({
      success: true,
      message: 'EOP data fetched, imported and geocoded successfully',
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
          updated: geocodeCount
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

module.exports = router;
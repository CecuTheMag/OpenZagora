/**
 * EOP Data Routes
 * API endpoints for fetching and managing EOP tender data
 */

const express = require('express');
const router = express.Router();
const eopFetcher = require('../services/eopDataFetcher');
const eopImporter = require('../services/eopDataImporter');

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
 * POST /api/eop/fetch-and-import
 * Fetch from API and immediately import to database
 */
router.post('/fetch-and-import', async (req, res) => {
  try {
    console.log('🚀 Starting full EOP data refresh...');
    
    // Step 1: Fetch from API
    console.log('Step 1: Fetching from EOP API...');
    const fetchResult = await eopFetcher.fetchAndSave();
    
    if (!fetchResult.success) {
      throw new Error('Failed to fetch data from API');
    }
    
    // Step 2: Import to database
    console.log('Step 2: Importing to database...');
    const importResult = await eopImporter.importFromJSON();
    
    if (!importResult.success) {
      throw new Error('Failed to import data to database');
    }
    
    res.json({
      success: true,
      message: 'EOP data fetched and imported successfully',
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
        completedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error('❌ EOP fetch and import failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch and import EOP data',
      message: error.message
    });
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
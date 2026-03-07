/**
 * Data Pipeline Orchestrator
 * Manages automatic data fetching from all sources using node-cron
 */

const cron = require('node-cron');
const overpassClient = require('./overpassClient');
const eopScraper = require('./eopScraper');
const egovApiClient = require('./egovApiClient');
const geocoderService = require('./geocoderService');
const dbService = require('./dbService');

class DataPipeline {
    constructor() {
        this.running = false;
        this.jobs = {};
    }

    /**
     * Initialize the data pipeline
     */
    async initialize() {
        console.log('🚀 Initializing Data Pipeline...');
        
        // Initialize database schema
        const schemaOk = await dbService.initSchema();
        
        if (!schemaOk) {
            console.error('❌ Data pipeline schema initialization failed!');
            console.error('   Tables will not be created. Data fetching will fail.');
            console.error('   Fix: Run `podman-compose down -v && podman-compose up --build`');
            return;
        }
        
        // Start scheduled jobs
        this.startScheduledJobs();
        
        // DISABLED: Don't run on startup to avoid rate limiting
        // User can manually trigger via /api/scraper/run
        console.log('⚠️  Initial data fetch DISABLED (avoiding rate limits)');
        console.log('   Trigger manually: POST /api/scraper/run {"type":"osm"}');
        
        console.log('✅ Data Pipeline initialized and scheduled');
    }

    /**
     * Start all scheduled cron jobs
     */
    startScheduledJobs() {
        // Run OSM fetch every 6 hours
        this.jobs.osm = cron.schedule('0 */6 * * *', () => {
            console.log('⏰ Running scheduled OSM fetch...');
            this.fetchOsmData();
        });

        // Run EOP scraper every hour
        this.jobs.eop = cron.schedule('0 * * * *', () => {
            console.log('⏰ Running scheduled EOP scraper...');
            this.fetchEopData();
        });

        // Run E-gov API every 2 hours
        this.jobs.egov = cron.schedule('0 */2 * * *', () => {
            console.log('⏰ Running scheduled E-gov fetch...');
            this.fetchEgovData();
        });

        // Run geocoding every 30 minutes
        this.jobs.geocode = cron.schedule('*/30 * * * *', () => {
            console.log('⏰ Running scheduled geocoding...');
            this.runGeocoding();
        });

        console.log('📅 Scheduled jobs started:');
        console.log('   - OSM: Every 6 hours');
        console.log('   - EOP: Every hour');
        console.log('   - E-gov: Every 2 hours');
        console.log('   - Geocoding: Every 30 minutes');
    }

    /**
     * Stop all scheduled jobs
     */
    stopScheduledJobs() {
        Object.values(this.jobs).forEach(job => job.stop());
        console.log('⏹️ All scheduled jobs stopped');
    }

    /**
     * Run the complete data pipeline
     */
    async runFullPipeline() {
        if (this.running) {
            console.log('⚠️ Pipeline already running, skipping...');
            return;
        }

        this.running = true;
        console.log('🔄 Starting full data pipeline...');

        const startTime = Date.now();
        let totalItems = 0;

        try {
            // Run all fetch operations
            const results = await Promise.allSettled([
                this.fetchOsmData(),
                this.fetchEopData(),
                this.fetchEgovData()
            ]);

            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    totalItems += result.value?.total || 0;
                } else {
                    console.error(`Pipeline error ${index}:`, result.reason);
                }
            });

            // Run geocoding for unmapped items
            await this.runGeocoding();

            const duration = Math.round((Date.now() - startTime) / 1000);
            console.log(`✅ Full pipeline completed in ${duration}s. Total items: ${totalItems}`);
        } catch (error) {
            console.error('❌ Pipeline error:', error.message);
        } finally {
            this.running = false;
        }
    }

    /**
     * Fetch OSM data from Overpass API
     */
    async fetchOsmData() {
        const startTime = Date.now();
        
        try {
            console.log('📥 Fetching OSM data...');
            
            // Fetch all data types
            const data = await overpassClient.fetchAllData();
            
            let totalFetched = 0;
            let totalAdded = 0;
            let totalUpdated = 0;

            // Process each data type
            for (const [type, items] of Object.entries(data)) {
                if (items && items.length > 0) {
                    console.log(`   Processing ${type}: ${items.length} items`);
                    totalFetched += items.length;
                    
                    const result = await dbService.upsertOsmData(items);
                    totalAdded += result.added;
                    totalUpdated += result.updated;
                }
            }

            const duration = Math.round((Date.now() - startTime) / 1000);
            
            // Log the run
            await dbService.logScraperRun('osm', 'success', totalFetched, totalAdded, totalUpdated, 0, null, duration);
            await dbService.updateDataSourceFetchTime('OpenStreetMap');
            
            console.log(`✅ OSM fetch complete: ${totalFetched} fetched, ${totalAdded} added, ${totalUpdated} updated in ${duration}s`);
            
            return { type: 'osm', total: totalFetched, added: totalAdded, updated: totalUpdated, duration };
        } catch (error) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error('❌ OSM fetch error:', error.message);
            await dbService.logScraperRun('osm', 'failed', 0, 0, 0, 0, error.message, duration);
            
            return { type: 'osm', error: error.message, duration };
        }
    }

    /**
     * Fetch EOP data from eop.bg
     */
    async fetchEopData() {
        const startTime = Date.now();
        
        try {
            console.log('📥 Fetching EOP data...');
            
            // Fetch real data from eop.bg
            const tenders = await eopScraper.fetchTenders();
            
            if (!tenders || tenders.length === 0) {
                console.log('   No EOP data fetched - API may be unavailable');
                return { type: 'eop', total: 0, added: 0, geocoded: 0, duration: 0 };
            }

            // Geocode addresses
            let geocodedCount = 0;
            for (const tender of tenders) {
                if (tender.address && !tender.lat) {
                    const geo = await geocoderService.geocodeWithFallback(tender.address);
                    if (geo) {
                        tender.lat = geo.lat;
                        tender.lng = geo.lng;
                        geocodedCount++;
                    }
                }
            }

            // Save to database
            const result = await dbService.upsertEopData(tenders);
            
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            // Log the run
            await dbService.logScraperRun('eop', 'success', tenders.length, result.added, result.updated, 0, null, duration);
            await dbService.updateDataSourceFetchTime('ЦАИС ЕОП');
            
            console.log(`✅ EOP fetch complete: ${tenders.length} fetched, ${result.added} added, ${geocodedCount} geocoded in ${duration}s`);
            
            return { type: 'eop', total: tenders.length, added: result.added, geocoded: geocodedCount, duration };
        } catch (error) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error('❌ EOP fetch error:', error.message);
            await dbService.logScraperRun('eop', 'failed', 0, 0, 0, 0, error.message, duration);
            
            return { type: 'eop', error: error.message, duration };
        }
    }

    /**
     * Fetch E-gov data from data.egov.bg
     */
    async fetchEgovData() {
        const startTime = Date.now();
        
        try {
            console.log('📥 Fetching E-gov data...');
            
            // Fetch real data from data.egov.bg
            const datasets = await egovApiClient.getStaraZagoraData();
            
            if (!datasets || datasets.length === 0) {
                console.log('   No E-gov data fetched - API may be unavailable');
                return { type: 'egov', total: 0, added: 0, duration: 0 };
            }

            // Save to database
            const result = await dbService.upsertEgovData(datasets);
            
            const duration = Math.round((Date.now() - startTime) / 1000);
            
            // Log the run
            await dbService.logScraperRun('egov', 'success', datasets.length, result.added, result.updated, 0, null, duration);
            await dbService.updateDataSourceFetchTime('data.egov.bg');
            
            console.log(`✅ E-gov fetch complete: ${datasets.length} datasets, ${result.added} added in ${duration}s`);
            
            return { type: 'egov', total: datasets.length, added: result.added, duration };
        } catch (error) {
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error('❌ E-gov fetch error:', error.message);
            await dbService.logScraperRun('egov', 'failed', 0, 0, 0, 0, error.message, duration);
            
            return { type: 'egov', error: error.message, duration };
        }
    }

    /**
     * Run geocoding for items without coordinates
     */
    async runGeocoding() {
        try {
            console.log('📍 Running geocoding for unmapped items...');
            
            // Get EOP items without coordinates
            const eopData = await pool.query(
                'SELECT id, address FROM eop_data WHERE lat IS NULL OR lng IS NULL LIMIT 50'
            );
            
            let geocoded = 0;
            for (const item of eopData.rows) {
                if (item.address) {
                    const geo = await geocoderService.geocodeWithFallback(item.address);
                    if (geo) {
                        await pool.query(
                            'UPDATE eop_data SET lat = $1, lng = $2 WHERE id = $3',
                            [geo.lat, geo.lng, item.id]
                        );
                        geocoded++;
                    }
                }
            }
            
            console.log(`✅ Geocoding complete: ${geocoded} items geocoded`);
            return { geocoded };
        } catch (error) {
            console.error('❌ Geocoding error:', error.message);
            return { error: error.message };
        }
    }

    /**
     * Get pipeline status
     */
    async getStatus() {
        const status = await dbService.getScraperStatus();
        return {
            running: this.running,
            ...status
        };
    }

    /**
     * Manually trigger a specific scraper
     */
    async triggerScraper(type) {
        console.log(`🔄 Manually triggering ${type} scraper...`);
        
        switch (type) {
            case 'osm':
                return await this.fetchOsmData();
            case 'eop':
                return await this.fetchEopData();
            case 'egov':
                return await this.fetchEgovData();
            case 'full':
                return await this.runFullPipeline();
            case 'geocode':
                return await this.runGeocoding();
            default:
                return { error: `Unknown scraper type: ${type}` };
        }
    }
}

// Export singleton instance
const { pool } = require('../db/pool');
module.exports = new DataPipeline();


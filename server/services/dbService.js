/**
 * Database Service
 * Handles all database operations for the data pipeline
 */

const { pool } = require('../db/pool');
const format = require('pg-format');

class DbService {
    /**
     * Initialize the data pipeline schema
     */
    async initSchema() {
        try {
            // Check if tables already exist
            const checkResult = await pool.query(`
                SELECT COUNT(*) as cnt FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = 'osm_data'
            `);
            
            if (parseInt(checkResult.rows[0].cnt) > 0) {
                console.log('✅ Data pipeline tables already exist');
                return true;
            }
            
            const schemaPath = require('path').join(__dirname, '../db/data_pipeline_schema.sql');
            const schema = require('fs').readFileSync(schemaPath, 'utf8');
            
            await pool.query(schema);
            console.log('✅ Data pipeline schema initialized');
            return true;
        } catch (error) {
            console.error('❌ Error initializing schema:', error.message);
            console.error('   This usually means PostGIS is not installed or SQL file has errors');
            return false;
        }
    }

    /**
     * Get data source by name
     */
    async getDataSource(name) {
        try {
            const result = await pool.query(
                'SELECT * FROM data_sources WHERE name = $1',
                [name]
            );
            return result.rows[0] || null;
        } catch (error) {
            console.error('Error getting data source:', error.message);
            return null;
        }
    }

    /**
     * Get all data sources
     */
    async getAllDataSources() {
        try {
            const result = await pool.query('SELECT * FROM data_sources ORDER BY name');
            return result.rows;
        } catch (error) {
            console.error('Error getting data sources:', error.message);
            return [];
        }
    }

    /**
     * Update data source last fetch time
     */
    async updateDataSourceFetchTime(name) {
        try {
            await pool.query(
                'UPDATE data_sources SET last_fetch = CURRENT_TIMESTAMP WHERE name = $1',
                [name]
            );
            return true;
        } catch (error) {
            console.error('Error updating data source:', error.message);
            return false;
        }
    }

    /**
     * Insert or update OSM data
     */
    async upsertOsmData(items) {
        if (!items || items.length === 0) return { added: 0, updated: 0 };

        let added = 0, updated = 0;

        for (const item of items) {
            try {
                const result = await pool.query(
                    `INSERT INTO osm_data (osm_id, osm_type, data_type, name, tags, lat, lng, geometry)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                     ON CONFLICT (osm_id, osm_type) 
                     DO UPDATE SET 
                        name = EXCLUDED.name,
                        tags = EXCLUDED.tags,
                        lat = EXCLUDED.lat,
                        lng = EXCLUDED.lng,
                        geometry = EXCLUDED.geometry,
                        fetched_at = CURRENT_TIMESTAMP
                     RETURNING id`,
                    [
                        item.osm_id,
                        item.osm_type,
                        item.data_type,
                        item.name,
                        JSON.stringify(item.tags || {}),
                        item.lat,
                        item.lng,
                        item.geometry ? JSON.stringify(item.geometry) : null
                    ]
                );

                if (result.rows.length > 0) {
                    const isUpdate = await pool.query(
                        'SELECT fetched_at FROM osm_data WHERE osm_id = $1 AND osm_type = $2',
                        [item.osm_id, item.osm_type]
                    );
                    
                    // Check if it was an insert or update based on timestamp
                    const existing = isUpdate.rows[0];
                    if (existing && new Date(existing.fetched_at).getTime() > Date.now() - 60000) {
                        added++;
                    } else {
                        updated++;
                    }
                }
            } catch (error) {
                console.error(`Error upserting OSM data ${item.osm_id}:`, error.message);
            }
        }

        return { added, updated };
    }

    /**
     * Insert or update EOP data
     */
    async upsertEopData(items) {
        if (!items || items.length === 0) return { added: 0, updated: 0 };

        let added = 0, updated = 0;

        for (const item of items) {
            try {
                const result = await pool.query(
                    `INSERT INTO eop_data (
                        eop_id, source_url, title, description, status, budget, currency,
                        contractor, contract_number, awarding_type, procurement_type,
                        cpv_code, address, settlement, municipality, lat, lng,
                        start_date, end_date, publication_date, raw_data
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
                    ON CONFLICT (eop_id) 
                    DO UPDATE SET 
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        status = EXCLUDED.status,
                        budget = EXCLUDED.budget,
                        contractor = EXCLUDED.contractor,
                        lat = EXCLUDED.lat,
                        lng = EXCLUDED.lng,
                        updated_at = CURRENT_TIMESTAMP,
                        raw_data = EXCLUDED.raw_data
                    RETURNING id`,
                    [
                        item.eop_id,
                        item.source_url,
                        item.title,
                        item.description,
                        item.status,
                        item.budget,
                        item.currency || 'BGN',
                        item.contractor,
                        item.contract_number,
                        item.awarding_type,
                        item.procurement_type,
                        item.cpv_code,
                        item.address,
                        item.settlement || 'Стара Загора',
                        item.municipality || 'Стара Загора',
                        item.lat,
                        item.lng,
                        item.start_date,
                        item.end_date,
                        item.publication_date,
                        item.raw_data ? JSON.stringify(item.raw_data) : null
                    ]
                );

                if (result.rows.length > 0) {
                    added++;
                }
            } catch (error) {
                console.error(`Error upserting EOP data ${item.eop_id}:`, error.message);
            }
        }

        return { added, updated };
    }

    /**
     * Insert or update E-gov data
     */
    async upsertEgovData(items) {
        if (!items || items.length === 0) return { added: 0, updated: 0 };

        let added = 0, updated = 0;

        for (const item of items) {
            try {
                const result = await pool.query(
                    `INSERT INTO egov_data (external_id, dataset_name, title, description, category, data, source_url)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (external_id, dataset_name) 
                     DO UPDATE SET 
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        category = EXCLUDED.category,
                        data = EXCLUDED.data,
                        fetched_at = CURRENT_TIMESTAMP
                     RETURNING id`,
                    [
                        item.external_id,
                        item.dataset_name,
                        item.title,
                        item.description,
                        item.category,
                        item.data ? JSON.stringify(item.data) : null,
                        item.source_url
                    ]
                );

                if (result.rows.length > 0) {
                    added++;
                }
            } catch (error) {
                console.error(`Error upserting E-gov data ${item.external_id}:`, error.message);
            }
        }

        return { added, updated };
    }

    /**
     * Get OSM data by type
     */
    async getOsmDataByType(dataType, limit = 1000) {
        try {
            const result = await pool.query(
                `SELECT * FROM osm_data WHERE data_type = $1 
                 AND lat IS NOT NULL AND lng IS NOT NULL
                 ORDER BY fetched_at DESC LIMIT $2`,
                [dataType, limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting OSM data:', error.message);
            return [];
        }
    }

    /**
     * Get all OSM data with coordinates
     */
    async getAllOsmData(limit = 5000) {
        try {
            const result = await pool.query(
                `SELECT * FROM osm_data 
                 WHERE lat IS NOT NULL AND lng IS NOT NULL
                 ORDER BY data_type, name LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting all OSM data:', error.message);
            return [];
        }
    }

    /**
     * Get EOP data (all tenders, with or without coordinates)
     */
    async getEopData(limit = 500) {
        try {
            const result = await pool.query(
                `SELECT * FROM eop_data 
                 ORDER BY publication_date DESC LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting EOP data:', error.message);
            return [];
        }
    }

    /**
     * Get unified projects from all sources
     */
    async getUnifiedProjects(limit = 1000) {
        try {
            const result = await pool.query(
                `SELECT * FROM unified_projects 
                 ORDER BY created_at DESC LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting unified projects:', error.message);
            // Fallback: get from eop_data
            return await this.getEopData(limit);
        }
    }

    /**
     * Log scraper run
     */
    async logScraperRun(source, status, itemsFetched, itemsAdded, itemsUpdated, itemsSkipped, errorMessage, durationSeconds) {
        try {
            await pool.query(
                `INSERT INTO scraper_logs 
                    (source, status, items_fetched, items_added, items_updated, items_skipped, error_message, duration_seconds, completed_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)`,
                [source, status, itemsFetched, itemsAdded, itemsUpdated, itemsSkipped, errorMessage, durationSeconds]
            );
            return true;
        } catch (error) {
            console.error('Error logging scraper run:', error.message);
            return false;
        }
    }

    /**
     * Get scraper logs
     */
    async getScraperLogs(limit = 50) {
        try {
            const result = await pool.query(
                `SELECT * FROM scraper_logs ORDER BY started_at DESC LIMIT $1`,
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('Error getting scraper logs:', error.message);
            return [];
        }
    }

    /**
     * Get scraper status
     */
    async getScraperStatus() {
        try {
            const sources = await this.getAllDataSources();
            const logs = await this.getScraperLogs(5);
            
            return {
                sources,
                recentLogs: logs,
                lastRun: logs[0]?.started_at || null
            };
        } catch (error) {
            console.error('Error getting scraper status:', error.message);
            return { sources: [], recentLogs: [], lastRun: null };
        }
    }

    /**
     * Clear old OSM data (optional cleanup)
     */
    async cleanupOldData(daysOld = 30) {
        try {
            const result = await pool.query(
                `DELETE FROM osm_data 
                 WHERE fetched_at < NOW() - INTERVAL '${daysOld} days'
                 AND osm_id NOT IN (
                     SELECT DISTINCT osm_id FROM osm_data 
                     WHERE fetched_at >= NOW() - INTERVAL '${daysOld} days'
                 )`
            );
            console.log(`Cleaned up ${result.rowCount} old OSM records`);
            return result.rowCount;
        } catch (error) {
            console.error('Error cleaning up data:', error.message);
            return 0;
        }
    }
}

module.exports = new DbService();


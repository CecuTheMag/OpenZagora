/**
 * EOP Data Importer
 * Imports tender data from JSON file into the database
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

class EOPDataImporter {
  constructor() {
    this.jsonFilePath = path.join(__dirname, '../data/tenders_stara_zagora.json');
  }

  /**
   * Import all tender data from JSON file
   */
  async importFromJSON() {
    try {
      console.log('🔄 Starting EOP data import...');
      
      // Read JSON file
      const jsonData = await fs.readFile(this.jsonFilePath, 'utf8');
      const tenders = JSON.parse(jsonData);
      
      console.log(`📄 Found ${tenders.length} tenders in JSON file`);
      
      if (!Array.isArray(tenders) || tenders.length === 0) {
        throw new Error('No valid tender data found in JSON file');
      }

      // Import each tender
      let imported = 0;
      let updated = 0;
      let skipped = 0;
      
      for (const tender of tenders) {
        try {
          const result = await this.importTender(tender);
          if (result === 'imported') imported++;
          else if (result === 'updated') updated++;
          else skipped++;
        } catch (error) {
          console.error(`❌ Error importing tender ${tender.id}:`, error.message);
          skipped++;
        }
      }
      
      console.log(`✅ Import completed:`);
      console.log(`   - Imported: ${imported}`);
      console.log(`   - Updated: ${updated}`);
      console.log(`   - Skipped: ${skipped}`);
      
      return {
        success: true,
        total: tenders.length,
        imported,
        updated,
        skipped
      };
      
    } catch (error) {
      console.error('❌ EOP import failed:', error);
      throw error;
    }
  }

  /**
   * Import a single tender record
   */
  async importTender(tender) {
    const client = await pool.connect();
    
    try {
      // Check if tender already exists
      const existingQuery = 'SELECT id FROM eop_data WHERE eop_id = $1';
      const existingResult = await client.query(existingQuery, [tender.tenderId?.toString() || tender.id?.toString()]);
      
      const tenderData = this.mapTenderData(tender);
      
      if (existingResult.rows.length > 0) {
        // Update existing record
        const updateQuery = `
          UPDATE eop_data SET
            source_url = $2,
            title = $3,
            description = $4,
            status = $5,
            budget = $6,
            currency = $7,
            contractor = $8,
            contract_number = $9,
            awarding_type = $10,
            procurement_type = $11,
            cpv_code = $12,
            address = $13,
            settlement = $14,
            municipality = $15,
            lat = $16,
            lng = $17,
            start_date = $18,
            end_date = $19,
            publication_date = $20,
            raw_data = $21,
            updated_at = CURRENT_TIMESTAMP
          WHERE eop_id = $1
          RETURNING id
        `;
        
        await client.query(updateQuery, [
          tenderData.eop_id,
          tenderData.source_url,
          tenderData.title,
          tenderData.description,
          tenderData.status,
          tenderData.budget,
          tenderData.currency,
          tenderData.contractor,
          tenderData.contract_number,
          tenderData.awarding_type,
          tenderData.procurement_type,
          tenderData.cpv_code,
          tenderData.address,
          tenderData.settlement,
          tenderData.municipality,
          tenderData.lat,
          tenderData.lng,
          tenderData.start_date,
          tenderData.end_date,
          tenderData.publication_date,
          tenderData.raw_data
        ]);
        
        return 'updated';
      } else {
        // Insert new record
        const insertQuery = `
          INSERT INTO eop_data (
            eop_id, source_url, title, description, status, budget, currency,
            contractor, contract_number, awarding_type, procurement_type, cpv_code,
            address, settlement, municipality, lat, lng, start_date, end_date,
            publication_date, raw_data, fetched_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20, $21, CURRENT_TIMESTAMP
          )
          RETURNING id
        `;
        
        await client.query(insertQuery, [
          tenderData.eop_id,
          tenderData.source_url,
          tenderData.title,
          tenderData.description,
          tenderData.status,
          tenderData.budget,
          tenderData.currency,
          tenderData.contractor,
          tenderData.contract_number,
          tenderData.awarding_type,
          tenderData.procurement_type,
          tenderData.cpv_code,
          tenderData.address,
          tenderData.settlement,
          tenderData.municipality,
          tenderData.lat,
          tenderData.lng,
          tenderData.start_date,
          tenderData.end_date,
          tenderData.publication_date,
          tenderData.raw_data
        ]);
        
        return 'imported';
      }
    } finally {
      client.release();
    }
  }

  /**
   * Map tender JSON data to database fields
   */
  mapTenderData(tender) {
    return {
      eop_id: tender.tenderId?.toString() || tender.id?.toString() || null,
      source_url: tender.guid ? `https://app.eop.bg/tender/${tender.guid}` : null,
      title: tender.name || tender.title || null,
      description: this.cleanDescription(tender.description),
      status: this.mapStatus(tender.status),
      budget: null, // Not available in current JSON structure
      currency: 'BGN',
      contractor: null, // Not available in current JSON structure
      contract_number: tender.specialNumber || null,
      awarding_type: null,
      procurement_type: this.mapProcedureType(tender.procedureType),
      cpv_code: null,
      address: null,
      settlement: 'Стара Загора', // All tenders are from Stara Zagora
      municipality: 'Стара Загора',
      lat: null, // Could be geocoded later
      lng: null, // Could be geocoded later
      start_date: this.parseDate(tender.createdDate),
      end_date: this.parseDate(tender.deadline),
      publication_date: this.parseDate(tender.publishedDate),
      raw_data: JSON.stringify(tender)
    };
  }

  /**
   * Clean HTML from description
   */
  cleanDescription(description) {
    if (!description) return null;
    
    // Remove HTML tags and decode entities
    return description
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
      .replace(/&ldquo;/g, '"') // Replace left double quote
      .replace(/&rdquo;/g, '"') // Replace right double quote
      .replace(/&bdquo;/g, '"') // Replace bottom double quote
      .replace(/&amp;/g, '&') // Replace &amp; with &
      .replace(/&lt;/g, '<') // Replace &lt; with <
      .replace(/&gt;/g, '>') // Replace &gt; with >
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim()
      .substring(0, 5000); // Limit length
  }

  /**
   * Map status from number to string
   */
  mapStatus(statusCode) {
    const statusMap = {
      1: 'active',
      2: 'completed',
      3: 'cancelled',
      4: 'planned'
    };
    
    return statusMap[statusCode] || 'active';
  }

  /**
   * Map procedure type from number to string
   */
  mapProcedureType(procedureType) {
    const typeMap = {
      2: 'open_procedure',
      12: 'negotiated_procedure',
      13: 'competitive_dialogue',
      14: 'restricted_procedure',
      15: 'innovation_partnership',
      16: 'design_contest'
    };
    
    return typeMap[procedureType] || 'unknown';
  }

  /**
   * Parse ISO date string to PostgreSQL date
   */
  parseDate(dateString) {
    if (!dateString) return null;
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return null;
      
      return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
    } catch (error) {
      return null;
    }
  }

  /**
   * Clear all EOP data
   */
  async clearData() {
    try {
      const result = await pool.query('DELETE FROM eop_data');
      console.log(`🗑️ Cleared ${result.rowCount} EOP records`);
      return result.rowCount;
    } catch (error) {
      console.error('❌ Error clearing EOP data:', error);
      throw error;
    }
  }

  /**
   * Get import statistics
   */
  async getStats() {
    try {
      const result = await pool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN budget IS NOT NULL THEN 1 END) as with_budget,
          MIN(publication_date) as earliest_date,
          MAX(publication_date) as latest_date
        FROM eop_data
      `);
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Error getting EOP stats:', error);
      throw error;
    }
  }
}

module.exports = new EOPDataImporter();
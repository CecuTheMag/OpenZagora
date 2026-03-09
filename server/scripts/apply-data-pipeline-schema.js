#!/usr/bin/env node

/**
 * Apply Data Pipeline Schema
 * Ensures the data pipeline tables exist in the database
 */

const fs = require('fs').promises;
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function applySchema() {
  const client = await pool.connect();
  
  try {
    console.log('🔄 Applying data pipeline schema...');
    
    // Read the schema file
    const schemaPath = path.join(__dirname, '../db/data_pipeline_schema.sql');
    const schemaSQL = await fs.readFile(schemaPath, 'utf8');
    
    // Execute the schema
    await client.query(schemaSQL);
    
    console.log('✅ Data pipeline schema applied successfully!');
    
    // Verify tables exist
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('eop_data', 'osm_data', 'data_sources', 'scraper_logs')
      ORDER BY table_name
    `;
    
    const result = await client.query(tablesQuery);
    
    console.log('\n📋 Data pipeline tables:');
    result.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Check if eop_data table has the correct structure
    const columnsQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'eop_data'
      ORDER BY ordinal_position
    `;
    
    const columnsResult = await client.query(columnsQuery);
    
    if (columnsResult.rows.length > 0) {
      console.log('\n📊 eop_data table structure:');
      columnsResult.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} ${row.is_nullable === 'YES' ? '(nullable)' : '(not null)'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error applying schema:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await applySchema();
    console.log('\n🎉 Schema setup completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('💥 Schema setup failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
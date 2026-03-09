#!/usr/bin/env node

/**
 * Import EOP Data Script
 * Imports tender data from JSON file into the database
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const eopImporter = require('../services/eopDataImporter');

async function main() {
  try {
    console.log('🚀 Starting EOP data import process...');
    
    // Import data from JSON
    const result = await eopImporter.importFromJSON();
    
    if (result.success) {
      console.log('\n📊 Import Summary:');
      console.log(`   Total records processed: ${result.total}`);
      console.log(`   New records imported: ${result.imported}`);
      console.log(`   Existing records updated: ${result.updated}`);
      console.log(`   Records skipped: ${result.skipped}`);
      
      // Get final stats
      const stats = await eopImporter.getStats();
      console.log('\n📈 Database Statistics:');
      console.log(`   Total EOP records: ${stats.total}`);
      console.log(`   Active tenders: ${stats.active}`);
      console.log(`   Completed tenders: ${stats.completed}`);
      console.log(`   Date range: ${stats.earliest_date} to ${stats.latest_date}`);
      
      console.log('\n✅ EOP data import completed successfully!');
      process.exit(0);
    } else {
      console.error('❌ Import failed');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('💥 Import process failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
EOP Data Import Script

Usage: node import-eop-data.js [options]

Options:
  --help, -h     Show this help message
  --clear        Clear all existing EOP data before import
  --stats        Show current database statistics only

Examples:
  node import-eop-data.js                # Import data
  node import-eop-data.js --clear        # Clear and import
  node import-eop-data.js --stats        # Show stats only
`);
  process.exit(0);
}

if (args.includes('--stats')) {
  // Show stats only
  eopImporter.getStats()
    .then(stats => {
      console.log('📈 Current EOP Database Statistics:');
      console.log(`   Total records: ${stats.total}`);
      console.log(`   Active tenders: ${stats.active}`);
      console.log(`   Completed tenders: ${stats.completed}`);
      console.log(`   Records with budget: ${stats.with_budget}`);
      console.log(`   Date range: ${stats.earliest_date} to ${stats.latest_date}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('❌ Error getting stats:', error.message);
      process.exit(1);
    });
} else if (args.includes('--clear')) {
  // Clear and import
  console.log('🗑️ Clearing existing EOP data...');
  eopImporter.clearData()
    .then(() => main())
    .catch(error => {
      console.error('❌ Error clearing data:', error.message);
      process.exit(1);
    });
} else {
  // Normal import
  main();
}
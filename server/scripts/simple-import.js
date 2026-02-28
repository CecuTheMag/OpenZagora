/**
 * Simple Budget Data Import - Import only the best parsed files
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PARSED_DIR = path.join(__dirname, '..', 'parsed');

// Database connection
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'open_zagora',
  user: 'postgres',
  password: 'postgres'
});

async function importIncomeData(filename, data) {
  console.log(`📊 Importing income data from ${filename}`);
  
  if (!data.items || !Array.isArray(data.items)) {
    console.log(`   ❌ No items found`);
    return;
  }

  // Insert document metadata
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, document_subtype, parsed_data, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
  `, [
    filename,
    data.filename || filename,
    data.year || 2025,
    'income',
    'pr1',
    JSON.stringify(data),
    'parsed'
  ]);

  const documentId = docResult.rows[0].id;

  // Insert income items
  let inserted = 0;
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    
    if (!item.code || !item.amount || item.amount <= 0) continue;

    try {
      await pool.query(`
        INSERT INTO budget_income (document_id, year, code, name, amount, row_order)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        documentId,
        data.year || 2025,
        item.code,
        item.name || `Код ${item.code}`,
        item.amount,
        i
      ]);
      inserted++;
    } catch (err) {
      console.error(`   ❌ Error inserting item ${item.code}:`, err.message);
    }
  }

  console.log(`   ✅ Inserted ${inserted} income items`);
}

async function main() {
  console.log('🚀 Simple Budget Data Importer');
  console.log(`📁 Parsed directory: ${PARSED_DIR}`);
  
  try {
    // Clear existing data
    await pool.query('DELETE FROM budget_income WHERE year = 2025');
    await pool.query('DELETE FROM budget_documents WHERE year = 2025');
    
    // Import only the main income file
    const incomeFile = 'pr 1 prihodi  2025-main.json';
    const filePath = path.join(PARSED_DIR, incomeFile);
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      await importIncomeData(incomeFile, data);
    } else {
      console.log('❌ Main income file not found');
    }
    
    // Check results
    const result = await pool.query('SELECT COUNT(*) as count FROM budget_income WHERE year = 2025');
    console.log(`\n✅ Import completed! Inserted ${result.rows[0].count} income items`);
    
  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
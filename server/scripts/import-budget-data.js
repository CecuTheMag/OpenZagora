/**
 * Import Budget Data from Parsed JSON Files
 * Reads the parsed JSON files and inserts data into proper database tables
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const PARSED_DIR = path.join(__dirname, '..', 'parsed');

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'db',
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

  // First, insert document metadata
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

  // Delete existing income data for this document
  await pool.query('DELETE FROM budget_income WHERE document_id = $1', [documentId]);

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

async function importExpenseData(filename, data) {
  console.log(`📊 Importing expense data from ${filename}`);
  
  if (!data.items || !Array.isArray(data.items)) {
    console.log(`   ❌ No items found`);
    return;
  }

  // Insert document metadata
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, document_subtype, parsed_data, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (filename) DO UPDATE SET
      parsed_data = EXCLUDED.parsed_data,
      status = EXCLUDED.status
    RETURNING id
  `, [
    filename,
    data.filename || filename,
    data.year || 2025,
    'expense',
    'pr2',
    JSON.stringify(data),
    'parsed'
  ]);

  const documentId = docResult.rows[0].id;

  // Delete existing expense data for this document
  await pool.query('DELETE FROM budget_expenses WHERE document_id = $1', [documentId]);

  // Insert expense items
  let inserted = 0;
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    
    if (!item.code || !item.amount || item.amount <= 0) continue;

    try {
      await pool.query(`
        INSERT INTO budget_expenses (document_id, year, function_code, function_name, amount, row_order)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        documentId,
        data.year || 2025,
        item.code,
        item.name || `Функция ${item.code}`,
        item.amount,
        i
      ]);
      inserted++;
    } catch (err) {
      console.error(`   ❌ Error inserting item ${item.code}:`, err.message);
    }
  }

  console.log(`   ✅ Inserted ${inserted} expense items`);
}

async function importIndicatorData(filename, data) {
  console.log(`📊 Importing indicator data from ${filename}`);
  
  if (!data.items || !Array.isArray(data.items)) {
    console.log(`   ❌ No items found`);
    return;
  }

  // Extract indicator code from filename (e.g., "d122", "d332")
  const indicatorMatch = filename.match(/d(\d+)/i);
  const indicatorCode = indicatorMatch ? `d${indicatorMatch[1]}` : 'unknown';

  // Insert document metadata
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, document_subtype, parsed_data, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (filename) DO UPDATE SET
      parsed_data = EXCLUDED.parsed_data,
      status = EXCLUDED.status
    RETURNING id
  `, [
    filename,
    data.filename || filename,
    2025,
    'indicator',
    indicatorCode,
    JSON.stringify(data),
    'parsed'
  ]);

  const documentId = docResult.rows[0].id;

  // Delete existing indicator data for this document
  await pool.query('DELETE FROM budget_indicators WHERE document_id = $1', [documentId]);

  // Insert indicator items
  let inserted = 0;
  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    
    if (!item.code || !item.amount || item.amount <= 0) continue;

    try {
      await pool.query(`
        INSERT INTO budget_indicators (
          document_id, year, indicator_code, indicator_name, 
          department_code, department_name, amount_approved, row_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        documentId,
        2025,
        indicatorCode,
        data.projectName || data.activity?.name || `Индикатор ${indicatorCode}`,
        data.activity?.code || item.code,
        data.activity?.name || item.name,
        item.amount,
        i
      ]);
      inserted++;
    } catch (err) {
      console.error(`   ❌ Error inserting item ${item.code}:`, err.message);
    }
  }

  console.log(`   ✅ Inserted ${inserted} indicator items`);
}

async function importLoanData(filename, data) {
  console.log(`📊 Importing loan data from ${filename}`);
  
  if (!data.loans || !Array.isArray(data.loans)) {
    console.log(`   ❌ No loans found`);
    return;
  }

  // Extract loan type from filename
  let loanType = 'unknown';
  if (filename.includes('JESSICA')) loanType = 'JESSICA';
  else if (filename.includes('FLAG')) loanType = 'FLAG';
  else if (filename.includes('FUG')) loanType = 'FUG';
  else if (filename.includes('UBB')) loanType = 'UBB';

  // Insert document metadata
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, document_subtype, parsed_data, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (filename) DO UPDATE SET
      parsed_data = EXCLUDED.parsed_data,
      status = EXCLUDED.status
    RETURNING id
  `, [
    filename,
    data.filename || filename,
    2025,
    'loan',
    loanType,
    JSON.stringify(data),
    'parsed'
  ]);

  const documentId = docResult.rows[0].id;

  // Delete existing loan data for this document
  await pool.query('DELETE FROM budget_loans WHERE document_id = $1', [documentId]);

  // Insert loan items
  let inserted = 0;
  for (let i = 0; i < data.loans.length; i++) {
    const loan = data.loans[i];
    
    if (!loan.amount || loan.amount <= 0) continue;

    try {
      await pool.query(`
        INSERT INTO budget_loans (
          document_id, year, loan_type, loan_code, creditor, 
          original_amount, purpose, row_order
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        documentId,
        2025,
        loanType,
        filename,
        data.projectName || 'Unknown',
        loan.amount,
        loan.name || 'Loan purpose',
        i
      ]);
      inserted++;
    } catch (err) {
      console.error(`   ❌ Error inserting loan:`, err.message);
    }
  }

  console.log(`   ✅ Inserted ${inserted} loan items`);
}

async function processFile(filename) {
  const filePath = path.join(PARSED_DIR, filename);
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(content);
    
    console.log(`\n📄 Processing: ${filename}`);
    
    // Determine file type and process accordingly
    if (filename.includes('prihodi') || filename.includes('pr 1')) {
      await importIncomeData(filename, data);
    } else if (filename.includes('razhod') || filename.includes('pr 2')) {
      await importExpenseData(filename, data);
    } else if (filename.includes('indik') || filename.match(/d\d+/)) {
      await importIndicatorData(filename, data);
    } else if (filename.includes('ZAEM') || filename.includes('zaem')) {
      await importLoanData(filename, data);
    } else {
      console.log(`   ❓ Unknown file type, skipping`);
    }
    
  } catch (err) {
    console.error(`   ❌ Error processing ${filename}:`, err.message);
  }
}

async function main() {
  console.log('🚀 Budget Data Importer');
  console.log(`📁 Parsed directory: ${PARSED_DIR}`);
  
  try {
    // Ensure budget schema tables exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        filename VARCHAR(500) NOT NULL UNIQUE,
        original_name VARCHAR(500) NOT NULL,
        year INTEGER NOT NULL,
        document_type VARCHAR(50) NOT NULL,
        document_subtype VARCHAR(100),
        parsed_data JSONB,
        status VARCHAR(50) DEFAULT 'pending',
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = fs.readdirSync(PARSED_DIR)
      .filter(f => f.endsWith('.json'))
      .filter(f => f.includes('2025')) // Only 2025 files for now
      .sort();
    
    console.log(`\n📋 Found ${files.length} JSON files to process`);
    
    // Process income files first
    const incomeFiles = files.filter(f => f.includes('prihodi') || f.includes('pr 1'));
    console.log(`\n💰 Processing ${incomeFiles.length} income files...`);
    for (const file of incomeFiles) {
      await processFile(file);
    }
    
    // Process expense files
    const expenseFiles = files.filter(f => f.includes('razhod') || f.includes('pr 2'));
    console.log(`\n💸 Processing ${expenseFiles.length} expense files...`);
    for (const file of expenseFiles) {
      await processFile(file);
    }
    
    // Process indicator files
    const indicatorFiles = files.filter(f => f.includes('indik') && f.match(/d\d+/));
    console.log(`\n📊 Processing ${indicatorFiles.length} indicator files...`);
    for (const file of indicatorFiles) {
      await processFile(file);
    }
    
    // Process loan files
    const loanFiles = files.filter(f => f.includes('ZAEM') || f.includes('zaem'));
    console.log(`\n🏦 Processing ${loanFiles.length} loan files...`);
    for (const file of loanFiles) {
      await processFile(file);
    }
    
    console.log('\n✅ Import completed!');
    
    // Show summary
    const summary = await pool.query(`
      SELECT 
        document_type,
        COUNT(*) as doc_count,
        SUM(CASE WHEN document_type = 'income' THEN 
          (SELECT COUNT(*) FROM budget_income WHERE document_id = budget_documents.id)
        END) as income_items,
        SUM(CASE WHEN document_type = 'expense' THEN 
          (SELECT COUNT(*) FROM budget_expenses WHERE document_id = budget_documents.id)
        END) as expense_items,
        SUM(CASE WHEN document_type = 'indicator' THEN 
          (SELECT COUNT(*) FROM budget_indicators WHERE document_id = budget_documents.id)
        END) as indicator_items,
        SUM(CASE WHEN document_type = 'loan' THEN 
          (SELECT COUNT(*) FROM budget_loans WHERE document_id = budget_documents.id)
        END) as loan_items
      FROM budget_documents 
      WHERE year = 2025
      GROUP BY document_type
    `);
    
    console.log('\n📈 Import Summary:');
    summary.rows.forEach(row => {
      console.log(`   ${row.document_type}: ${row.doc_count} documents`);
    });
    
  } catch (err) {
    console.error('❌ Import failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
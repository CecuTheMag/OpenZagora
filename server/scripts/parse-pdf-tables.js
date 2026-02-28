/**
 * PDF Table Parser - Extract tables from budget PDFs directly to database
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');

const PDF_DIR = path.join(__dirname, '..', 'budget-pdfs');
const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'open_zagora',
  user: 'postgres',
  password: 'postgres'
});

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    console.error(`Error extracting ${pdfPath}:`, err.message);
    return '';
  }
}

function parseTableRows(text) {
  const lines = text.split('\n');
  const rows = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    
    // Skip headers
    if (trimmed.includes('№') || trimmed.includes('Наименование') || 
        trimmed.includes('Общо') || trimmed.includes('Всичко') ||
        trimmed.includes('Приложение') || trimmed.includes('стр.')) continue;
    
    // Look for any line with numbers - more flexible pattern
    const numberMatch = trimmed.match(/(\d[\d\s]{2,})/g);
    if (numberMatch) {
      // Extract the largest number as amount
      const amounts = numberMatch.map(n => parseInt(n.replace(/\s+/g, '')) || 0);
      const amount = Math.max(...amounts);
      
      if (amount > 100) { // Only significant amounts
        // Extract description (everything before first large number)
        let description = trimmed;
        for (const num of numberMatch) {
          const pos = description.indexOf(num);
          if (pos > 5) {
            description = description.substring(0, pos).trim();
            break;
          }
        }
        
        // Try to find code pattern
        const codeMatch = trimmed.match(/(\d{2}-\d{2,3})/);
        const code = codeMatch ? codeMatch[1] : `AUTO-${rows.length + 1}`;
        
        if (description.length > 3) {
          rows.push({ description, code, amount });
        }
      }
    }
  }
  
  return rows;
}

async function processPdf(filename) {
  const filePath = path.join(PDF_DIR, filename);
  console.log(`📄 Processing: ${filename}`);
  
  const text = extractPdfText(filePath);
  if (!text) return;
  
  const rows = parseTableRows(text);
  console.log(`   Found ${rows.length} table rows`);
  
  if (rows.length === 0) return;
  
  // Insert document
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, status)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [filename, filename, 2025, 'parsed_table', 'completed']);
  
  const docId = docResult.rows[0].id;
  
  // Insert rows based on file type
  let inserted = 0;
  for (const row of rows) {
    try {
      if (filename.includes('prihodi') || filename.includes('pr 1')) {
        await pool.query(`
          INSERT INTO budget_income (document_id, year, code, name, amount)
          VALUES ($1, $2, $3, $4, $5)
        `, [docId, 2025, row.code, row.description, row.amount]);
      } else if (filename.includes('razhod') || filename.includes('pr 2')) {
        await pool.query(`
          INSERT INTO budget_expenses (document_id, year, function_code, function_name, amount)
          VALUES ($1, $2, $3, $4, $5)
        `, [docId, 2025, row.code, row.description, row.amount]);
      } else {
        await pool.query(`
          INSERT INTO budget_indicators (document_id, year, indicator_code, indicator_name, amount_approved)
          VALUES ($1, $2, $3, $4, $5)
        `, [docId, 2025, row.code, row.description, row.amount]);
      }
      inserted++;
    } catch (err) {
      console.error(`   Error inserting ${row.code}:`, err.message);
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} rows`);
}

async function main() {
  console.log('🚀 PDF Table Parser');
  
  try {
    // Clear existing data
    await pool.query('DELETE FROM budget_income WHERE year = 2025');
    await pool.query('DELETE FROM budget_expenses WHERE year = 2025');
    await pool.query('DELETE FROM budget_indicators WHERE year = 2025');
    await pool.query('DELETE FROM budget_documents WHERE year = 2025');
    
    const files = fs.readdirSync(PDF_DIR)
      .filter(f => f.endsWith('.pdf'));
    
    console.log(`Processing ${files.length} PDF files...`);
    
    for (const file of files) {
      await processPdf(file);
    }
    
    // Show results
    const results = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM budget_income WHERE year = 2025) as income_count,
        (SELECT COUNT(*) FROM budget_expenses WHERE year = 2025) as expense_count,
        (SELECT COUNT(*) FROM budget_indicators WHERE year = 2025) as indicator_count
    `);
    
    console.log('\n📊 Results:');
    console.log(`   Income items: ${results.rows[0].income_count}`);
    console.log(`   Expense items: ${results.rows[0].expense_count}`);
    console.log(`   Indicator items: ${results.rows[0].indicator_count}`);
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
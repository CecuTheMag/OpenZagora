/**
 * Advanced PDF Table Parser - Extracts actual table structure from PDFs
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
    // Use -layout to preserve table structure
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    console.error(`Error extracting ${pdfPath}:`, err.message);
    return '';
  }
}

function parseTableData(text, filename) {
  const lines = text.split('\n');
  const rows = [];
  
  // Look for actual table patterns in Bulgarian budget documents
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 20) continue;
    
    // Skip obvious headers and footers
    if (line.includes('Приложение') || line.includes('стр.') || 
        line.includes('№№') || line.includes('Наименование') ||
        line.includes('ВСИЧКО') || line.includes('Общо за')) continue;
    
    // Look for lines with budget codes (XX-XX format) and amounts
    const codePattern = /(\d{2}-\d{2,3})/;
    const codeMatch = line.match(codePattern);
    
    if (codeMatch) {
      const code = codeMatch[1];
      
      // Extract amounts - look for numbers with spaces (Bulgarian format: 1 234 567)
      const amountPattern = /(\d{1,3}(?:\s\d{3})*)/g;
      const amounts = [];
      let match;
      
      while ((match = amountPattern.exec(line)) !== null) {
        const num = parseInt(match[1].replace(/\s/g, ''));
        if (num > 1000) { // Only significant amounts
          amounts.push(num);
        }
      }
      
      if (amounts.length > 0) {
        // Extract description - text before the code
        const codeIndex = line.indexOf(code);
        let description = line.substring(0, codeIndex).trim();
        
        // Clean up description
        description = description.replace(/^\d+\.?\s*/, ''); // Remove leading numbers
        description = description.replace(/\s+/g, ' '); // Normalize spaces
        
        if (description.length > 5 && description.length < 200) {
          rows.push({
            code: code,
            description: description,
            amount: Math.max(...amounts), // Take the largest amount
            source_file: filename
          });
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
  
  const rows = parseTableData(text, filename);
  console.log(`   Found ${rows.length} valid table rows`);
  
  if (rows.length === 0) return;
  
  // Show sample of what we found
  console.log(`   Sample: ${rows[0]?.description} (${rows[0]?.code}) = ${rows[0]?.amount?.toLocaleString()}`);
  
  // Insert document
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, status)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [filename, filename, 2025, 'table_parsed', 'completed']);
  
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
      console.error(`   Error inserting ${row.code}: ${err.message}`);
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} rows`);
}

async function main() {
  console.log('🚀 Advanced PDF Table Parser');
  
  try {
    // Clear existing data
    await pool.query('DELETE FROM budget_income WHERE year = 2025');
    await pool.query('DELETE FROM budget_expenses WHERE year = 2025');
    await pool.query('DELETE FROM budget_indicators WHERE year = 2025');
    await pool.query('DELETE FROM budget_documents WHERE year = 2025');
    
    // Process ALL files
    const files = fs.readdirSync(PDF_DIR)
      .filter(f => f.endsWith('.pdf'))
      .sort();
    
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
    
    // Show sample data
    const sampleIncome = await pool.query('SELECT code, name, amount FROM budget_income ORDER BY amount DESC LIMIT 3');
    const sampleExpense = await pool.query('SELECT function_code, function_name, amount FROM budget_expenses ORDER BY amount DESC LIMIT 3');
    
    console.log('\n💰 Top Income Items:');
    sampleIncome.rows.forEach(row => {
      console.log(`   ${row.code}: ${row.name} = ${parseInt(row.amount).toLocaleString()} лв`);
    });
    
    console.log('\n💸 Top Expense Items:');
    sampleExpense.rows.forEach(row => {
      console.log(`   ${row.function_code}: ${row.function_name} = ${parseInt(row.amount).toLocaleString()} лв`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
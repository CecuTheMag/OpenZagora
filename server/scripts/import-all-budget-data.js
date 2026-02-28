/**
 * Unified Budget Data Import Script
 * 
 * This script:
 * 1. Clears old data from the database
 * 2. Runs all parsers in sequence
 * 3. Displays final summary
 * 
 * Usage: node import-all-budget-data.js
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BUDGET_YEAR = 2025;
const PDF_DIR = path.join(__dirname, '..', 'budget-pdfs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres'
});

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    console.error(`   Error extracting text: ${err.message}`);
    return '';
  }
}

function parseIncomeData(text) {
  const lines = text.split('\n');
  const items = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 20) continue;
    
    // Skip headers
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || 
        trimmed.includes('Наименование') || trimmed.includes('ВСИЧКО')) continue;
    
    // Look for budget codes and amounts
    const codeMatch = trimmed.match(/(\d{2}-\d{2,3})/);
    if (codeMatch) {
      const code = codeMatch[1];
      const amountMatches = trimmed.match(/(\d{1,3}(?:\s\d{3})*)/g);
      
      if (amountMatches) {
        const amounts = amountMatches.map(a => parseInt(a.replace(/\s/g, ''))).filter(a => a > 1000);
        if (amounts.length > 0) {
          const codeIndex = trimmed.indexOf(code);
          let description = trimmed.substring(0, codeIndex).trim();
          description = description.replace(/^\d+\.?\s*/, '').replace(/\s+/g, ' ');
          
          if (description.length > 5 && description.length < 200) {
            items.push({
              code,
              description,
              amount: Math.max(...amounts)
            });
          }
        }
      }
    }
  }
  
  return items;
}

function parseExpenseData(text) {
  const lines = text.split('\n');
  const items = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 20) continue;
    
    // Skip headers and totals
    if (trimmed.includes('Приложение') || trimmed.includes('наименование') || 
        trimmed.includes('персонал') || trimmed.includes('издръжка') ||
        trimmed.includes('капиталови') || trimmed.includes('общо разходи') ||
        trimmed.includes('бюджет 2025') || trimmed.includes('Функция')) continue;
    
    // Look for department lines starting with "д. XXX"
    const deptMatch = trimmed.match(/^д\. (\d+) (.+?)\s+(\d[\d\s]*)/); 
    if (deptMatch) {
      const deptCode = deptMatch[1];
      const description = deptMatch[2].trim();
      
      const numbers = trimmed.match(/(\d{1,3}(?:\s\d{3})*)/g);
      if (numbers && numbers.length > 0) {
        const amount = parseInt(numbers[numbers.length - 1].replace(/\s/g, ''));
        
        if (amount > 10000) {
          let category = 'Други разходи';
          if (description.includes('администрация') || description.includes('съвет')) category = 'Общи държавни служби';
          else if (description.includes('образование') || description.includes('училищ') || description.includes('детски градини')) category = 'Образование';
          else if (description.includes('здрав')) category = 'Здравеопазване';
          else if (description.includes('култура') || description.includes('спорт') || description.includes('театр') || description.includes('музе')) category = 'Култура и спорт';
          else if (description.includes('социал')) category = 'Социално подпомагане';
          else if (description.includes('сигурност') || description.includes('полиц') || description.includes('отбрана')) category = 'Обществен ред';
          else if (description.includes('околна среда') || description.includes('екология') || description.includes('чистота')) category = 'Околна среда';
          else if (description.includes('икономич') || description.includes('стопанск') || description.includes('транспорт')) category = 'Икономически дейности';
          
          items.push({
            function_code: deptCode,
            description: description,
            category: category,
            amount: amount
          });
        }
      }
    }
    
    // Also look for function summary lines
    const funcMatch = trimmed.match(/Функция "(.+?)".*?(\d{1,3}(?:\s\d{3})*)\s*$/); 
    if (funcMatch) {
      const funcName = funcMatch[1];
      const amountStr = funcMatch[2];
      const amount = parseInt(amountStr.replace(/\s/g, ''));
      
      if (amount > 50000) {
        items.push({
          function_code: 'FUNC',
          description: funcName,
          category: funcName,
          amount: amount
        });
      }
    }
  }
  
  return items;
}

function parseIndicatorData(text, filename) {
  const lines = text.split('\n');
  const items = [];
  
  const indicatorMatch = filename.match(/d(\d+)/i);
  const indicatorCode = indicatorMatch ? `d${indicatorMatch[1]}` : 'unknown';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 15) continue;
    
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || 
        trimmed.includes('Наименование')) continue;
    
    const codeMatch = trimmed.match(/(\d{2}-\d{2,3})/);
    if (codeMatch) {
      const code = codeMatch[1];
      const amountMatches = trimmed.match(/(\d{1,3}(?:\s\d{3})*)/g);
      
      if (amountMatches) {
        const amounts = amountMatches.map(a => parseInt(a.replace(/\s/g, ''))).filter(a => a > 1000);
        if (amounts.length > 0) {
          const codeIndex = trimmed.indexOf(code);
          let description = trimmed.substring(0, codeIndex).trim();
          description = description.replace(/^\d+\.?\s*/, '').replace(/\s+/g, ' ');
          
          if (description.length > 5) {
            items.push({
              indicator_code: indicatorCode,
              code: code,
              description: description,
              amount_approved: Math.max(...amounts),
              amount_executed: amounts.length > 1 ? amounts[1] : null
            });
          }
        }
      }
    }
  }
  
  return items;
}

function parseVillageData(text) {
  const lines = text.split('\n');
  const villages = [];
  
  for (const line of lines) {
    const lineTrimmed = line.trim();
    
    if (!lineTrimmed || lineTrimmed.includes('Кметство') || lineTrimmed.includes('разходи за персонал')) continue;
    
    const match = lineTrimmed.match(/^(\d+)\s+(.+?)\s+(\d[\d\s]*)/); 
    if (match) {
      const code = match[1];
      const name = match[2].trim();
      
      const parts = lineTrimmed.split(/\s{2,}/).filter(p => p.trim());
      const numbers = [];
      
      for (let j = 2; j < parts.length; j++) {
        const num = parseFloat(parts[j].replace(/\s/g, ''));
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
      
      if (numbers.length >= 2) {
        villages.push({
          code: code,
          name: name,
          state_personnel: numbers[0] || 0,
          state_maintenance: numbers[1] || 0,
          local_total: numbers[numbers.length - 2],
          total_amount: numbers[numbers.length - 1]
        });
      }
    }
  }
  
  return villages;
}

function parseLoanData(text, filename) {
  let loanType = '';
  let originalAmount = 0;
  let remainingAmount = 0;
  let interestRate = 0;
  let purpose = '';
  
  if (filename.includes('JESSICA')) loanType = 'JESSICA';
  else if (filename.includes('FLAG')) loanType = 'FLAG';
  else if (filename.includes('FUG')) loanType = 'FUG';
  else if (filename.includes('UBB')) loanType = 'UBB';
  
  const originalMatch = text.match(/Размер на кредита:\s*([0-9\s]+)\s*лева/i);
  if (originalMatch) originalAmount = parseFloat(originalMatch[1].replace(/\s/g, ''));
  
  const remainingMatch = text.match(/Дълг към 01\.01\.2025[^:]*:\s*([0-9\s]+)\s*лева/i);
  if (remainingMatch) remainingAmount = parseFloat(remainingMatch[1].replace(/\s/g, ''));
  
  const interestMatch = text.match(/Лихвен процент[^0-9]*([0-9,\.]+)\s*%/i);
  if (interestMatch) interestRate = parseFloat(interestMatch[1].replace(',', '.'));
  
  if (text.includes('ЦЕНТРАЛЕН ПАЗАР')) purpose = 'Реконструкция централен пазар';
  else if (text.includes('УЧИЛИЩА')) purpose = 'Училищна инфраструктура';
  else if (text.includes('ТЕАТЪР')) purpose = 'Театрална инфраструктура';
  else if (text.includes('ZOO')) purpose = 'Зоопарк';
  
  if (originalAmount > 0) {
    return [{
      loan_type: loanType,
      loan_code: filename.replace('.pdf', ''),
      original_amount: originalAmount,
      remaining_amount: remainingAmount || originalAmount,
      interest_rate: interestRate,
      purpose: purpose || 'Инвестиционни проекти'
    }];
  }
  
  return [];
}

function parseForecastData(text) {
  const lines = text.split('\n');
  const forecasts = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed || trimmed.includes('НАИМЕНОВАНИЕ') || trimmed.includes('Прогноза')) continue;
    
    const match = trimmed.match(/^(\d{2}-\d{2})\s+(.+?)\s+(\d[\d\s,]*)/);
    if (match) {
      const code = match[1];
      const name = match[2].trim();
      
      const parts = trimmed.split(/\s{2,}/).filter(p => p.trim());
      const numbers = [];
      
      for (let i = 2; i < parts.length; i++) {
        const num = parseFloat(parts[i].replace(/\s/g, '').replace(',', ''));
        if (!isNaN(num)) numbers.push(num);
      }
      
      if (numbers.length >= 4) {
        forecasts.push({
          code: code,
          name: name,
          amount_2024: numbers[0] || 0,
          amount_2025: numbers[1] || 0,
          amount_2026: numbers[2] || 0,
          amount_2027: numbers[3] || 0,
          amount_2028: numbers[4] || 0
        });
      }
    }
  }
  
  return forecasts;
}

// ==========================================
// PARSER FUNCTIONS
// ==========================================

async function importIncome() {
  console.log('\n📥 Processing Income (pr 1)...');
  
  const pdfPath = path.join(PDF_DIR, 'pr 1 prihodi  2025.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.log('   ⚠️  File not found, skipping');
    return { count: 0, total: 0 };
  }
  
  const text = extractPdfText(pdfPath);
  const items = parseIncomeData(text);
  
  console.log(`   Found ${items.length} income items`);
  
  // Clear old data
  await pool.query('DELETE FROM budget_income WHERE year = $1', [BUDGET_YEAR]);
  
  // Insert document
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, status)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, ['pr 1 prihodi  2025.pdf', 'pr 1 prihodi  2025.pdf', BUDGET_YEAR, 'income', 'completed']);
  
  const docId = docResult.rows[0].id;
  
  // Insert items
  let inserted = 0;
  for (const item of items) {
    try {
      await pool.query(`
        INSERT INTO budget_income (document_id, year, code, name, amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [docId, BUDGET_YEAR, item.code, item.description, item.amount]);
      inserted++;
    } catch (err) {
      // Skip duplicates
    }
  }
  
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  console.log(`   ✅ Imported ${inserted} income items, total: ${total.toLocaleString()} лв`);
  
  return { count: inserted, total };
}

async function importExpenses() {
  console.log('\n📤 Processing Expenses (pr 2)...');
  
  const pdfPath = path.join(PDF_DIR, 'pr 2 razhod  2025.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.log('   ⚠️  File not found, skipping');
    return { count: 0, total: 0 };
  }
  
  const text = extractPdfText(pdfPath);
  const items = parseExpenseData(text);
  
  console.log(`   Found ${items.length} expense items`);
  
  // Clear old data
  await pool.query('DELETE FROM budget_expenses WHERE year = $1', [BUDGET_YEAR]);
  
  // Insert document
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, status)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, ['pr 2 razhod  2025.pdf', 'pr 2 razhod  2025.pdf', BUDGET_YEAR, 'expense', 'completed']);
  
  const docId = docResult.rows[0].id;
  
  // Insert items
  let inserted = 0;
  for (const item of items) {
    try {
      await pool.query(`
        INSERT INTO budget_expenses (document_id, year, function_code, function_name, amount, program_name)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [docId, BUDGET_YEAR, item.function_code, item.description, item.amount, item.category]);
      inserted++;
    } catch (err) {
      // Skip duplicates
    }
  }
  
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  console.log(`   ✅ Imported ${inserted} expense items, total: ${total.toLocaleString()} лв`);
  
  return { count: inserted, total };
}

async function importIndicators() {
  console.log('\n📊 Processing Indicators (pr 9-40)...');
  
  const files = fs.readdirSync(PDF_DIR)
    .filter(f => f.includes('indik') || f.match(/d\d+/i))
    .sort();
  
  console.log(`   Found ${files.length} indicator PDF files`);
  
  // Clear old data
  await pool.query('DELETE FROM budget_indicators WHERE year = $1', [BUDGET_YEAR]);
  
  let totalInserted = 0;
  let totalAmount = 0;
  
  for (const file of files) {
    const pdfPath = path.join(PDF_DIR, file);
    const text = extractPdfText(pdfPath);
    const items = parseIndicatorData(text, file);
    
    if (items.length === 0) continue;
    
    // Insert document
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, document_subtype, status)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [file, file, BUDGET_YEAR, 'indicator', file.replace('.pdf', ''), 'completed']);
    
    const docId = docResult.rows[0].id;
    
    // Insert items
    for (const item of items) {
      try {
        await pool.query(`
          INSERT INTO budget_indicators (document_id, year, indicator_code, indicator_name, amount_approved, amount_executed)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [docId, BUDGET_YEAR, item.indicator_code, item.description, item.amount_approved, item.amount_executed]);
        totalInserted++;
        totalAmount += item.amount_approved || 0;
      } catch (err) {
        // Skip duplicates
      }
    }
  }
  
  console.log(`   ✅ Imported ${totalInserted} indicator items, total: ${totalAmount.toLocaleString()} лв`);
  
  return { count: totalInserted, total: totalAmount };
}

async function importVillages() {
  console.log('\n🏘️ Processing Villages (pr 54)...');
  
  const pdfPath = path.join(PDF_DIR, 'pr 54 kmetstva-plan-2025.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.log('   ⚠️  File not found, skipping');
    return { count: 0, total: 0 };
  }
  
  const text = extractPdfText(pdfPath);
  const items = parseVillageData(text);
  
  console.log(`   Found ${items.length} village items`);
  
  // Clear old data
  await pool.query('DELETE FROM budget_villages WHERE year = $1', [BUDGET_YEAR]);
  
  // Insert document
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, status)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, ['pr 54 kmetstva-plan-2025.pdf', 'pr 54 kmetstva-plan-2025.pdf', BUDGET_YEAR, 'village', 'completed']);
  
  const docId = docResult.rows[0].id;
  
  // Insert items
  let inserted = 0;
  for (const item of items) {
    try {
      await pool.query(`
        INSERT INTO budget_villages (document_id, year, code, name, state_personnel, state_maintenance, local_total, total_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [docId, BUDGET_YEAR, item.code, item.name, item.state_personnel, item.state_maintenance, item.local_total, item.total_amount]);
      inserted++;
    } catch (err) {
      // Skip duplicates
    }
  }
  
  const total = items.reduce((sum, item) => sum + item.total_amount, 0);
  console.log(`   ✅ Imported ${inserted} village items, total: ${total.toLocaleString()} лв`);
  
  return { count: inserted, total };
}

async function importLoans() {
  console.log('\n💳 Processing Loans (pr 42-53)...');
  
  const files = fs.readdirSync(PDF_DIR)
    .filter(f => f.includes('ZAEM') || f.includes('Zaem') || f.includes('zaem'))
    .sort();
  
  console.log(`   Found ${files.length} loan PDF files`);
  
  // Clear old data
  await pool.query('DELETE FROM budget_loans WHERE year = $1', [BUDGET_YEAR]);
  
  let totalInserted = 0;
  let totalOriginal = 0;
  let totalRemaining = 0;
  
  for (const file of files) {
    const pdfPath = path.join(PDF_DIR, file);
    const text = extractPdfText(pdfPath);
    const items = parseLoanData(text, file);
    
    if (items.length === 0) continue;
    
    // Insert document
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [file, file, BUDGET_YEAR, 'loan', 'completed']);
    
    const docId = docResult.rows[0].id;
    
    // Insert items
    for (const item of items) {
      try {
        await pool.query(`
          INSERT INTO budget_loans (document_id, year, loan_type, loan_code, original_amount, remaining_amount, interest_rate, purpose)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [docId, BUDGET_YEAR, item.loan_type, item.loan_code, item.original_amount, item.remaining_amount, item.interest_rate, item.purpose]);
        totalInserted++;
        totalOriginal += item.original_amount || 0;
        totalRemaining += item.remaining_amount || 0;
      } catch (err) {
        // Skip duplicates
      }
    }
  }
  
  console.log(`   ✅ Imported ${totalInserted} loans`);
  console.log(`   Total original: ${totalOriginal.toLocaleString()} лв`);
  console.log(`   Total remaining: ${totalRemaining.toLocaleString()} лв`);
  
  return { count: totalInserted, total: totalOriginal, remaining: totalRemaining };
}

async function importForecasts() {
  console.log('\n📈 Processing Forecasts (pr 57)...');
  
  const pdfPath = path.join(PDF_DIR, 'Pr 57 Prognoza 2026-2028.pdf');
  if (!fs.existsSync(pdfPath)) {
    console.log('   ⚠️  File not found, skipping');
    return { count: 0, total2025: 0, total2026: 0 };
  }
  
  const text = extractPdfText(pdfPath);
  const items = parseForecastData(text);
  
  console.log(`   Found ${items.length} forecast items`);
  
  // Clear old data
  await pool.query('DELETE FROM budget_forecasts');
  
  // Insert document
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, status)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, ['Pr 57 Prognoza 2026-2028.pdf', 'Pr 57 Prognoza 2026-2028.pdf', BUDGET_YEAR, 'forecast', 'completed']);
  
  const docId = docResult.rows[0].id;
  
  // Insert items
  let inserted = 0;
  for (const item of items) {
    try {
      await pool.query(`
        INSERT INTO budget_forecasts (document_id, code, name, amount_2024, amount_2025, amount_2026, amount_2027, amount_2028)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [docId, item.code, item.name, item.amount_2024, item.amount_2025, item.amount_2026, item.amount_2027, item.amount_2028]);
      inserted++;
    } catch (err) {
      // Skip duplicates
    }
  }
  
  const total2025 = items.reduce((sum, item) => sum + item.amount_2025, 0);
  const total2026 = items.reduce((sum, item) => sum + item.amount_2026, 0);
  
  console.log(`   ✅ Imported ${inserted} forecast items`);
  console.log(`   2025 Total: ${total2025.toLocaleString()} лв`);
  console.log(`   2026 Forecast: ${total2026.toLocaleString()} лв`);
  
  return { count: inserted, total2025, total2026 };
}

// ==========================================
// MAIN FUNCTION
// ==========================================

async function main() {
  console.log('🚀 Open Zagora - Budget Data Import');
  console.log('=====================================');
  console.log(`Year: ${BUDGET_YEAR}`);
  console.log(`PDF Directory: ${PDF_DIR}`);
  
  try {
    // Test connection
    const client = await pool.connect();
    console.log('✅ Database connected');
    client.release();
    
    // Clear existing data for the year
    console.log('\n🧹 Clearing old budget data...');
    await pool.query('DELETE FROM budget_income WHERE year = $1', [BUDGET_YEAR]);
    await pool.query('DELETE FROM budget_expenses WHERE year = $1', [BUDGET_YEAR]);
    await pool.query('DELETE FROM budget_indicators WHERE year = $1', [BUDGET_YEAR]);
    await pool.query('DELETE FROM budget_loans WHERE year = $1', [BUDGET_YEAR]);
    await pool.query('DELETE FROM budget_villages WHERE year = $1', [BUDGET_YEAR]);
    await pool.query('DELETE FROM budget_forecasts');
    console.log('   ✅ Old data cleared');
    
    // Run all parsers
    const results = {
      income: await importIncome(),
      expenses: await importExpenses(),
      indicators: await importIndicators(),
      villages: await importVillages(),
      loans: await importLoans(),
      forecasts: await importForecasts()
    };
    
    // Final summary
    console.log('\n');
    console.log('═══════════════════════════════════════');
    console.log('📊 FINAL SUMMARY');
    console.log('═══════════════════════════════════════');
    console.log(`📥 Income:     ${results.income.count} items (${results.income.total.toLocaleString()} лв)`);
    console.log(`📤 Expenses:   ${results.expenses.count} items (${results.expenses.total.toLocaleString()} лв)`);
    console.log(`📊 Indicators:${results.indicators.count} items (${results.indicators.total.toLocaleString()} лв)`);
    console.log(`🏘️ Villages:   ${results.villages.count} items (${results.villages.total.toLocaleString()} лв)`);
    console.log(`💳 Loans:      ${results.loans.count} items (${results.loans.total.toLocaleString()} лв debt)`);
    console.log(`📈 Forecasts:  ${results.forecasts.count} items`);
    console.log('═══════════════════════════════════════');
    
    const grandTotal = results.income.total + results.expenses.total;
    console.log(`💰 Total Budget: ${grandTotal.toLocaleString()} лв`);
    console.log('═══════════════════════════════════════');
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
  } finally {
    await pool.end();
  }
}

main();

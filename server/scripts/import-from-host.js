/**
 * Host-based Budget Import Script
 * Runs on host machine with pdftotext available
 * Connects to Docker database
 */

const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const BUDGET_YEAR = 2025;
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
    const result = execSync(`pdftotext -layout "${pdfPath}" -`, { 
      encoding: 'utf8',
      timeout: 60000 
    });
    return result;
  } catch (err) {
    console.error(`   Error: ${err.message}`);
    return '';
  }
}

function parseIncomeData(text) {
  const lines = text.split('\n');
  const items = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 20) continue;
    
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || 
        trimmed.includes('Наименование') || trimmed.includes('ВСИЧКО')) continue;
    
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
            items.push({ code, description, amount: Math.max(...amounts) });
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
        trimmed.includes('делегирани') || trimmed.includes('местни') ||
        trimmed.includes('общо разходи') || trimmed.includes('бюджет 2025') ||
        trimmed.includes('Функция "') || trimmed.startsWith('Функция')) continue;
    
    // Match lines starting with "д. XXX" - expense items
    const deptMatch = trimmed.match(/^д\.\s*(\d+)\s+(.+)$/); 
    if (deptMatch) {
      const deptCode = deptMatch[1];
      const restOfLine = deptMatch[2];
      
      // Extract all numbers from the line
      const numbers = restOfLine.match(/(\d{1,3}(?:\s\d{3})*)/g);
      
      if (numbers && numbers.length > 0) {
        // The LAST number is usually the total (общо)
        const amount = parseInt(numbers[numbers.length - 1].replace(/\s/g, ''));
        
        // Get description - remove all numbers from the rest
        let description = restOfLine.replace(/(\d{1,3}(?:\s\d{3})*)/g, '').trim();
        
        if (amount > 10000 && description.length > 3) {
          items.push({ function_code: deptCode, description, amount });
        }
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
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || trimmed.includes('Наименование')) continue;
    
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
              code,
              description,
              amount_approved: Math.max(...amounts)
            });
          }
        }
      }
    }
  }
  return items;
}

function parseLoanData(text, filename) {
  let loanType = '';
  if (filename.includes('JESSICA')) loanType = 'JESSICA';
  else if (filename.includes('FLAG')) loanType = 'FLAG';
  else if (filename.includes('FUG')) loanType = 'FUG';
  else if (filename.includes('UBB')) loanType = 'UBB';
  
  const originalMatch = text.match(/Размер на кредита:\s*([0-9\s]+)\s*лева/i);
  const originalAmount = originalMatch ? parseFloat(originalMatch[1].replace(/\s/g, '')) : 0;
  
  const remainingMatch = text.match(/Дълг към 01\.01\.2025[^:]*:\s*([0-9\s]+)\s*лева/i);
  const remainingAmount = remainingMatch ? parseFloat(remainingMatch[1].replace(/\s/g, '')) : originalAmount;
  
  const interestMatch = text.match(/Лихвен процент[^0-9]*([0-9,\.]+)\s*%/i);
  const interestRate = interestMatch ? parseFloat(interestMatch[1].replace(',', '.')) : 0;
  
  if (originalAmount > 0) {
    return [{
      loan_type: loanType,
      loan_code: filename.replace('.pdf', ''),
      original_amount: originalAmount,
      remaining_amount: remainingAmount || originalAmount,
      interest_rate: interestRate,
      purpose: 'Инвестиционни проекти'
    }];
  }
  return [];
}

function parseVillageData(text) {
  const lines = text.split('\n');
  const villages = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes('Кметство') || trimmed.includes('разходи')) continue;
    
    const match = trimmed.match(/^(\d+)\s+(.+?)\s+(\d[\d\s]*)/); 
    if (match) {
      const code = match[1];
      const name = match[2].trim();
      const parts = trimmed.split(/\s{2,}/).filter(p => p.trim());
      const numbers = [];
      
      for (let j = 2; j < parts.length; j++) {
        const num = parseFloat(parts[j].replace(/\s/g, ''));
        if (!isNaN(num)) numbers.push(num);
      }
      
      if (numbers.length >= 2) {
        villages.push({
          code,
          name,
          total_amount: numbers[numbers.length - 1]
        });
      }
    }
  }
  return villages;
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
          code,
          name,
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

async function importData() {
  console.log('🚀 Starting Budget Import from Host...\n');
  
  // Clear old data
  console.log('🧹 Clearing old data...');
  await pool.query('DELETE FROM budget_income WHERE year = $1', [BUDGET_YEAR]);
  await pool.query('DELETE FROM budget_expenses WHERE year = $1', [BUDGET_YEAR]);
  await pool.query('DELETE FROM budget_indicators WHERE year = $1', [BUDGET_YEAR]);
  await pool.query('DELETE FROM budget_loans WHERE year = $1', [BUDGET_YEAR]);
  await pool.query('DELETE FROM budget_villages WHERE year = $1', [BUDGET_YEAR]);
  await pool.query('DELETE FROM budget_forecasts');
  await pool.query('DELETE FROM budget_documents WHERE year = $1', [BUDGET_YEAR]);
  console.log('   ✅ Cleared\n');
  
  // 1. Import Income (pr 1)
  console.log('📥 Processing Income (pr 1)...');
  const incomePdf = path.join(PDF_DIR, 'pr 1 prihodi  2025.pdf');
  if (fs.existsSync(incomePdf)) {
    const text = extractPdfText(incomePdf);
    const items = parseIncomeData(text);
    console.log(`   Found ${items.length} items`);
    
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, ['pr 1 prihodi  2025.pdf', 'pr 1 prihodi  2025.pdf', BUDGET_YEAR, 'income', 'completed']);
    
    for (const item of items) {
      await pool.query(`
        INSERT INTO budget_income (document_id, year, code, name, amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [docResult.rows[0].id, BUDGET_YEAR, item.code, item.description, item.amount]);
    }
    console.log(`   ✅ Imported ${items.length} income items`);
  }
  
  // 2. Import Expenses (pr 2)
  console.log('\n📤 Processing Expenses (pr 2)...');
  const expensePdf = path.join(PDF_DIR, 'pr 2 razhod  2025.pdf');
  if (fs.existsSync(expensePdf)) {
    const text = extractPdfText(expensePdf);
    const items = parseExpenseData(text);
    console.log(`   Found ${items.length} items`);
    
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, ['pr 2 razhod  2025.pdf', 'pr 2 razhod  2025.pdf', BUDGET_YEAR, 'expense', 'completed']);
    
    for (const item of items) {
      await pool.query(`
        INSERT INTO budget_expenses (document_id, year, function_code, function_name, amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [docResult.rows[0].id, BUDGET_YEAR, item.function_code, item.description, item.amount]);
    }
    console.log(`   ✅ Imported ${items.length} expense items`);
  }
  
  // 3. Import Indicators (pr 10-40)
  console.log('\n📊 Processing Indicators...');
  const indicatorFiles = fs.readdirSync(PDF_DIR).filter(f => f.includes('indik') || f.match(/d\d+/i));
  let totalIndicators = 0;
  
  for (const file of indicatorFiles) {
    const pdfPath = path.join(PDF_DIR, file);
    const text = extractPdfText(pdfPath);
    const items = parseIndicatorData(text, file);
    
    if (items.length === 0) continue;
    
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, document_subtype, status)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id
    `, [file, file, BUDGET_YEAR, 'indicator', file.replace('.pdf', ''), 'completed']);
    
    for (const item of items) {
      await pool.query(`
        INSERT INTO budget_indicators (document_id, year, indicator_code, indicator_name, amount_approved)
        VALUES ($1, $2, $3, $4, $5)
      `, [docResult.rows[0].id, BUDGET_YEAR, item.indicator_code, item.description, item.amount_approved]);
      totalIndicators++;
    }
  }
  console.log(`   ✅ Imported ${totalIndicators} indicator items`);
  
  // 4. Import Loans (pr 42-53)
  console.log('\n💳 Processing Loans...');
  const loanFiles = fs.readdirSync(PDF_DIR).filter(f => f.includes('ZAEM') || f.includes('Zaem'));
  let totalLoans = 0;
  
  for (const file of loanFiles) {
    const pdfPath = path.join(PDF_DIR, file);
    const text = extractPdfText(pdfPath);
    const items = parseLoanData(text, file);
    
    if (items.length === 0) continue;
    
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, [file, file, BUDGET_YEAR, 'loan', 'completed']);
    
    for (const item of items) {
      await pool.query(`
        INSERT INTO budget_loans (document_id, year, loan_type, loan_code, original_amount, remaining_amount, interest_rate, purpose)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [docResult.rows[0].id, BUDGET_YEAR, item.loan_type, item.loan_code, item.original_amount, item.remaining_amount, item.interest_rate, item.purpose]);
      totalLoans++;
    }
  }
  console.log(`   ✅ Imported ${totalLoans} loans`);
  
  // 5. Import Villages (pr 54)
  console.log('\n🏘️ Processing Villages...');
  const villagePdf = path.join(PDF_DIR, 'pr 54 kmetstva-plan-2025.pdf');
  if (fs.existsSync(villagePdf)) {
    const text = extractPdfText(villagePdf);
    const items = parseVillageData(text);
    console.log(`   Found ${items.length} villages`);
    
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, ['pr 54 kmetstva-plan-2025.pdf', 'pr 54 kmetstva-plan-2025.pdf', BUDGET_YEAR, 'village', 'completed']);
    
    for (const item of items) {
      await pool.query(`
        INSERT INTO budget_villages (document_id, year, code, name, total_amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [docResult.rows[0].id, BUDGET_YEAR, item.code, item.name, item.total_amount]);
    }
    console.log(`   ✅ Imported ${items.length} villages`);
  }
  
  // 6. Import Forecasts (pr 57)
  console.log('\n📈 Processing Forecasts...');
  const forecastPdf = path.join(PDF_DIR, 'Pr 57 Prognoza 2026-2028.pdf');
  if (fs.existsSync(forecastPdf)) {
    const text = extractPdfText(forecastPdf);
    const items = parseForecastData(text);
    console.log(`   Found ${items.length} forecasts`);
    
    const docResult = await pool.query(`
      INSERT INTO budget_documents (filename, original_name, year, document_type, status)
      VALUES ($1, $2, $3, $4, $5) RETURNING id
    `, ['Pr 57 Prognoza 2026-2028.pdf', 'Pr 57 Prognoza 2026-2028.pdf', BUDGET_YEAR, 'forecast', 'completed']);
    
    for (const item of items) {
      await pool.query(`
        INSERT INTO budget_forecasts (document_id, code, name, amount_2024, amount_2025, amount_2026, amount_2027, amount_2028)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [docResult.rows[0].id, item.code, item.name, item.amount_2024, item.amount_2025, item.amount_2026, item.amount_2027, item.amount_2028]);
    }
    console.log(`   ✅ Imported ${items.length} forecasts`);
  }
  
  // Final summary
  console.log('\n');
  console.log('═══════════════════════════════════════');
  console.log('📊 FINAL SUMMARY');
  console.log('═══════════════════════════════════════');
  
  const income = await pool.query('SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as t FROM budget_income WHERE year = $1', [BUDGET_YEAR]);
  const expenses = await pool.query('SELECT COUNT(*) as c, COALESCE(SUM(amount),0) as t FROM budget_expenses WHERE year = $1', [BUDGET_YEAR]);
  const indicators = await pool.query('SELECT COUNT(*) as c, COALESCE(SUM(amount_approved),0) as t FROM budget_indicators WHERE year = $1', [BUDGET_YEAR]);
  const loans = await pool.query('SELECT COUNT(*) as c, COALESCE(SUM(original_amount),0) as t FROM budget_loans WHERE year = $1', [BUDGET_YEAR]);
  const villages = await pool.query('SELECT COUNT(*) as c, COALESCE(SUM(total_amount),0) as t FROM budget_villages WHERE year = $1', [BUDGET_YEAR]);
  const forecasts = await pool.query('SELECT COUNT(*) as c FROM budget_forecasts');
  
  console.log(`📥 Income:     ${income.rows[0].c} items (${parseInt(income.rows[0].t).toLocaleString()} лв)`);
  console.log(`📤 Expenses:   ${expenses.rows[0].c} items (${parseInt(expenses.rows[0].t).toLocaleString()} лв)`);
  console.log(`📊 Indicators:${indicators.rows[0].c} items (${parseInt(indicators.rows[0].t).toLocaleString()} лв)`);
  console.log(`🏘️ Villages:   ${villages.rows[0].c} items (${parseInt(villages.rows[0].t).toLocaleString()} лв)`);
  console.log(`💳 Loans:      ${loans.rows[0].c} items (${parseInt(loans.rows[0].t).toLocaleString()} лв)`);
  console.log(`📈 Forecasts:  ${forecasts.rows[0].c} items`);
  console.log('═══════════════════════════════════════');
  
  await pool.end();
}

importData().catch(console.error);

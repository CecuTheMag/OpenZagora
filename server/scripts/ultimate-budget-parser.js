/**
 * Ultimate Budget Parser - Extracts complete budget data for dashboard
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Pool } = require('pg');

const PDF_DIR = path.join(__dirname, '..', 'budget-pdfs');
const pool = new Pool({
  host: 'db',
  port: 5432,
  database: 'open_zagora',
  user: 'postgres',
  password: 'postgres'
});

// Bulgarian budget categories mapping
const EXPENSE_CATEGORIES = {
  '01': 'Общи държавни служби',
  '02': 'Отбрана и сигурност', 
  '03': 'Обществен ред и безопасност',
  '04': 'Икономически дейности',
  '05': 'Опазване на околната среда',
  '06': 'Жилищно строителство',
  '07': 'Здравеопазване',
  '08': 'Почивно дело, култура и религия',
  '09': 'Образование',
  '10': 'Социално подпомагане'
};

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
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
      
      // Extract the rightmost number (total budget)
      const numbers = trimmed.match(/(\d{1,3}(?:\s\d{3})*)/g);
      if (numbers && numbers.length > 0) {
        // Take the last number which is usually the total
        const amount = parseInt(numbers[numbers.length - 1].replace(/\s/g, ''));
        
        if (amount > 10000) {
          // Map department to function category
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
  
  // Extract indicator code from filename
  const indicatorMatch = filename.match(/d(\d+)/i);
  const indicatorCode = indicatorMatch ? `d${indicatorMatch[1]}` : 'unknown';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 15) continue;
    
    // Skip headers
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || 
        trimmed.includes('Наименование')) continue;
    
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

async function processPdf(filename) {
  const filePath = path.join(PDF_DIR, filename);
  console.log(`📄 Processing: ${filename}`);
  
  const text = extractPdfText(filePath);
  if (!text) return;
  
  let items = [];
  let docType = 'other';
  
  // Determine document type and parse accordingly
  if (filename.includes('prihodi') || filename.includes('pr 1')) {
    items = parseIncomeData(text);
    docType = 'income';
  } else if (filename.includes('razhod') || filename.includes('pr 2')) {
    items = parseExpenseData(text);
    docType = 'expense';
  } else if (filename.includes('indik') || filename.match(/d\d+/)) {
    items = parseIndicatorData(text, filename);
    docType = 'indicator';
  }
  
  console.log(`   Found ${items.length} ${docType} items`);
  
  if (items.length === 0) return;
  
  // Show sample
  if (items[0]) {
    const sample = items[0];
    console.log(`   Sample: ${sample.description} = ${sample.amount?.toLocaleString() || sample.amount_approved?.toLocaleString()}`);
  }
  
  // Insert document
  const docResult = await pool.query(`
    INSERT INTO budget_documents (filename, original_name, year, document_type, status)
    VALUES ($1, $2, $3, $4, $5) RETURNING id
  `, [filename, filename, 2025, docType, 'completed']);
  
  const docId = docResult.rows[0].id;
  
  // Insert items based on type
  let inserted = 0;
  for (const item of items) {
    try {
      if (docType === 'income') {
        await pool.query(`
          INSERT INTO budget_income (document_id, year, code, name, amount)
          VALUES ($1, $2, $3, $4, $5)
        `, [docId, 2025, item.code, item.description, item.amount]);
      } else if (docType === 'expense') {
        await pool.query(`
          INSERT INTO budget_expenses (document_id, year, function_code, function_name, amount, program_name)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [docId, 2025, item.function_code, item.description, item.amount, item.category]);
      } else if (docType === 'indicator') {
        await pool.query(`
          INSERT INTO budget_indicators (document_id, year, indicator_code, indicator_name, amount_approved, amount_executed)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [docId, 2025, item.indicator_code, item.description, item.amount_approved, item.amount_executed]);
      }
      inserted++;
    } catch (err) {
      console.error(`   Error inserting: ${err.message}`);
    }
  }
  
  console.log(`   ✅ Inserted ${inserted} items`);
}

async function main() {
  console.log('🚀 Ultimate Budget Parser');
  
  try {
    // Clear existing data
    await pool.query('DELETE FROM budget_income WHERE year = 2025');
    await pool.query('DELETE FROM budget_expenses WHERE year = 2025');
    await pool.query('DELETE FROM budget_indicators WHERE year = 2025');
    await pool.query('DELETE FROM budget_documents WHERE year = 2025');
    
    // Process all PDFs
    const files = fs.readdirSync(PDF_DIR)
      .filter(f => f.endsWith('.pdf'))
      .sort();
    
    console.log(`Processing ${files.length} PDF files...`);
    
    for (const file of files) {
      await processPdf(file);
    }
    
    // Generate summary for dashboard
    const results = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM budget_income WHERE year = 2025) as income_count,
        (SELECT COUNT(*) FROM budget_expenses WHERE year = 2025) as expense_count,
        (SELECT COUNT(*) FROM budget_indicators WHERE year = 2025) as indicator_count,
        (SELECT SUM(amount) FROM budget_income WHERE year = 2025) as total_income,
        (SELECT SUM(amount) FROM budget_expenses WHERE year = 2025) as total_expenses
    `);
    
    const row = results.rows[0];
    console.log('\n📊 Final Results:');
    console.log(`   Income items: ${row.income_count} (Total: ${parseInt(row.total_income || 0).toLocaleString()} лв)`);
    console.log(`   Expense items: ${row.expense_count} (Total: ${parseInt(row.total_expenses || 0).toLocaleString()} лв)`);
    console.log(`   Indicator items: ${row.indicator_count}`);
    
    // Show top categories for dashboard
    console.log('\n💰 Top Income Categories:');
    const topIncome = await pool.query(`
      SELECT code, name, amount FROM budget_income 
      WHERE year = 2025 ORDER BY amount DESC LIMIT 5
    `);
    topIncome.rows.forEach(item => {
      console.log(`   ${item.code}: ${item.name.substring(0,50)}... = ${parseInt(item.amount).toLocaleString()} лв`);
    });
    
    console.log('\n💸 Top Expense Categories:');
    const topExpenses = await pool.query(`
      SELECT function_code, function_name, program_name, amount FROM budget_expenses 
      WHERE year = 2025 ORDER BY amount DESC LIMIT 5
    `);
    topExpenses.rows.forEach(item => {
      console.log(`   ${item.function_code}: ${item.program_name || item.function_name} = ${parseInt(item.amount).toLocaleString()} лв`);
    });
    
  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await pool.end();
  }
}

main();
const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  database: 'open_zagora',
  user: 'postgres',
  password: 'postgres'
});

function parseExpenseData(text) {
  const lines = text.split('\n');
  const expenses = [];
  
  let currentFunction = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip headers and empty lines
    if (!line || line.includes('наименование на функиите') || line.includes('за персонал')) continue;
    
    // Detect function headers (start with 'Функция')
    if (line.startsWith('Функция')) {
      currentFunction = line.replace(/^Функция\s*"?/, '').replace(/"$/, '').trim();
      continue;
    }
    
    // Parse expense lines (start with 'д.')
    if (line.startsWith('д.')) {
      const code = line.match(/^д\. \d+/)?.[0] || '';
      const name = line.replace(/^д\. \d+\s*/, '').trim();
      
      // Look at the next line for numbers
      const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';
      
      // Split by multiple spaces to get individual numbers
      const parts = nextLine.split(/\s{2,}/).filter(p => p.trim());
      const numbers = [];
      
      for (const part of parts) {
        const num = parseFloat(part.replace(/\s/g, ''));
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
      
      if (numbers.length > 0) {
        // The last number is always the grand total
        const grandTotal = numbers[numbers.length - 1];
        
        if (grandTotal > 0) {
          expenses.push({
            code: code,
            name: name,
            category: currentFunction || 'Неопределена',
            delegated_amount: 0, // Will calculate from structure
            local_amount: 0,     // Will calculate from structure
            cofinancing_amount: 0, // Will calculate from structure
            total_amount: grandTotal,
            year: 2025
          });
        }
      }
    }
  }
  
  return expenses;
}

async function importExpenses() {
  try {
    console.log('Parsing expense PDF...');
    const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'pr 2 razhod  2025.pdf');
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
      encoding: 'utf8',
      shell: true
    });
    
    const expenses = parseExpenseData(text);
    console.log(`Found ${expenses.length} expense items`);
    
    if (expenses.length === 0) {
      console.log('No expenses found');
      return;
    }
    
    // Clear existing expenses for 2025
    await pool.query('DELETE FROM budget_expenses WHERE year = 2025');
    
    // Insert expenses
    for (const expense of expenses) {
      await pool.query(`
        INSERT INTO budget_expenses (function_code, function_name, program_name, amount, year)
        VALUES ($1, $2, $3, $4, $5)
      `, [expense.code, expense.name, expense.category, expense.total_amount, expense.year]);
    }
    
    const total = expenses.reduce((sum, exp) => sum + exp.total_amount, 0);
    console.log(`✅ Imported ${expenses.length} expenses, total: ${total.toLocaleString()} лв`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

importExpenses();
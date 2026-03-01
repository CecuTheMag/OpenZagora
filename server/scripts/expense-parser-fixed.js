const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');

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
    const line = lines[i];
    
    // Extract function name
    if (line.includes('Функция')) {
      const match = line.match(/Функция\s*"(.+?)"/);  
      if (match) currentFunction = match[1].trim();
      continue;
    }
    
    // Parse department lines starting with "д. "
    if (line.match(/^д\.\s*\d+/)) {
      const deptMatch = line.match(/^д\.\s*(\d+)\s+(.+)/);
      if (!deptMatch) continue;
      
      const code = `д. ${deptMatch[1]}`;
      const name = deptMatch[2].trim();
      
      // Get next line with numbers
      if (i + 1 >= lines.length) continue;
      const nextLine = lines[i + 1];
      
      // Extract all numbers from next line
      const numbers = nextLine.match(/(\d+(?:\s\d{3})*)/g);
      if (!numbers || numbers.length === 0) continue;
      
      // Last number is the total
      const lastNum = numbers[numbers.length - 1].replace(/\s/g, '');
      const amount = parseFloat(lastNum);
      
      if (amount > 10000 && amount < 999999999) {
        expenses.push({
          code,
          name,
          category: currentFunction || 'Неопределена',
          amount,
          year: 2025
        });
      }
    }
  }
  
  return expenses;
}

async function importExpenses() {
  try {
    console.log('Parsing expense PDF...');
    const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'pr 2 razhod  2025.pdf');
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
    
    const expenses = parseExpenseData(text);
    console.log(`Found ${expenses.length} expense items`);
    
    if (expenses.length === 0) {
      console.log('No expenses found');
      return;
    }
    
    await pool.query('DELETE FROM budget_expenses WHERE year = 2025');
    
    for (const expense of expenses) {
      await pool.query(`
        INSERT INTO budget_expenses (function_code, function_name, program_name, amount, year)
        VALUES ($1, $2, $3, $4, $5)
      `, [expense.code, expense.name, expense.category, expense.amount, expense.year]);
    }
    
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    console.log(`✅ Imported ${expenses.length} expenses, total: ${total.toLocaleString()} лв`);
    
    // Show category breakdown
    const categories = {};
    expenses.forEach(e => {
      categories[e.category] = (categories[e.category] || 0) + e.amount;
    });
    
    console.log('\n📊 By Function:');
    Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, amt]) => {
        console.log(`   ${cat}: ${amt.toLocaleString()} лв`);
      });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

importExpenses();

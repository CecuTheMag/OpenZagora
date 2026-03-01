const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');

const pool = new Pool({
  host: process.env.DB_HOST || 'db',
  port: 5432,
  database: 'open_zagora',
  user: 'postgres',
  password: 'postgres'
});

// Map department codes to functions based on Bulgarian budget classification
const DEPT_TO_FUNCTION = {
  '117': 'Общи държавни служби',
  '122': 'Общи държавни служби',
  '123': 'Общи държавни служби',
  '139': 'Общи държавни служби',
  '239': 'Отбрана и сигурност',
  '282': 'Отбрана и сигурност',
  '283': 'Отбрана и сигурност',
  '284': 'Отбрана и сигурност',
  '285': 'Отбрана и сигурност',
  '311': 'Образование',
  '318': 'Образование',
  '322': 'Образование',
  '324': 'Образование',
  '326': 'Образование',
  '332': 'Образование',
  '333': 'Образование',
  '336': 'Образование',
  '337': 'Образование',
  '338': 'Образование',
  '359': 'Образование',
  '369': 'Образование',
  '389': 'Образование',
  '431': 'Здравеопазване',
  '437': 'Здравеопазване',
  '469': 'Здравеопазване',
  '511': 'Социално осигуряване',
  '521': 'Социално осигуряване',
  '529': 'Социално осигуряване',
  '532': 'Социално осигуряване',
  '538': 'Почивно дело, култура, религия',
  '540': 'Почивно дело, култура, религия',
  '604': 'Икономически дейности и услуги',
  '619': 'Икономически дейности и услуги',
  '621': 'Опазване на околната среда',
  '714': 'Икономически дейности и услуги',
  '746': 'Жилищно строителство',
  '752': 'Опазване на околната среда',
  '759': 'Икономически дейности и услуги',
  '849': 'Икономически дейности и услуги',
  '898': 'Икономически дейности и услуги'
};

function parseExpenseData(text) {
  const lines = text.split('\n');
  const expenses = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.match(/^д\.\s*\d+/)) {
      const deptMatch = line.match(/^д\.\s*(\d+)\s+(.+)/);
      if (!deptMatch) continue;
      
      const deptCode = deptMatch[1];
      const code = `д. ${deptCode}`;
      const name = deptMatch[2].trim();
      
      if (i + 1 >= lines.length) continue;
      const nextLine = lines[i + 1];
      
      const numbers = nextLine.match(/(\d+(?:\s\d{3})*)/g);
      if (!numbers || numbers.length === 0) continue;
      
      const lastNum = numbers[numbers.length - 1].replace(/\s/g, '');
      const amount = parseFloat(lastNum);
      
      if (amount > 10000 && amount < 999999999) {
        const category = DEPT_TO_FUNCTION[deptCode] || 'Други дейности';
        
        expenses.push({
          code,
          name,
          category,
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
    const pdfPath = path.join(__dirname, '..', 'uploads/b', 'pr 2 razhod  2025.pdf');
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

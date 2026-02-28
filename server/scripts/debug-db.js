const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function check() {
  const result = await pool.query(
    'SELECT code, name, amount FROM budget_income WHERE year = 2025 ORDER BY amount DESC LIMIT 5'
  );
  console.log('Income:');
  for (const row of result.rows) {
    console.log(`  ${row.code}: "${row.name}" - ${row.amount}`);
  }
  
  const result2 = await pool.query(
    'SELECT function_code, function_name, amount FROM budget_expenses WHERE year = 2025 ORDER BY amount DESC LIMIT 5'
  );
  console.log('\nExpenses:');
  for (const row of result2.rows) {
    console.log(`  ${row.function_code}: "${row.function_name}" - ${row.amount}`);
  }
  
  await pool.end();
}

check();

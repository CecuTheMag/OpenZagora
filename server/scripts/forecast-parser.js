const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'open_zagora',
  user: 'postgres',
  password: 'postgres'
});

function parseForecastData(text) {
  const lines = text.split('\n');
  const forecasts = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip headers and empty lines
    if (!trimmed || trimmed.includes('НАИМЕНОВАНИЕ') || trimmed.includes('Прогноза')) continue;
    
    // Parse forecast lines with amounts
    const match = trimmed.match(/^(\\d{2}-\\d{2})\\s+(.+?)\\s+(\\d[\\d\\s,]*)/);
    if (match) {
      const code = match[1];
      const name = match[2].trim();
      
      // Extract amounts by splitting on multiple spaces
      const parts = trimmed.split(/\\s{2,}/).filter(p => p.trim());
      const numbers = [];
      
      for (let i = 2; i < parts.length; i++) {
        const num = parseFloat(parts[i].replace(/\\s/g, ''));
        if (!isNaN(num)) numbers.push(num);
      }
      
      if (numbers.length >= 4) { // 2024, 2025, 2026, 2027, 2028
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

async function createForecastTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_forecasts (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20),
        name VARCHAR(500),
        amount_2024 DECIMAL(15,2) DEFAULT 0,
        amount_2025 DECIMAL(15,2) DEFAULT 0,
        amount_2026 DECIMAL(15,2) DEFAULT 0,
        amount_2027 DECIMAL(15,2) DEFAULT 0,
        amount_2028 DECIMAL(15,2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Forecast table ready');
  } catch (error) {
    console.error('Table creation error:', error.message);
  }
}

async function importForecasts() {
  try {
    await createForecastTable();
    
    console.log('Parsing forecast PDF...');
    const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'Pr 57 Prognoza 2026-2028.pdf');
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
      encoding: 'utf8',
      shell: '/bin/bash'
    });
    
    const forecasts = parseForecastData(text);
    console.log(`Found ${forecasts.length} forecast items`);
    
    if (forecasts.length === 0) {
      console.log('No forecast data found');
      return;
    }
    
    // Clear existing forecasts
    await pool.query('DELETE FROM budget_forecasts');
    
    // Insert forecasts
    for (const forecast of forecasts) {
      await pool.query(`
        INSERT INTO budget_forecasts (code, name, amount_2024, amount_2025, amount_2026, amount_2027, amount_2028)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [forecast.code, forecast.name, forecast.amount_2024, forecast.amount_2025, forecast.amount_2026, forecast.amount_2027, forecast.amount_2028]);
    }
    
    const total2025 = forecasts.reduce((sum, f) => sum + f.amount_2025, 0);
    const total2026 = forecasts.reduce((sum, f) => sum + f.amount_2026, 0);
    
    console.log(`✅ Imported ${forecasts.length} forecasts`);
    console.log(`2025 forecast: ${total2025.toLocaleString()} лв`);
    console.log(`2026 forecast: ${total2026.toLocaleString()} лв`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

importForecasts();
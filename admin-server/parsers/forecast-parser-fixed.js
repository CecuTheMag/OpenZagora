const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  host: process.env.MAIN_DB_HOST || process.env.DB_HOST || 'db',
  port: 5432,
  database: process.env.MAIN_DB_NAME || 'open_zagora',
  user: process.env.MAIN_DB_USER || 'postgres',
  password: process.env.MAIN_DB_PASSWORD || 'postgres'
});

function parseForecastData(text) {
  const lines = text.split('\n');
  const forecasts = [];
  
  for (const line of lines) {
    if (!line.trim() || line.includes('ПРОГНОЗА') || line.includes('НАИМЕНОВАНИЕ') || 
        line.includes('Бланка') || line.includes('§§') || line.includes('Годишен отчет')) continue;
    
    // Match XX-00 code at start, then capture name, then exactly 5 number groups
    // Use non-greedy match for name and be more specific about number boundaries
    const match = line.match(/^\s*(\d{2}-00)\s+(.+?)\s+(\d+(?:\s+\d+)*)\s+(\d+(?:\s+\d+)*)\s+(\d+(?:\s+\d+)*)\s+(\d+(?:\s+\d+)*)\s+(\d+(?:\s+\d+)*)\s*$/);
    if (!match) continue;
    
    const code = match[1];
    const name = match[2].trim().replace(/\s*:\s*$/, '');
    
    // Clean and parse amounts - take only the first continuous number sequence
    const amounts = [];
    for (let i = 3; i <= 7; i++) {
      const numStr = match[i].trim();
      // Split by multiple spaces to get individual numbers
      const nums = numStr.split(/\s{2,}/);
      const cleaned = nums[0].replace(/\s/g, '');
      amounts.push(parseFloat(cleaned) || 0);
    }
    
    if (amounts.length === 5 && amounts[1] > 0 && amounts[1] < 10000000000) {
      forecasts.push({
        code,
        name,
        amount_2024: amounts[0],
        amount_2025: amounts[1],
        amount_2026: amounts[2],
        amount_2027: amounts[3],
        amount_2028: amounts[4]
      });
    }
  }
  
  return forecasts;
}

async function importForecasts() {
  try {
    console.log('Parsing forecast PDF...');
    const allFiles = fs.readdirSync(path.join(__dirname, '..', 'uploads'));
    const files = allFiles.filter(f => f.includes('Prognoza') && f.includes('2026'));
    
    // Remove duplicates
    const uniqueFiles = [];
    const seen = new Set();
    for (const f of files) {
      const cleanName = f.replace(/^admin-\d+-\d+-/, '');
      if (!seen.has(cleanName)) {
        seen.add(cleanName);
        uniqueFiles.push(f);
      }
    }
    
    if (uniqueFiles.length === 0) {
      console.log('No forecast PDF found');
      return;
    }
    
    const pdfPath = path.join(__dirname, '..', 'uploads', uniqueFiles[0]);
    console.log(`Found: ${uniqueFiles[0]}`);
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
    
    const forecasts = parseForecastData(text);
    console.log(`Found ${forecasts.length} forecast items`);
    
    if (forecasts.length === 0) {
      console.log('No forecast data found');
      return;
    }
    
    await pool.query('DELETE FROM budget_forecasts');
    
    for (const forecast of forecasts) {
      try {
        const existing = await pool.query(
          'SELECT id FROM budget_forecasts WHERE code = $1 AND name = $2 AND amount_2025 = $3',
          [forecast.code, forecast.name, forecast.amount_2025]
        );
        if (existing.rows.length === 0) {
          await pool.query(`
            INSERT INTO budget_forecasts (code, name, amount_2024, amount_2025, amount_2026, amount_2027, amount_2028)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [forecast.code, forecast.name, forecast.amount_2024, forecast.amount_2025, forecast.amount_2026, forecast.amount_2027, forecast.amount_2028]);
        }
      } catch (err) {
        // Skip duplicates
      }
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

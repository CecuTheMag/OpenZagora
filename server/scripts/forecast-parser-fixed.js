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

function parseForecastData(text) {
  const lines = text.split('\n');
  const forecasts = [];
  
  for (const line of lines) {
    // Match lines with budget codes and 5 numbers
    const match = line.match(/(\d{2}-\d{2})\s+(.+?)\s+(\d[\d\s,]+)\s+(\d[\d\s,]+)\s+(\d[\d\s,]+)\s+(\d[\d\s,]+)\s+(\d[\d\s,]+)/);
    if (match) {
      const code = match[1];
      const name = match[2].trim();
      const nums = [match[3], match[4], match[5], match[6], match[7]].map(n => {
        const cleaned = n.replace(/[\s,]/g, '');
        return cleaned.length > 12 ? 0 : parseFloat(cleaned);
      });
      
      if (nums[1] > 0) {
        forecasts.push({
          code,
          name,
          amount_2024: nums[0],
          amount_2025: nums[1],
          amount_2026: nums[2],
          amount_2027: nums[3],
          amount_2028: nums[4]
        });
      }
    }
  }
  
  return forecasts;
}

async function importForecasts() {
  try {
    console.log('Parsing forecast PDF...');
    const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'Pr 57 Prognoza 2026-2028.pdf');
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
    
    const forecasts = parseForecastData(text);
    console.log(`Found ${forecasts.length} forecast items`);
    
    if (forecasts.length === 0) {
      console.log('No forecast data found');
      return;
    }
    
    await pool.query('DELETE FROM budget_forecasts');
    
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

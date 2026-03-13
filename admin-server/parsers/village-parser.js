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

function parseVillageData(text) {
  const lines = text.split('\n');
  const villages = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip headers and empty lines
    if (!line || line.includes('Кметство') || line.includes('разходи за персонал')) continue;
    
    // Parse village lines (start with number)
    const match = line.match(/^(\d+)\s+(.+?)\s+(\d[\d\s]*)/); 
    if (match) {
      const code = match[1];
      const name = match[2].trim();
      
      // Split the line by multiple spaces to get individual numbers
      const parts = line.split(/\s{2,}/).filter(p => p.trim());
      const numbers = [];
      
      // Extract numbers from each part
      for (let j = 2; j < parts.length; j++) { // Skip code and name
        const num = parseFloat(parts[j].replace(/\s/g, ''));
        if (!isNaN(num)) {
          numbers.push(num);
        }
      }
      
      if (numbers.length >= 2) {
        const grandTotal = numbers[numbers.length - 1]; // Last number is total
        const localTotal = numbers[numbers.length - 2]; // Second to last is local total
        
        villages.push({
          code: code,
          name: name,
          state_personnel: numbers[0] || 0,
          state_maintenance: numbers[1] || 0,
          local_total: localTotal,
          total_amount: grandTotal,
          year: 2025
        });
      }
    }
  }
  
  return villages;
}

async function createVillageTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS budget_villages (
        id SERIAL PRIMARY KEY,
        code VARCHAR(10),
        name VARCHAR(255),
        state_personnel DECIMAL(15,2) DEFAULT 0,
        state_maintenance DECIMAL(15,2) DEFAULT 0,
        local_total DECIMAL(15,2) DEFAULT 0,
        total_amount DECIMAL(15,2) DEFAULT 0,
        year INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Village budget table ready');
  } catch (error) {
    console.error('Table creation error:', error.message);
  }
}

async function importVillages() {
  try {
    await createVillageTable();
    
    console.log('Parsing village budget PDF...');
    const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'pr 54 kmetstva-plan-2025.pdf');
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
      encoding: 'utf8',
      shell: '/bin/bash'
    });
    
    const villages = parseVillageData(text);
    console.log(`Found ${villages.length} village budgets`);
    
    if (villages.length === 0) {
      console.log('No village data found');
      return;
    }
    
    // Clear existing village data for 2025
    await pool.query('DELETE FROM budget_villages WHERE year = 2025');
    
    // Insert villages
    for (const village of villages) {
      await pool.query(`
        INSERT INTO budget_villages (code, name, state_personnel, state_maintenance, local_total, total_amount, year)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [village.code, village.name, village.state_personnel, village.state_maintenance, village.local_total, village.total_amount, village.year]);
    }
    
    const total = villages.reduce((sum, v) => sum + v.total_amount, 0);
    console.log(`✅ Imported ${villages.length} villages, total: ${total.toLocaleString()} лв`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

importVillages();
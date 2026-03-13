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

function parseLoanData(text, filename) {
  let loanType = '';
  let creditor = '';
  let originalAmount = 0;
  let remainingAmount = 0;
  let interestRate = 0;
  let purpose = '';
  
  // Extract loan type and creditor from filename
  if (filename.includes('JESSICA')) {
    loanType = 'JESSICA';
    creditor = 'JESSICA Fund';
  } else if (filename.includes('FLAG')) {
    loanType = 'FLAG';
    creditor = 'First Investment Bank (Fibank)';
  } else if (filename.includes('FUG')) {
    loanType = 'FUG';
    creditor = 'Fund for Urban Development (FUG)';
  } else if (filename.includes('UBB')) {
    loanType = 'UBB';
    creditor = 'United Bulgarian Bank (UBB)';
  }
  
  // Extract amounts using simpler patterns
  const originalMatch = text.match(/Размер на кредита:\s*([0-9\s]+)\s*лева/i);
  if (originalMatch) originalAmount = parseFloat(originalMatch[1].replace(/\s/g, ''));
  
  const remainingMatch = text.match(/Дълг към 01\.01\.2025[^:]*:\s*([0-9\s]+)\s*лева/i);
  if (remainingMatch) remainingAmount = parseFloat(remainingMatch[1].replace(/\s/g, ''));
  
  const interestMatch = text.match(/Лихвен процент[^0-9]*([0-9,\.]+)\s*%/i);
  if (interestMatch) interestRate = parseFloat(interestMatch[1].replace(',', '.'));
  
  // Extract purpose
  if (text.includes('ЦЕНТРАЛЕН ПАЗАР')) purpose = 'Реконструкция централен пазар';
  else if (text.includes('УЧИЛИЩА')) purpose = 'Училищна инфраструктура';
  else if (text.includes('ТЕАТЪР')) purpose = 'Театрална инфраструктура';
  else if (text.includes('ZOO')) purpose = 'Зоопарк';
  
  if (originalAmount > 0) {
    return [{
      loan_type: loanType,
      loan_code: filename.replace('.pdf', ''),
      creditor: creditor,
      original_amount: originalAmount,
      remaining_amount: remainingAmount || originalAmount,
      interest_rate: interestRate,
      purpose: purpose || 'Инвестиционни проекти',
      year: 2025
    }];
  }
  
  return [];
}

async function importLoans() {
  try {
    console.log('Parsing loan PDFs...');
    
    const allFiles = fs.readdirSync(path.join(__dirname, '..', 'uploads'));
    const loanFiles = allFiles.filter(f => f.includes('ZAEM'));
    
    // Remove duplicates
    const uniqueFiles = [];
    const seen = new Set();
    for (const f of loanFiles) {
      const cleanName = f.replace(/^admin-\d+-\d+-/, '');
      if (!seen.has(cleanName)) {
        seen.add(cleanName);
        uniqueFiles.push(f);
      }
    }
    
    console.log(`Found ${uniqueFiles.length} unique loan files`);
    
    let allLoans = [];
    
    for (const file of uniqueFiles) {
      try {
        const pdfPath = path.join(__dirname, '..', 'uploads', file);
        const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
          encoding: 'utf8',
          shell: '/bin/bash'
        });
        
        const loans = parseLoanData(text, file);
        allLoans = allLoans.concat(loans);
        console.log(`${file}: ${loans.length} loans`);
      } catch (error) {
        console.log(`Skipped ${file}: ${error.message}`);
      }
    }
    
    if (allLoans.length === 0) {
      console.log('No loan data found');
      return;
    }
    
    // Clear existing loans for 2025
    await pool.query('DELETE FROM budget_loans WHERE year = 2025');
    
    // Insert loans
    for (const loan of allLoans) {
      try {
        const existing = await pool.query(
          'SELECT id FROM budget_loans WHERE year = $1 AND loan_type = $2 AND loan_code = $3 AND original_amount = $4',
          [loan.year, loan.loan_type, loan.loan_code.substring(0, 100), loan.original_amount]
        );
        if (existing.rows.length === 0) {
          await pool.query(`
            INSERT INTO budget_loans (loan_type, loan_code, creditor, original_amount, remaining_amount, interest_rate, purpose, year)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [loan.loan_type, loan.loan_code.substring(0, 100), loan.creditor, loan.original_amount, loan.remaining_amount, loan.interest_rate, loan.purpose.substring(0, 255), loan.year]);
        }
      } catch (err) {
        console.log(`Skipped duplicate: ${loan.loan_type}`);
      }
    }
    
    const totalOriginal = allLoans.reduce((sum, loan) => sum + loan.original_amount, 0);
    const totalRemaining = allLoans.reduce((sum, loan) => sum + loan.remaining_amount, 0);
    
    console.log(`✅ Imported ${allLoans.length} loans`);
    console.log(`Total original: ${totalOriginal.toLocaleString()} лв`);
    console.log(`Total remaining: ${totalRemaining.toLocaleString()} лв`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

importLoans();
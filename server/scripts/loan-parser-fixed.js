const { Pool } = require('pg');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'open_zagora',
  user: 'postgres',
  password: 'postgres'
});

function parseLoanData(text, filename) {
  let loanType = '';
  let originalAmount = 0;
  let remainingAmount = 0;
  let interestRate = 0;
  let purpose = '';
  
  // Extract loan type from filename
  if (filename.includes('JESSICA')) loanType = 'JESSICA';
  else if (filename.includes('FLAG')) loanType = 'FLAG';
  else if (filename.includes('FUG')) loanType = 'FUG';
  else if (filename.includes('UBB')) loanType = 'UBB';
  
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
    
    const loanFiles = fs.readdirSync(path.join(__dirname, '..', 'budget-pdfs'))
      .filter(f => f.includes('ZAEM'));
    
    console.log(`Found ${loanFiles.length} loan files`);
    
    let allLoans = [];
    
    for (const file of loanFiles) {
      try {
        const pdfPath = path.join(__dirname, '..', 'budget-pdfs', file);
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
      await pool.query(`
        INSERT INTO budget_loans (loan_type, loan_code, original_amount, remaining_amount, interest_rate, purpose, year)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [loan.loan_type, loan.loan_code, loan.original_amount, loan.remaining_amount, loan.interest_rate, loan.purpose, loan.year]);
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
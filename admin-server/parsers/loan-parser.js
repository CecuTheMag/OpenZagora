const { execSync } = require('child_process');

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    return '';
  }
}

function parseLoans(pdfPath, pool, filename) {
  const text = extractPdfText(pdfPath);
  
  let loanType = '';
  let originalAmount = 0;
  let remainingAmount = 0;
  let interestRate = 0;
  let purpose = '';
  
  if (filename.includes('JESSICA')) loanType = 'JESSICA';
  else if (filename.includes('FLAG')) loanType = 'FLAG';
  else if (filename.includes('FUG')) loanType = 'FUG';
  else if (filename.includes('UBB')) loanType = 'UBB';
  
  const originalMatch = text.match(/Размер на кредита:\s*([0-9\s]+)\s*лева/i);
  if (originalMatch) originalAmount = parseFloat(originalMatch[1].replace(/\s/g, ''));
  
  const remainingMatch = text.match(/Дълг към 01\.01\.2025[^:]*:\s*([0-9\s]+)\s*лева/i);
  if (remainingMatch) remainingAmount = parseFloat(remainingMatch[1].replace(/\s/g, ''));
  
  const interestMatch = text.match(/Лихвен процент[^0-9]*([0-9,\.]+)\s*%/i);
  if (interestMatch) interestRate = parseFloat(interestMatch[1].replace(',', '.'));
  
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

module.exports = { parseLoans };

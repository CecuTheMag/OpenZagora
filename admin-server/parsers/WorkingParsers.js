const { execSync } = require('child_process');
const path = require('path');

// Department to function mapping from working parser
const DEPT_TO_FUNCTION = {
  '117': 'Общи държавни служби', '122': 'Общи държавни служби', '123': 'Общи държавни служби', '139': 'Общи държавни служби',
  '239': 'Отбрана и сигурност', '282': 'Отбрана и сигурност', '283': 'Отбрана и сигурност', '284': 'Отбрана и сигурност', '285': 'Отбрана и сигурност',
  '311': 'Образование', '318': 'Образование', '322': 'Образование', '324': 'Образование', '326': 'Образование', '332': 'Образование', '333': 'Образование', '336': 'Образование', '337': 'Образование', '338': 'Образование', '359': 'Образование', '369': 'Образование', '389': 'Образование',
  '431': 'Здравеопазване', '437': 'Здравеопазване', '469': 'Здравеопазване',
  '511': 'Социално осигуряване', '521': 'Социално осигуряване', '529': 'Социално осигуряване', '532': 'Социално осигуряване',
  '538': 'Почивно дело, култура, религия', '540': 'Почивно дело, култура, религия',
  '604': 'Икономически дейности и услуги', '619': 'Икономически дейности и услуги', '714': 'Икономически дейности и услуги', '759': 'Икономически дейности и услуги', '849': 'Икономически дейности и услуги', '898': 'Икономически дейности и услуги',
  '621': 'Опазване на околната среда', '752': 'Опазване на околната среда',
  '746': 'Жилищно строителство'
};

function parseIncome(text) {
  const lines = text.split('\n');
  const items = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 20) continue;
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || trimmed.includes('Наименование') || trimmed.includes('ВСИЧКО')) continue;
    
    const codeMatch = trimmed.match(/(\d{2}-\d{2,3})/);
    if (codeMatch) {
      const code = codeMatch[1];
      const amountMatches = trimmed.match(/(\d{1,3}(?:\s\d{3})*)/g);
      
      if (amountMatches) {
        const amounts = amountMatches.map(a => parseInt(a.replace(/\s/g, ''))).filter(a => a > 1000);
        if (amounts.length > 0) {
          const codeIndex = trimmed.indexOf(code);
          let description = trimmed.substring(0, codeIndex).trim();
          description = description.replace(/^\d+\.?\s*/, '').replace(/\s+/g, ' ');
          
          if (description.length > 5 && description.length < 200) {
            items.push({ code, name: description, amount: Math.max(...amounts) });
          }
        }
      }
    }
  }
  
  return items;
}

function parseExpenses(text) {
  const lines = text.split('\n');
  const expenses = [];
  let currentFunction = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line.includes('Функция')) {
      const match = line.match(/Функция\s*"(.+?)"/);
      if (match) currentFunction = match[1].trim();
      continue;
    }
    
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
        expenses.push({ code, name, category, amount });
      }
    }
  }
  
  return expenses;
}

function parseVillages(text) {
  const lines = text.split('\n');
  const villages = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.includes('Кметство') || line.includes('разходи за персонал')) continue;
    
    const match = line.match(/^(\d+)\s+(.+?)\s+(\d[\d\s]*)/);
    if (match) {
      const code = match[1];
      const name = match[2].trim();
      const parts = line.split(/\s{2,}/).filter(p => p.trim());
      const numbers = [];
      
      for (let j = 2; j < parts.length; j++) {
        const num = parseFloat(parts[j].replace(/\s/g, ''));
        if (!isNaN(num)) numbers.push(num);
      }
      
      if (numbers.length >= 2) {
        const grandTotal = numbers[numbers.length - 1];
        const localTotal = numbers[numbers.length - 2];
        
        villages.push({
          code,
          name,
          state_personnel: numbers[0] || 0,
          state_maintenance: numbers[1] || 0,
          local_total: localTotal,
          total_amount: grandTotal
        });
      }
    }
  }
  
  return villages;
}

function parseLoans(text, filename) {
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
      purpose: purpose || 'Инвестиционни проекти'
    }];
  }
  
  return [];
}

function parseForecasts(text) {
  const lines = text.split('\n');
  const forecasts = [];
  
  for (const line of lines) {
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

function parseIndicators(text, filename) {
  const lines = text.split('\n');
  const items = [];
  const indicatorMatch = filename.match(/d(\d+)/i);
  const indicatorCode = indicatorMatch ? `d${indicatorMatch[1]}` : 'unknown';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 15) continue;
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || trimmed.includes('Наименование')) continue;
    
    const codeMatch = trimmed.match(/(\d{2}-\d{2,3})/);
    if (codeMatch) {
      const code = codeMatch[1];
      const amountMatches = trimmed.match(/(\d{1,3}(?:\s\d{3})*)/g);
      
      if (amountMatches) {
        const amounts = amountMatches.map(a => parseInt(a.replace(/\s/g, ''))).filter(a => a > 1000);
        if (amounts.length > 0) {
          const codeIndex = trimmed.indexOf(code);
          let description = trimmed.substring(0, codeIndex).trim();
          description = description.replace(/^\d+\.?\s*/, '').replace(/\s+/g, ' ');
          
          if (description.length > 5) {
            items.push({
              indicator_code: indicatorCode,
              code: code,
              indicator_name: description,
              amount_approved: Math.max(...amounts),
              amount_executed: amounts.length > 1 ? amounts[1] : null
            });
          }
        }
      }
    }
  }
  
  return items;
}

module.exports = {
  parseIncome,
  parseExpenses,
  parseVillages,
  parseLoans,
  parseForecasts,
  parseIndicators
};

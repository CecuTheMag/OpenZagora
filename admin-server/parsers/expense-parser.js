const { execSync } = require('child_process');

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

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    return '';
  }
}

function parseExpenses(pdfPath, pool) {
  const text = extractPdfText(pdfPath);
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
          function_code: code,
          function_name: name,
          program_name: category,
          amount,
          year: 2025
        });
      }
    }
  }
  
  return expenses;
}

module.exports = { parseExpenses };

const { execSync } = require('child_process');

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    return '';
  }
}

function parseVillages(pdfPath, pool) {
  const text = extractPdfText(pdfPath);
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
        if (!isNaN(num)) {
          numbers.push(num);
        }
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
          total_amount: grandTotal,
          year: 2025
        });
      }
    }
  }
  
  return villages;
}

module.exports = { parseVillages };

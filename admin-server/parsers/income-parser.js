const { execSync } = require('child_process');

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    return '';
  }
}

function parseIncome(pdfPath, pool) {
  const text = extractPdfText(pdfPath);
  const lines = text.split('\n');
  const items = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 20) continue;
    
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || 
        trimmed.includes('Наименование') || trimmed.includes('ВСИЧКО')) continue;
    
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
            items.push({
              code,
              name: description,
              amount: Math.max(...amounts),
              year: 2025
            });
          }
        }
      }
    }
  }
  
  return items;
}

module.exports = { parseIncome };

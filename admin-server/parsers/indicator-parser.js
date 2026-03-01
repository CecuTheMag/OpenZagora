const { execSync } = require('child_process');

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    return '';
  }
}

function parseIndicators(pdfPath, pool, filename) {
  const text = extractPdfText(pdfPath);
  const lines = text.split('\n');
  const items = [];
  
  const indicatorMatch = filename.match(/d(\d+)/i);
  const indicatorCode = indicatorMatch ? `d${indicatorMatch[1]}` : 'unknown';
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 15) continue;
    
    if (trimmed.includes('Приложение') || trimmed.includes('№№') || 
        trimmed.includes('Наименование')) continue;
    
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
              indicator_name: description,
              amount_approved: Math.max(...amounts),
              amount_executed: amounts.length > 1 ? amounts[1] : null,
              year: 2025
            });
          }
        }
      }
    }
  }
  
  return items;
}

module.exports = { parseIndicators };

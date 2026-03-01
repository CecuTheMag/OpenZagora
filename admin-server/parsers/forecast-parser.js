const { execSync } = require('child_process');

function extractPdfText(pdfPath) {
  try {
    return execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
  } catch (err) {
    return '';
  }
}

function parseForecasts(pdfPath, pool) {
  const text = extractPdfText(pdfPath);
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

module.exports = { parseForecasts };

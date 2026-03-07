const { execSync } = require('child_process');
const path = require('path');

const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'pr 2 razhod  2025.pdf');
const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
  encoding: 'utf8',
  shell: '/bin/bash'
});

const lines = text.split('\n');

console.log('=== EXPENSE LINES WITH CONTEXT ===');
lines.forEach((line, i) => {
  if (line.trim().startsWith('д.')) {
    console.log(`\n--- Line ${i+1}: ${line}`);
    console.log(`--- Next line ${i+2}: ${lines[i+1] || 'N/A'}`);
    console.log(`--- Next+1 line ${i+3}: ${lines[i+2] || 'N/A'}`);
    
    // Extract numbers from next line
    const nextLine = lines[i+1] || '';
    const numbers = nextLine.match(/\d[\d\s,]*/g)?.map(n => parseFloat(n.replace(/\s/g, ''))) || [];
    console.log(`--- Numbers found: ${numbers.join(', ')}`);
  }
});
const { execSync } = require('child_process');
const path = require('path');

const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'pr 2 razhod  2025.pdf');
const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
  encoding: 'utf8',
  shell: '/bin/bash'
});

console.log('=== FIRST 100 LINES ===');
const lines = text.split('\n');
lines.slice(0, 100).forEach((line, i) => {
  console.log(`${i+1}: ${line}`);
});

console.log('\n=== LINES WITH "д." ===');
lines.forEach((line, i) => {
  if (line.includes('д.')) {
    console.log(`${i+1}: ${line}`);
  }
});
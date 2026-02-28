const { execSync } = require('child_process');
const path = require('path');

const pdfPath = path.join(__dirname, '..', 'budget-pdfs', 'pr 54 kmetstva-plan-2025.pdf');
const text = execSync(`pdftotext -layout "${pdfPath}" -`, { 
  encoding: 'utf8',
  shell: '/bin/bash'
});

const lines = text.split('\n');

console.log('=== FIRST 30 LINES ===');
lines.slice(0, 30).forEach((line, i) => {
  console.log(`${i+1}: ${line}`);
});

console.log('\n=== LINES WITH NUMBERS ===');
lines.forEach((line, i) => {
  const match = line.match(/^(\d+)\s+(.+)/);
  if (match) {
    console.log(`${i+1}: ${line}`);
  }
});
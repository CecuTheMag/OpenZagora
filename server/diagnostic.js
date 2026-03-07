// Simple diagnostic for file route
const fs = require('fs');
const path = require('path');

console.log('=== File Route Diagnostic ===');

// Test file existence
const testFile = 'Pr 40 indik razcheti-2025-d898.pdf';
const budgetDir = path.join(__dirname, 'budget-pdfs');
const filePath = path.join(budgetDir, testFile);

console.log('Budget directory:', budgetDir);
console.log('Budget dir exists:', fs.existsSync(budgetDir));
console.log('Test file path:', filePath);
console.log('Test file exists:', fs.existsSync(filePath));

// Test URL encoding/decoding
const encoded = encodeURIComponent(testFile);
const decoded = decodeURIComponent(encoded);

console.log('\nURL Encoding Test:');
console.log('Original:', testFile);
console.log('Encoded:', encoded);
console.log('Decoded:', decoded);
console.log('Match:', testFile === decoded);

// List some files
if (fs.existsSync(budgetDir)) {
  const files = fs.readdirSync(budgetDir).slice(0, 5);
  console.log('\nFirst 5 PDF files:');
  files.forEach(file => console.log('-', file));
}

console.log('\n=== Route Logic Test ===');

// Simulate the route logic
function testRoute(filename) {
  const decodedFilename = decodeURIComponent(filename);
  const possiblePaths = [
    path.join(__dirname, 'uploads', decodedFilename),
    path.join(__dirname, 'budget-pdfs', decodedFilename),
    path.join(__dirname, 'parsed', decodedFilename)
  ];
  
  let foundPath = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      foundPath = testPath;
      break;
    }
  }
  
  return { decodedFilename, foundPath, possiblePaths };
}

const result = testRoute(encoded);
console.log('Decoded filename:', result.decodedFilename);
console.log('Found path:', result.foundPath);
console.log('Search success:', !!result.foundPath);
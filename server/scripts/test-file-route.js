const fs = require('fs');
const path = require('path');

// Test the file serving logic
const filename = 'Pr 40 indik razcheti-2025-d898.pdf';
const decodedFilename = decodeURIComponent('Pr%2040%20indik%20razcheti-2025-d898.pdf');

console.log('Original filename:', filename);
console.log('URL encoded:', encodeURIComponent(filename));
console.log('Decoded from URL:', decodedFilename);

const possiblePaths = [
  path.join(__dirname, '..', 'uploads', filename),
  path.join(__dirname, '..', 'budget-pdfs', filename),
  path.join(__dirname, '..', 'parsed', filename)
];

console.log('\nChecking paths:');
possiblePaths.forEach((testPath, i) => {
  const exists = fs.existsSync(testPath);
  console.log(`${i+1}. ${exists ? '✅' : '❌'} ${testPath}`);
});

// Test with decoded filename too
const possiblePathsDecoded = [
  path.join(__dirname, '..', 'uploads', decodedFilename),
  path.join(__dirname, '..', 'budget-pdfs', decodedFilename),
  path.join(__dirname, '..', 'parsed', decodedFilename)
];

console.log('\nChecking decoded paths:');
possiblePathsDecoded.forEach((testPath, i) => {
  const exists = fs.existsSync(testPath);
  console.log(`${i+1}. ${exists ? '✅' : '❌'} ${testPath}`);
});
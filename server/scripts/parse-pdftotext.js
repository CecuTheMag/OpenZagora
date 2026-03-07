/**
 * Budget PDF Parser using pdftotext - extracts ACTUAL names from PDFs
 * Run: node scripts/parse-pdftotext.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUDGET_DIR = '/home/king/Documents/GitHub/OpenZagora/server/budget-pdfs';
const PARSED_DIR = '/home/king/Documents/GitHub/OpenZagora/server/parsed';

if (!fs.existsSync(PARSED_DIR)) {
  fs.mkdirSync(PARSED_DIR, { recursive: true });
}

/**
 * Extract text using pdftotext
 */
function extractText(pdfPath) {
  try {
    const text = execSync(`pdftotext -layout "${pdfPath}" -`, { encoding: 'utf8' });
    return text;
  } catch (err) {
    console.error(`   ❌ Error extracting text: ${err.message}`);
    return '';
  }
}

/**
 * Parse a number string like "2 321 957" into integer 2321957
 */
function parseNumber(str) {
  if (!str) return 0;
  // Remove spaces and any non-digit characters
  const cleaned = str.replace(/\s+/g, '').replace(/[^\d]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Extract project name from indicator PDF
 */
function extractProjectName(text) {
  // Look for "Име на проекта : <name>"
  const match = text.match(/Име на проекта\s*:\s*([^\n]+)/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract function code and name
 */
function extractFunction(text) {
  const match = text.match(/Функция\s*:\s*(\d+)?\s*([^\n]+)/);
  if (match) {
    return {
      code: match[1] || null,
      name: match[2].trim()
    };
  }
  return null;
}

/**
 * Extract activity/department code and name  
 */
function extractActivity(text) {
  const match = text.match(/Дейност\s*:\s*(\d+)?\s*([^\n]+)/);
  if (match) {
    return {
      code: match[1] || null,
      name: match[2].trim()
    };
  }
  return null;
}

/**
 * Parse indicator PDF - extract all line items with actual names
 */
function parseIndicatorPDF(text, filename) {
  const items = [];
  const lines = text.split('\n');
  
  let projectName = extractProjectName(text);
  let functionInfo = extractFunction(text);
  let activityInfo = extractActivity(text);
  
  // Pattern: name (with spaces) + code-XX + number(s)
  // Example: "Трансфери м/у бюдж. и см/ки за ср-вата от ЕС (нето)          62-00    2 321 957               2 321 957"
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.length < 10) continue;
    
    // Skip headers and totals
    if (line.includes('№ на §§') || line.includes('Общо') || 
        line.includes('Всичко') || line.includes('Приложение') ||
        line.includes('Приходи') || line.includes('Разходи')) {
      continue;
    }
    
    // Look for code pattern XX-XXX anywhere in line, followed by spaces and numbers
    // Capture the FIRST number after the code (the "Общо" / Total column)
    const codeMatch = line.match(/(\d{2}-\d{3})\s+([\d\s]{1,20})/);
    
    if (codeMatch) {
      const code = codeMatch[1];
      const numberStr = codeMatch[2].trim();
      const amount = parseNumber(numberStr);
      
      // Extract name - everything before the code
      let name = line.substring(0, line.indexOf(code)).trim();
      // Clean up name - remove trailing spaces/dots
      name = name.replace(/[\s\.\-]+$/, '').trim();
      
      // Skip if name is too short or looks like a header
      if (name.length < 3) continue;
      if (name.includes('§') || name.includes('Наименование')) continue;
      
      if (name && amount > 0) {
        items.push({
          code,
          name: name,
          amount,
          source: numberStr
        });
      }
    }
  }
  
  return {
    filename,
    projectName,
    function: functionInfo,
    activity: activityInfo,
    items,
    parsedAt: new Date().toISOString()
  };
}

/**
 * Parse loan PDF - simpler extraction
 */
function parseLoanPDF(text, filename) {
  const items = [];
  const lines = text.split('\n');
  
  // Extract project name
  let projectName = null;
  const projectMatch = text.match(/Проект\s*[:\-]?\s*([^\n]+)/i) || 
                      text.match(/Име\s*[:\-]?\s*([^\n]+)/i);
  if (projectMatch) {
    projectName = projectMatch[1].trim();
  }
  
  // Look for lines with amounts
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 5) continue;
    
    // Skip headers
    if (trimmed.includes('№') || trimmed.includes('Наименование') || 
        trimmed.includes('Сума') || trimmed.includes('Размер')) {
      continue;
    }
    
    // Look for large numbers (loan amounts are usually > 10000)
    const amountMatch = trimmed.match(/\d{1,2}\s?\d{3}\s?\d{3}/);
    if (amountMatch) {
      const amount = parseNumber(amountMatch[0]);
      if (amount > 10000) {
        // Extract name from the beginning of the line
        let name = trimmed.replace(amountMatch[0], '').trim();
        name = name.replace(/[\s\.\-]+$/, '').trim();
        
        if (name.length > 3) {
          items.push({
            name: name.substring(0, 100),
            amount
          });
        }
      }
    }
  }
  
  return {
    filename,
    projectName,
    loans: items,
    parsedAt: new Date().toISOString()
  };
}

async function processFile(filename) {
  const filePath = path.join(BUDGET_DIR, filename);
  console.log(`\n📄 Processing: ${filename}`);
  
  const text = extractText(filePath);
  if (!text) {
    console.log(`   ❌ No text extracted`);
    return;
  }
  
  console.log(`   📝 Extracted ${text.length} characters`);
  
  let result;
  const lower = filename.toLowerCase();
  
  if (lower.includes('indik') || lower.includes('d122') || 
      lower.includes('d332') || lower.includes('d369')) {
    result = parseIndicatorPDF(text, filename);
    console.log(`   📋 Type: Indicator`);
    console.log(`   🏢 Project: ${result.projectName || 'N/A'}`);
    if (result.activity) {
      console.log(`   🏛 Activity: ${result.activity.code} ${result.activity.name}`);
    }
    console.log(`   📊 Found ${result.items.length} items`);
  } else if (lower.includes('zaem') || lower.includes('jessica') || 
             lower.includes('flag') || lower.includes('ubb')) {
    result = parseLoanPDF(text, filename);
    console.log(`   📋 Type: Loan`);
    console.log(`   🏢 Project: ${result.projectName || 'N/A'}`);
    console.log(`   📊 Found ${result.loans.length} loans`);
  } else {
    console.log(`   ❌ Unknown document type`);
    return;
  }
  
  // Show sample items
  if (result.items && result.items.length > 0) {
    console.log(`   Sample items:`);
    result.items.slice(0, 3).forEach(item => {
      console.log(`      ${item.code}: ${item.name.substring(0,50)} = ${item.amount.toLocaleString()}`);
    });
  }
  
  if (result.loans && result.loans.length > 0) {
    console.log(`   Sample loans:`);
    result.loans.slice(0, 3).forEach(item => {
      console.log(`      ${item.name.substring(0,50)} = ${item.amount.toLocaleString()}`);
    });
  }
  
  // Save
  const outputPath = path.join(PARSED_DIR, filename.replace('.pdf', '-pdftotext.json'));
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
  console.log(`   💾 Saved: ${path.basename(outputPath)}`);
}

async function main() {
  console.log('🚀 Budget PDF Parser - pdftotext version');
  console.log(`📁 PDF directory: ${BUDGET_DIR}`);
  console.log(`📁 Output directory: ${PARSED_DIR}`);
  
  const files = fs.readdirSync(BUDGET_DIR)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .sort();
  
  console.log(`\n📋 Found ${files.length} PDF files`);
  
  // Process all indicator files
  const indicatorFiles = files.filter(f => 
    f.toLowerCase().includes('indik') || 
    f.match(/d\d{3}/i)
  );
  
  // Process all loan files  
  const loanFiles = files.filter(f => 
    f.toLowerCase().includes('zaem') ||
    f.toLowerCase().includes('jessica') ||
    f.toLowerCase().includes('flag') ||
    f.toLowerCase().includes('ubb')
  );
  
  console.log(`\n📊 Indicator files: ${indicatorFiles.length}`);
  console.log(`📊 Loan files: ${loanFiles.length}`);
  
  // Process indicators
  for (const file of indicatorFiles) {
    await processFile(file);
  }
  
  // Process loans
  for (const file of loanFiles) {
    await processFile(file);
  }
  
  console.log('\n✅ Done!');
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});

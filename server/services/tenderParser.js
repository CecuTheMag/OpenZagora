/**
 * Tender Parser Service
 * Parses tenders from the Python fetch_tenders.py script
 * and integrates them into the database
 * 
 * This service:
 * 1. Runs the Python script to fetch fresh tender data
 * 2. Parses the JSON output
 * 3. Filters for infrastructure-related tenders only
 * 4. Stores new tenders in the database
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dbService = require('./dbService');
const geocoderService = require('./geocoderService');

// Keywords to INCLUDE (infrastructure-related)
const INCLUDE_KEYWORDS = [
  // Construction & Renovation
  'смр', 'строителств', 'ремонт', 'реконструкц', 'модернизац', 'изграждане',
  'възстановяв', 'преустройств', 'разширени',
  
  // Energy efficiency
  'енергийн', 'топлоизолац', 'енергийна ефективност',
  
  // Infrastructure
  'инфраструктур', 'път', 'улиц', 'мост', 'канализац', 'водоснабдяван',
  'осветлен', 'паркинг', 'благоустройств',
  
  // Public buildings
  'училище', 'болница', 'детска градина', 'ясла', 'социалн', 'култур',
  'музей', 'театър', 'спортн', 'библиотек', 'администрац',
  
  // Environment
  'парк', 'озеленяв', 'зелена площ', 'екологич',
  
  // Buildings
  'сграда', 'жилищн', 'покрив', 'фасад', 'дограм',
  
  // EU funded projects
  'европейск', 'есф', 'оперативн програма', 'нпу',
  
  // Engineering
  'инженеринг', 'проектиран', 'авторски надзор', 'строителен надзор'
];

// Keywords to EXCLUDE
const EXCLUDE_KEYWORDS = [
  // Food & Supplies
  'хранителн', 'продукт', 'хранене', 'кухн', 'фураж', 'зърн',
  'млекопреработка', 'месо', 'плод', 'зеленчук',
  
  // Clothing & Personal items
  'облекло', 'работно облекло', 'униформа', 'обувк',
  
  // Office supplies
  'канцеларск', 'офис оборудван', 'мебели', 'персонален компют',
  'консуматив', 'хартия',
  
  // Insurance & Finance
  'застраховк', 'осигуровк', 'банков',
  
  // Veterinary
  'ветеринар', 'животно лекарств',
  
  // Transport (but not infrastructure)
  'доставка на мпр', 'доставка на автомобил', 'доставка на автобус',
  
  // Services (not infrastructure)
  'охрана', 'почистван', 'хигиенизац', 'пест контрол',
  'застраховк', 'осигуровк', 'счетоводств', 'правна услуг',
  
  // Other non-infrastructure
  'учебник', 'учебн помагал', 'спортн екипировк',
  'музикалн инструмент', 'театралн реквизит'
];

/**
 * Check if tender is infrastructure-related
 */
function isInfrastructureTender(tender) {
  const text = `${tender.name || ''} ${tender.description || ''}`.toLowerCase();
  
  // First check if it should be excluded
  for (const excludeKeyword of EXCLUDE_KEYWORDS) {
    if (text.includes(excludeKeyword)) {
      return false;
    }
  }
  
  // Then check if it should be included
  for (const includeKeyword of INCLUDE_KEYWORDS) {
    if (text.includes(includeKeyword)) {
      return true;
    }
  }
  
  // Also check if it has EU funding (usually infrastructure)
  if (tender.isEUFunding === true || tender.isEUFunding === 'true') {
    return true;
  }
  
  return false;
}

/**
 * Parse tender description to extract address
 */
function extractAddress(tender) {
  const text = `${tender.name || ''} ${tender.description || ''}`;
  
  // Common address patterns in Bulgarian
  const patterns = [
    /ул\.\s*["„]?([^"„""]+)["„]?\s*№?\s*(\d+[а-яА-Я]*)/gi,
    /бул\.\s*["„]?([^"„""]+)["„]?\s*№?\s*(\d+[а-яА-Я]*)/gi,
    /площад?\s+["„]?([^"„""]+)["„]?/gi,
    /кв\.\s*["„]?([^"„""]+)["„]?/gi,
    /с\.\s+([А-Я][а-я]+)/g,
    /гр\.\s+Стара\s+Загора/g,
    /Стара\s+Загора/g
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return match[0] + ', Стара Загора';
    }
  }
  
  return 'Стара Загора';
}

/**
 * Map tender status to our status
 */
function mapStatus(status) {
  if (status === 1) return 'active';
  if (status === 2) return 'completed';
  if (status === 3) return 'cancelled';
  return 'planned';
}

/**
 * Process tenders from JSON data
 */
function processTenders(tenders) {
  const processed = [];
  
  for (const tender of tenders) {
    // Skip if not infrastructure-related
    if (!isInfrastructureTender(tender)) {
      continue;
    }
    
    const address = extractAddress(tender);
    
    processed.push({
      eop_id: String(tender.id),
      source_url: `https://app.eop.bg/tender/${tender.tenderId}`,
      title: tender.name,
      description: tender.description?.replace(/<[^>]*>/g, '').trim(), // Strip HTML
      status: mapStatus(tender.status),
      budget: null, // Not available in this API
      currency: 'BGN',
      contractor: null,
      contract_number: tender.specialNumber || null,
      awarding_type: tender.procedureType ? `Type ${tender.procedureType}` : null,
      procurement_type: null,
      cpv_code: null,
      address: address,
      settlement: 'Стара Загора',
      municipality: 'Стара Загора',
      lat: null, // Will be geocoded later
      lng: null,
      start_date: tender.createdDate ? tender.createdDate.split('T')[0] : null,
      end_date: tender.deadline ? tender.deadline.split('T')[0] : null,
      publication_date: tender.publishedDate ? tender.publishedDate.split('T')[0] : null,
      raw_data: JSON.stringify(tender)
    });
  }
  
  return processed;
}

/**
 * Run the Python script and parse output
 */
async function runPythonScript() {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, '../../fetch_tenders.py');
    const jsonFile = path.join(__dirname, '../../tenders_stara_zagora.json');
    
    // First check if JSON file already exists and is recent
    try {
      const stats = fs.statSync(jsonFile);
      const fileAge = Date.now() - stats.mtimeMs;
      
      // If file is less than 1 hour old, use it instead of running Python
      if (fileAge < 60 * 60 * 1000) {
        console.log('📄 Using existing JSON file (less than 1 hour old)');
        const data = fs.readFileSync(jsonFile, 'utf8');
        return resolve(JSON.parse(data));
      }
    } catch (e) {
      // File doesn't exist, need to run Python script
    }
    
    console.log('🐍 Running Python script to fetch tenders...');
    
    const python = spawn('python3', [pythonScript], {
      cwd: path.join(__dirname, '../..')
    });
    
    let stdout = '';
    let stderr = '';
    
    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    python.on('close', (code) => {
      if (code !== 0) {
        console.error('Python script error:', stderr);
        
        // Try to read existing JSON file as fallback
        try {
          const data = fs.readFileSync(jsonFile, 'utf8');
          console.log('📄 Using existing JSON file as fallback');
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Python script failed: ${stderr}`));
        }
        return;
      }
      
      console.log('✅ Python script completed');
      
      // Read the generated JSON file
      try {
        const data = fs.readFileSync(jsonFile, 'utf8');
        resolve(JSON.parse(data));
      } catch (e) {
        reject(new Error(`Failed to read JSON file: ${e.message}`));
      }
    });
  });
}

/**
 * Fetch and store tenders from the Python script
 */
async function fetchAndStoreTenders() {
  console.log('📥 Fetching tenders from Python script...');
  
  try {
    // Run Python script and get data
    const tenders = await runPythonScript();
    console.log(`   Raw tenders fetched: ${tenders.length}`);
    
    // Process and filter tenders
    const processedTenders = processTenders(tenders);
    console.log(`   Infrastructure tenders: ${processedTenders.length}`);
    
    // Geocode addresses
    let geocodedCount = 0;
    for (const tender of processedTenders) {
      if (!tender.lat && tender.address) {
        try {
          const geo = await geocoderService.geocodeWithFallback(tender.address);
          if (geo) {
            tender.lat = geo.lat;
            tender.lng = geo.lng;
            geocodedCount++;
          }
          // Rate limit geocoding
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          // Continue without geocoding
        }
      }
    }
    console.log(`   Geocoded: ${geocodedCount}`);
    
    // Store in database (upsert - only new/updated)
    const result = await dbService.upsertEopData(processedTenders);
    console.log(`   Added: ${result.added}, Updated: ${result.updated}`);
    
    return {
      total: tenders.length,
      infrastructure: processedTenders.length,
      geocoded: geocodedCount,
      added: result.added,
      updated: result.updated
    };
  } catch (error) {
    console.error('❌ Error fetching tenders:', error.message);
    throw error;
  }
}

/**
 * Get infrastructure tenders only
 */
async function getInfrastructureTenders(limit = 500) {
  const { pool } = require('../db/pool');
  
  // This would need a filter column or we filter in application code
  // For now, return all EOP data with coordinates
  const result = await pool.query(`
    SELECT * FROM eop_data 
    WHERE lat IS NOT NULL AND lng IS NOT NULL
    ORDER BY publication_date DESC 
    LIMIT $1
  `, [limit]);
  
  // Filter in application code for infrastructure
  return result.rows.filter(row => {
    const text = `${row.title || ''} ${row.description || ''}`.toLowerCase();
    
    // Check includes
    for (const keyword of INCLUDE_KEYWORDS) {
      if (text.includes(keyword)) {
        // Check excludes
        for (const exclude of EXCLUDE_KEYWORDS) {
          if (text.includes(exclude)) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  });
}

module.exports = {
  fetchAndStoreTenders,
  getInfrastructureTenders,
  isInfrastructureTender,
  processTenders,
  INCLUDE_KEYWORDS,
  EXCLUDE_KEYWORDS
};


/**
 * Smart Bulk EOP Geocoder
 * Fast and accurate geocoding for all EOP records
 */

const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

class EOPSmartGeocoder {
  constructor() {
    // Enhanced address patterns
    this.patterns = [
      // Street addresses
      /(?:ул\.?\s*|улица\s*)[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /(?:бул\.?\s*|булевард\s*)[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /(?:пл\.?\s*|площад\s*)[„"]([^„"]+)[„"]/gi,
      // Administrative addresses
      /административен адрес:\s*([^,\n]+)/gi,
      /адрес:\s*([^,\n]+)/gi,
      // UPI references
      /УПИ\s+[IVXLCDM]+\s+(\d+),?\s*кв\.?\s*(\d+[а-я]?)/gi,
      // Specific locations
      /(?:в|на)\s+(зоопарк|стадион|болница|гара|летище|пазар|автогара)/gi,
      // Schools and institutions
      /(?:в|на)\s+([А-Я][а-я]+\s+(?:училище|градина|център))/gi,
      // Neighborhoods with context
      /(?:в|на)\s+кв\.?\s*[„"]?([А-Я][а-я\s]+)[„"]?/gi
    ];

    // Exact coordinates for known locations
    this.knownLocations = {
      'зоопарк': { lat: 42.4180, lng: 25.6350, type: 'landmark' },
      'стадион': { lat: 42.4100, lng: 25.6200, type: 'landmark' },
      'болница': { lat: 42.4200, lng: 25.6100, type: 'landmark' },
      'гара': { lat: 42.4300, lng: 25.6400, type: 'landmark' },
      'пазар': { lat: 42.4250, lng: 25.6320, type: 'landmark' },
      'автогара': { lat: 42.4280, lng: 25.6380, type: 'landmark' },
      
      // Schools
      'първо основно училище': { lat: 42.4320, lng: 25.6180, type: 'school' },
      'второ основно училище': { lat: 42.4280, lng: 25.6220, type: 'school' },
      'трето основно училище': { lat: 42.4200, lng: 25.6300, type: 'school' },
      
      // Neighborhoods - more precise locations
      'три чучура': { lat: 42.4180, lng: 25.6280, type: 'district' },
      'славейков': { lat: 42.4320, lng: 25.6180, type: 'district' },
      'зора': { lat: 42.4100, lng: 25.6200, type: 'district' },
      'градински': { lat: 42.4380, lng: 25.6420, type: 'district' },
      'македонски': { lat: 42.4200, lng: 25.6100, type: 'district' },
      'самара': { lat: 42.4050, lng: 25.6450, type: 'district' },
      'индустриален': { lat: 42.4150, lng: 25.6500, type: 'district' }
    };
  }

  extractBestLocation(text) {
    const lowerText = text.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    // Check known locations first
    for (const [location, coords] of Object.entries(this.knownLocations)) {
      if (lowerText.includes(location)) {
        const score = coords.type === 'landmark' ? 10 : coords.type === 'school' ? 8 : 5;
        if (score > bestScore) {
          bestMatch = { location, ...coords, confidence: 0.9 };
          bestScore = score;
        }
      }
    }

    if (bestMatch) return bestMatch;

    // Extract addresses with patterns
    for (const pattern of this.patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 3) {
          return {
            location: `${match[1]} ${match[2] || ''}`.trim(),
            type: 'address',
            needsGeocoding: true,
            confidence: 0.7
          };
        }
      }
    }

    // Content-based categorization with better locations
    if (/училищ|детск|образован|учебн/i.test(lowerText)) {
      return { location: 'Образователен район', lat: 42.4320, lng: 25.6180, type: 'category', confidence: 0.4 };
    }
    if (/спорт|стадион|игрищ|фитнес/i.test(lowerText)) {
      return { location: 'Спортен комплекс', lat: 42.4100, lng: 25.6200, type: 'category', confidence: 0.4 };
    }
    if (/здрав|болниц|медицин/i.test(lowerText)) {
      return { location: 'Медицински център', lat: 42.4200, lng: 25.6100, type: 'category', confidence: 0.4 };
    }
    if (/парк|озелен|градин|дърв/i.test(lowerText)) {
      return { location: 'Градски парк', lat: 42.4380, lng: 25.6420, type: 'category', confidence: 0.4 };
    }
    if (/жилищн|многофамилн|сграда/i.test(lowerText)) {
      return { location: 'Жилищен комплекс', lat: 42.4180, lng: 25.6280, type: 'category', confidence: 0.4 };
    }

    // Default to city center
    return { location: 'Център', lat: 42.4257, lng: 25.6344, type: 'default', confidence: 0.2 };
  }

  async geocodeAddress(address) {
    try {
      const query = `${address}, Стара Загора, България`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=bg`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'OpenZagora/1.0' },
        timeout: 5000
      });
      
      if (response.data?.[0]) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          confidence: Math.min(parseFloat(result.importance) || 0.5, 0.8)
        };
      }
    } catch (error) {
      console.log(`Geocoding failed: ${address}`);
    }
    return null;
  }

  async processAllRecords() {
    try {
      const result = await pool.query('SELECT id, title, description FROM eop_data');
      console.log(`🚀 Processing ${result.rows.length} EOP records...`);

      let exact = 0, geocoded = 0, categorized = 0, failed = 0;

      for (let i = 0; i < result.rows.length; i++) {
        try {
          const record = result.rows[i];
          const text = `${record.title} ${record.description || ''}`;
          const location = this.extractBestLocation(text);

          let finalLocation = location;

          if (location.needsGeocoding) {
            try {
              const coords = await this.geocodeAddress(location.location);
              if (coords && coords.confidence > 0.3) {
                finalLocation = {
                  location: location.location,
                  lat: coords.lat,
                  lng: coords.lng,
                  confidence: coords.confidence
                };
                geocoded++;
              } else {
                finalLocation = { location: 'Център', lat: 42.4257, lng: 25.6344 };
                failed++;
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (geoError) {
              finalLocation = { location: 'Център', lat: 42.4257, lng: 25.6344 };
              failed++;
            }
          } else if (location.type === 'landmark' || location.type === 'school') {
            exact++;
          } else {
            categorized++;
          }

          await pool.query(
            'UPDATE eop_data SET lat = $1, lng = $2, address = $3 WHERE id = $4',
            [finalLocation.lat, finalLocation.lng, finalLocation.location, record.id]
          );

          if (i % 100 === 0) {
            console.log(`Progress: ${i}/${result.rows.length} - E:${exact} G:${geocoded} C:${categorized} F:${failed}`);
          }
        } catch (recordError) {
          console.log(`Error processing record ${i}: ${recordError.message}`);
          failed++;
        }
      }

      console.log(`✅ Completed: ${exact} exact, ${geocoded} geocoded, ${categorized} categorized, ${failed} failed`);
      return { total: result.rows.length, exact, geocoded, categorized, failed };

    } catch (error) {
      console.error('Smart geocoding failed:', error.message);
      throw error;
    }
  }
}

module.exports = new EOPSmartGeocoder();
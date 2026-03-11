/**
 * Hybrid EOP Geocoder
 * 1. Extract exact addresses (ул, бул, etc.) -> OpenStreetMap API
 * 2. Extract location names -> OpenStreetMap API  
 * 3. AI categorization fallback
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

class EOPHybridGeocoder {
  constructor() {
    this.addressPatterns = [
      /(?:ул\.?|улица)\s*[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /(?:бул\.?|булевард)\s*[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /(?:пл\.?|площад)\s*[„"]([^„"]+)[„"]/gi,
      /административен адрес:\s*([^,\n]+)/gi
    ];
    
    this.locationPatterns = [
      /(?:в|на)\s+([А-Я][а-я]+(?:\s+[А-Я][а-я]+)*)\s*(?:,|$)/g,
      /(?:зоопарк|стадион|болница|гара|летище|пазар|автогара|училище|детска градина|парк)/gi,
      /(?:кв\.?\s*|жк\.?\s*)([А-Я][а-я\s]+)/gi
    ];

    this.aiCategories = {
      'училище|детск|образован': { lat: 42.4320, lng: 25.6180, name: 'Образователен район' },
      'спорт|стадион|игрищ|фитнес': { lat: 42.4100, lng: 25.6200, name: 'Спортен район' },
      'здрав|болниц|медицин': { lat: 42.4200, lng: 25.6100, name: 'Медицински район' },
      'парк|озелен|градин|дърв': { lat: 42.4380, lng: 25.6420, name: 'Зелени площи' },
      'промишлен|индустриал|завод|машин': { lat: 42.4150, lng: 25.6500, name: 'Промишлена зона' },
      'жилищн|многофамилн|сграда': { lat: 42.4180, lng: 25.6280, name: 'Жилищен район' }
    };
  }

  async geocodeWithOSM(query) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ', Стара Загора, България')}&limit=1`;
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'OpenZagora/1.0' }
      });
      
      if (response.data?.[0]) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          confidence: parseFloat(result.importance) || 0.5,
          display_name: result.display_name
        };
      }
    } catch (error) {
      console.log(`OSM geocoding failed for: ${query}`);
    }
    return null;
  }

  extractAddresses(text) {
    const addresses = [];
    
    for (const pattern of this.addressPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        addresses.push({
          type: 'address',
          street: match[1]?.trim(),
          number: match[2] || '',
          full: `${match[1]?.trim()} ${match[2] || ''}`.trim()
        });
      }
    }
    
    return addresses;
  }

  extractLocations(text) {
    const locations = [];
    
    for (const pattern of this.locationPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1] && match[1].length > 2) {
          locations.push({
            type: 'location',
            name: match[1].trim(),
            full: match[0].trim()
          });
        }
      }
    }
    
    return locations;
  }

  aiCategorize(text) {
    const lowerText = text.toLowerCase();
    
    for (const [pattern, coords] of Object.entries(this.aiCategories)) {
      if (new RegExp(pattern, 'i').test(lowerText)) {
        return {
          type: 'ai_category',
          ...coords,
          confidence: 0.3
        };
      }
    }
    
    return {
      type: 'ai_category',
      lat: 42.4257,
      lng: 25.6344,
      name: 'Център',
      confidence: 0.2
    };
  }

  async findBestLocation(title, description) {
    const text = `${title} ${description || ''}`;
    
    // Step 1: Try exact addresses
    const addresses = this.extractAddresses(text);
    for (const addr of addresses) {
      const coords = await this.geocodeWithOSM(addr.full);
      if (coords && coords.confidence > 0.3) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limit
        return {
          lat: coords.lat,
          lng: coords.lng,
          address: addr.full,
          source: 'exact_address',
          confidence: coords.confidence
        };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 2: Try location names
    const locations = this.extractLocations(text);
    for (const loc of locations) {
      const coords = await this.geocodeWithOSM(loc.name);
      if (coords && coords.confidence > 0.2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return {
          lat: coords.lat,
          lng: coords.lng,
          address: loc.name,
          source: 'location_name',
          confidence: coords.confidence
        };
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 3: AI categorization fallback
    const aiResult = this.aiCategorize(text);
    return {
      lat: aiResult.lat,
      lng: aiResult.lng,
      address: aiResult.name,
      source: 'ai_category',
      confidence: aiResult.confidence
    };
  }

  async geocodeAll() {
    try {
      // Check if table exists first
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'eop_data'
        ) as exists
      `);
      
      if (!tableCheck.rows[0].exists) {
        console.log('⚠️ eop_data table does not exist, skipping geocoding');
        return { updated: 0, exact: 0, locations: 0, ai: 0 };
      }

      // Get ALL records without coordinates (not just 50!)
      const result = await pool.query(
        'SELECT id, title, description FROM eop_data WHERE lat IS NULL OR lng IS NULL'
      );

      console.log(`🎯 Hybrid geocoding up to ${result.rows.length} EOP records...`);
      
      let updated = 0;
      let exact = 0;
      let locations = 0;
      let ai = 0;
      
      for (const record of result.rows) {
        const location = await this.findBestLocation(record.title, record.description);
        
        await pool.query(
          'UPDATE eop_data SET lat = $1, lng = $2, address = $3 WHERE id = $4',
          [location.lat, location.lng, location.address, record.id]
        );
        
        if (location.source === 'exact_address') exact++;
        else if (location.source === 'location_name') locations++;
        else ai++;
        
        updated++;
        if (updated % 10 === 0) {
          console.log(`✓ Processed ${updated}/${result.rows.length} records...`);
        }
      }
      
      console.log(`✅ Hybrid geocoding completed: ${exact} exact, ${locations} locations, ${ai} AI`);
      return { updated, exact, locations, ai };
      
    } catch (error) {
      console.error('Hybrid geocoding failed:', error);
      throw error;
    }
  }
}

module.exports = new EOPHybridGeocoder();

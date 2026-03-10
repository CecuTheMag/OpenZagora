/**
 * Simple EOP Geocoder with Anti-Stacking
 * Prevents clustering by adding small random offsets
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

class EOPSimpleGeocoder {
  constructor() {
    this.baseLocations = {
      // Landmarks
      'зоопарк': { lat: 42.4180, lng: 25.6350 },
      'стадион': { lat: 42.4100, lng: 25.6200 },
      'болница': { lat: 42.4200, lng: 25.6100 },
      'гара': { lat: 42.4300, lng: 25.6400 },
      'пазар': { lat: 42.4250, lng: 25.6320 },
      
      // Content-based areas
      'училищ': { lat: 42.4320, lng: 25.6180 },
      'детск': { lat: 42.4320, lng: 25.6180 },
      'спорт': { lat: 42.4100, lng: 25.6200 },
      'здрав': { lat: 42.4200, lng: 25.6100 },
      'парк': { lat: 42.4380, lng: 25.6420 },
      'жилищн': { lat: 42.4180, lng: 25.6280 },
      'промишлен': { lat: 42.4150, lng: 25.6500 },
      
      // Streets (approximate locations)
      'руски': { lat: 42.4240, lng: 25.6300 },
      'славянски': { lat: 42.4200, lng: 25.6250 },
      'христо ботев': { lat: 42.4280, lng: 25.6350 },
      'цар симеон': { lat: 42.4220, lng: 25.6380 },
      'генерал гурко': { lat: 42.4260, lng: 25.6320 },
      'митрополит методий': { lat: 42.4190, lng: 25.6290 },
      'патриарх евтимий': { lat: 42.4210, lng: 25.6270 },
      'хан аспарух': { lat: 42.4170, lng: 25.6310 },
      'граф игнатиев': { lat: 42.4230, lng: 25.6340 }
    };
  }

  addRandomOffset(lat, lng, maxOffset = 0.003) {
    return {
      lat: lat + (Math.random() - 0.5) * maxOffset,
      lng: lng + (Math.random() - 0.5) * maxOffset
    };
  }

  findLocation(text) {
    const lowerText = text.toLowerCase();
    
    // Check for specific locations
    for (const [keyword, coords] of Object.entries(this.baseLocations)) {
      if (lowerText.includes(keyword)) {
        const offset = this.addRandomOffset(coords.lat, coords.lng);
        return {
          location: keyword,
          lat: offset.lat,
          lng: offset.lng,
          type: 'matched'
        };
      }
    }
    
    // Default with random offset in city center
    const center = this.addRandomOffset(42.4257, 25.6344, 0.005);
    return {
      location: 'Център',
      lat: center.lat,
      lng: center.lng,
      type: 'default'
    };
  }

  async processAll() {
    try {
      const result = await pool.query('SELECT id, title, description FROM eop_data');
      console.log(`🎯 Processing ${result.rows.length} records with anti-stacking...`);

      let matched = 0, defaults = 0;

      for (let i = 0; i < result.rows.length; i++) {
        const record = result.rows[i];
        const text = `${record.title} ${record.description || ''}`;
        const location = this.findLocation(text);

        await pool.query(
          'UPDATE eop_data SET lat = $1, lng = $2, address = $3 WHERE id = $4',
          [location.lat, location.lng, location.location, record.id]
        );

        if (location.type === 'matched') matched++;
        else defaults++;

        if (i % 100 === 0) {
          console.log(`Progress: ${i}/${result.rows.length} - Matched: ${matched}, Defaults: ${defaults}`);
        }
      }

      console.log(`✅ Completed: ${matched} matched, ${defaults} defaults`);
      return { total: result.rows.length, matched, defaults };

    } catch (error) {
      console.error('Simple geocoding failed:', error);
      throw error;
    }
  }
}

module.exports = new EOPSimpleGeocoder();
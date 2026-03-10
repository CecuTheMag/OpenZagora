/**
 * AI-powered EOP Geocoder
 * Uses intelligent pattern matching to determine tender locations
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

class EOPAIGeocoder {
  constructor() {
    // Location patterns with context clues
    this.locationPatterns = {
      'център': {
        lat: 42.4257, lng: 25.6344,
        patterns: [
          /общин(а|ски|ско)/i,
          /кметство/i,
          /администрати(вен|я)/i,
          /централ(ен|на)/i,
          /център/i,
          /градска/i,
          /общински съвет/i
        ]
      },
      'три чучура': {
        lat: 42.4180, lng: 25.6280,
        patterns: [
          /три чучура/i,
          /чучура/i,
          /жилищн(а|и) сгради/i,
          /многофамилн/i,
          /жк/i
        ]
      },
      'славейков': {
        lat: 42.4320, lng: 25.6180,
        patterns: [
          /славейков/i,
          /училищ(е|а)/i,
          /образовани/i,
          /детск(а|и) градин/i,
          /учебн/i
        ]
      },
      'зора': {
        lat: 42.4100, lng: 25.6200,
        patterns: [
          /зора/i,
          /спортн/i,
          /стадион/i,
          /игрищ/i,
          /фитнес/i
        ]
      },
      'градински': {
        lat: 42.4380, lng: 25.6420,
        patterns: [
          /градински/i,
          /парк/i,
          /озеленяване/i,
          /градин/i,
          /дървет/i,
          /цветя/i
        ]
      },
      'македонски': {
        lat: 42.4200, lng: 25.6100,
        patterns: [
          /македонски/i,
          /болниц/i,
          /здравн/i,
          /медицинск/i,
          /лечебн/i
        ]
      },
      'самара': {
        lat: 42.4050, lng: 25.6450,
        patterns: [
          /самара/i,
          /индустриал/i,
          /промишлен/i,
          /завод/i,
          /фабрик/i
        ]
      },
      'индустриален': {
        lat: 42.4150, lng: 25.6500,
        patterns: [
          /индустриален/i,
          /промишлена зона/i,
          /производств/i,
          /техническ/i,
          /машин/i,
          /оборудване/i
        ]
      }
    };
  }

  /**
   * AI-powered location detection
   */
  detectLocation(title, description) {
    const text = `${title} ${description || ''}`.toLowerCase();
    const scores = {};

    // Score each location based on pattern matches
    for (const [location, config] of Object.entries(this.locationPatterns)) {
      scores[location] = 0;
      
      for (const pattern of config.patterns) {
        const matches = text.match(pattern);
        if (matches) {
          scores[location] += matches.length;
        }
      }
    }

    // Find best match
    const bestMatch = Object.entries(scores)
      .filter(([_, score]) => score > 0)
      .sort(([,a], [,b]) => b - a)[0];

    if (bestMatch) {
      const [location] = bestMatch;
      return {
        district: location,
        ...this.locationPatterns[location],
        confidence: bestMatch[1]
      };
    }

    // Smart fallback based on tender type
    if (text.includes('училищ') || text.includes('детск')) {
      return { district: 'славейков', ...this.locationPatterns['славейков'], confidence: 0.5 };
    }
    if (text.includes('спорт') || text.includes('игрищ')) {
      return { district: 'зора', ...this.locationPatterns['зора'], confidence: 0.5 };
    }
    if (text.includes('здрав') || text.includes('медицин')) {
      return { district: 'македонски', ...this.locationPatterns['македонски'], confidence: 0.5 };
    }
    if (text.includes('озелен') || text.includes('парк')) {
      return { district: 'градински', ...this.locationPatterns['градински'], confidence: 0.5 };
    }

    // Default to center for administrative/general tenders
    return { district: 'център', ...this.locationPatterns['център'], confidence: 0.3 };
  }

  /**
   * Geocode all EOP records using AI
   */
  async geocodeAll() {
    try {
      const result = await pool.query(
        'SELECT id, title, description FROM eop_data WHERE lat IS NULL'
      );

      console.log(`🤖 AI geocoding ${result.rows.length} EOP records...`);
      
      let updated = 0;
      const districtCounts = {};
      
      for (const record of result.rows) {
        const location = this.detectLocation(record.title, record.description);
        
        await pool.query(
          'UPDATE eop_data SET lat = $1, lng = $2, address = $3, settlement = $4 WHERE id = $5',
          [location.lat, location.lng, `кв. ${location.district}, Стара Загора`, location.district, record.id]
        );
        
        districtCounts[location.district] = (districtCounts[location.district] || 0) + 1;
        updated++;
      }
      
      console.log('✅ AI geocoding completed:');
      Object.entries(districtCounts).forEach(([district, count]) => {
        console.log(`   ${district}: ${count} tenders`);
      });
      
      return updated;
      
    } catch (error) {
      console.error('AI geocoding failed:', error);
      throw error;
    }
  }
}

module.exports = new EOPAIGeocoder();
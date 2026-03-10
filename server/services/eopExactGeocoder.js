/**
 * Exact Location Geocoder for EOP Data
 * Extracts specific addresses and coordinates from tender content
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

class EOPExactGeocoder {
  constructor() {
    this.addressPatterns = [
      /ул\.?\s*[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /улица\s*[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /бул\.?\s*[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /boulevard\s*[„"]([^„"]+)[„"]\s*№?\s*(\d+)/gi,
      /адрес:\s*([^,\n]+)/gi,
      /административен адрес:\s*([^,\n]+)/gi,
      /УПИ\s+[IVXLCDM]+\s+(\d+),?\s*кв\.?\s*(\d+[а-я]?)/gi
    ];
    
    this.specificLocations = {
      'зоопарк': { lat: 42.4180, lng: 25.6350 },
      'стадион': { lat: 42.4100, lng: 25.6200 },
      'болница': { lat: 42.4200, lng: 25.6100 },
      'гара': { lat: 42.4300, lng: 25.6400 },
      'летище': { lat: 42.3800, lng: 25.6500 },
      'пазар': { lat: 42.4250, lng: 25.6320 },
      'автогара': { lat: 42.4280, lng: 25.6380 }
    };
  }

  extractAddresses(text) {
    const addresses = [];
    
    for (const pattern of this.addressPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          addresses.push({
            full: match[0],
            street: match[1].trim(),
            number: match[2] || '',
            type: 'street'
          });
        }
      }
    }
    
    // Check for specific locations
    const lowerText = text.toLowerCase();
    for (const [location, coords] of Object.entries(this.specificLocations)) {
      if (lowerText.includes(location)) {
        addresses.push({
          full: location,
          location: location,
          type: 'landmark',
          ...coords
        });
      }
    }
    
    return addresses;
  }

  async geocodeAddress(address) {
    try {
      const query = `${address.street} ${address.number}, Стара Загора, България`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'OpenZagora/1.0' }
      });
      
      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        return {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          confidence: parseFloat(result.importance) || 0.5
        };
      }
    } catch (error) {
      console.log(`Geocoding failed for: ${address.street}`);
    }
    
    return null;
  }

  async findExactLocation(title, description) {
    const text = `${title} ${description || ''}`;
    const addresses = this.extractAddresses(text);
    
    // Try landmarks first
    const landmark = addresses.find(addr => addr.type === 'landmark');
    if (landmark) {
      return {
        lat: landmark.lat,
        lng: landmark.lng,
        address: landmark.location,
        source: 'landmark',
        confidence: 0.9
      };
    }
    
    // Try street addresses
    for (const address of addresses.filter(addr => addr.type === 'street')) {
      const coords = await this.geocodeAddress(address);
      if (coords) {
        return {
          lat: coords.lat,
          lng: coords.lng,
          address: `${address.street} ${address.number}`,
          source: 'geocoded',
          confidence: coords.confidence
        };
      }
      
      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return null;
  }

  async geocodeAll() {
    try {
      const result = await pool.query(
        'SELECT id, title, description FROM eop_data WHERE lat IS NULL LIMIT 100'
      );

      console.log(`📍 Exact geocoding ${result.rows.length} EOP records...`);
      
      let updated = 0;
      let exact = 0;
      
      for (const record of result.rows) {
        const location = await this.findExactLocation(record.title, record.description);
        
        if (location) {
          await pool.query(
            'UPDATE eop_data SET lat = $1, lng = $2, address = $3 WHERE id = $4',
            [location.lat, location.lng, location.address, record.id]
          );
          
          if (location.confidence > 0.7) exact++;
          updated++;
          
          console.log(`✓ ${location.source}: ${location.address} (${location.confidence.toFixed(2)})`);
        }
      }
      
      console.log(`✅ Exact geocoding completed: ${exact}/${updated} high confidence`);
      return { updated, exact };
      
    } catch (error) {
      console.error('Exact geocoding failed:', error);
      throw error;
    }
  }
}

module.exports = new EOPExactGeocoder();
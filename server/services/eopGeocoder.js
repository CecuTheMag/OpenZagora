/**
 * EOP Geocoding Service
 * Extracts addresses from tender data and adds coordinates
 */

const axios = require('axios');
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

class EOPGeocoder {
  constructor() {
    // Stara Zagora bounds for validation
    this.bounds = {
      minLat: 42.35, maxLat: 42.50,
      minLng: 25.55, maxLng: 25.75
    };
  }

  /**
   * Extract address from tender title/description
   */
  extractAddress(title, description) {
    const text = `${title} ${description || ''}`.toLowerCase();
    
    // Common address patterns in Bulgarian tenders
    const patterns = [
      /ул\.\s*[„"]([^„"]+)[„"]/g,           // ул. "Street Name"
      /бул\.\s*[„"]([^„"]+)[„"]/g,          // бул. "Boulevard Name"
      /на\s+ул\.\s*[„"]?([^„"\s,]+)/g,      // на ул. Street
      /на\s+бул\.\s*[„"]?([^„"\s,]+)/g,     // на бул. Boulevard
      /кв\.\s*[„"]([^„"]+)[„"]/g,           // кв. "District"
      /в\s+кв\.\s*[„"]?([^„"\s,]+)/g,       // в кв. District
      /гр\.\s*стара\s+загора/g              // гр. Стара Загора
    ];

    const addresses = [];
    
    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        if (match[1]) {
          addresses.push(match[1].trim());
        }
      }
    });

    // Always include "Стара Загора" for context
    return addresses.length > 0 
      ? `${addresses[0]}, Стара Загора, България`
      : 'Стара Загора, България';
  }

  /**
   * Geocode address using Nominatim
   */
  async geocodeAddress(address) {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q: address,
          format: 'json',
          limit: 1,
          countrycodes: 'bg',
          bounded: 1,
          viewbox: `${this.bounds.minLng},${this.bounds.minLat},${this.bounds.maxLng},${this.bounds.maxLat}`
        },
        timeout: 5000
      });

      if (response.data && response.data.length > 0) {
        const result = response.data[0];
        const lat = parseFloat(result.lat);
        const lng = parseFloat(result.lon);
        
        // Validate coordinates are within Stara Zagora
        if (lat >= this.bounds.minLat && lat <= this.bounds.maxLat &&
            lng >= this.bounds.minLng && lng <= this.bounds.maxLng) {
          return { lat, lng, address: result.display_name };
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error.message);
    }
    
    // Fallback to city center
    return { lat: 42.4257, lng: 25.6344, address: 'Стара Загора (център)' };
  }

  /**
   * Add coordinates to EOP records
   */
  async geocodeEOPRecords(limit = 50) {
    try {
      // Get records without coordinates
      const result = await pool.query(
        'SELECT id, title, description FROM eop_data WHERE lat IS NULL LIMIT $1',
        [limit]
      );

      console.log(`🗺️ Geocoding ${result.rows.length} EOP records...`);
      
      let updated = 0;
      
      for (const record of result.rows) {
        try {
          // Extract address
          const address = this.extractAddress(record.title, record.description);
          console.log(`Geocoding: ${address}`);
          
          // Geocode
          const coords = await this.geocodeAddress(address);
          
          // Update database
          await pool.query(
            'UPDATE eop_data SET lat = $1, lng = $2, address = $3 WHERE id = $4',
            [coords.lat, coords.lng, coords.address, record.id]
          );
          
          updated++;
          console.log(`✓ Updated: ${coords.lat}, ${coords.lng}`);
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Failed to geocode record ${record.id}:`, error.message);
        }
      }
      
      console.log(`✅ Geocoded ${updated} records`);
      return updated;
      
    } catch (error) {
      console.error('Geocoding process failed:', error);
      throw error;
    }
  }
}

module.exports = new EOPGeocoder();
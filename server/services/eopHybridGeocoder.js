const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const BOUNDS = { minLat: 42.35, maxLat: 42.50, minLng: 25.55, maxLng: 25.75 };

// All quote characters used in Bulgarian tender names:
// „ " (typographic low/high), " " (curly), « » (guillemets), " (straight)
const OQ = '[\u201e\u201c\u00ab\u201d\u00bb"]';
const CQ = '[\u201d\u201c\u00bb\u201e\u00ab"]';
const NOQ = '[^\u201e\u201c\u00ab\u201d\u00bb"]+';

function extractAddress(name) {
  // Pattern 1: ул./бул. <quote>Name<quote> № 12  (quoted street + number)
  const quotedStreet = new RegExp(
    '(?:ул\\.?\\s*|бул\\.?\\s*|улица\\s*|булевард\\s*)' +
    OQ + '(' + NOQ + ')' + CQ +
    '\\s*(?:\u2116\\s*)?(\\d+)',
    'gi'
  );

  // Pattern 2: административен адрес ... ул./бул. <quote>Name<quote> № 12
  const adminAddr = new RegExp(
    'административен адрес[^\\n]{0,60}?' +
    '(?:ул\\.?\\s*|бул\\.?\\s*)' +
    OQ + '(' + NOQ + ')' + CQ +
    '\\s*(?:\u2116\\s*)?(\\d+)',
    'gi'
  );

  // Pattern 3: ул./бул. Name № 12  (no quotes, explicit № sign)
  const noQuoteStreet = /(?:ул\.?\s*|бул\.?\s*|улица\s*|булевард\s*)([А-Яа-яёЁ][А-Яа-яёЁA-Za-z\s\-]{2,40})\s*№\s*(\d+)/gi;

  // Pattern 4: пл. <quote>Name<quote>  (square, no number needed)
  const square = new RegExp(
    '(?:пл\\.?\\s*|площад\\s*)' + OQ + '(' + NOQ + ')' + CQ,
    'gi'
  );

  for (const pattern of [quotedStreet, adminAddr, noQuoteStreet, square]) {
    pattern.lastIndex = 0;
    const m = pattern.exec(name);
    if (m) {
      const street = m[1].trim();
      const number = m[2] ? m[2].trim() : '';
      return number ? `${street} ${number}` : street;
    }
  }
  return null;
}

async function geocodeAddress(address) {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: `${address}, Стара Загора, България`,
        format: 'json',
        limit: 1,
        countrycodes: 'bg',
        bounded: 1,
        viewbox: `${BOUNDS.minLng},${BOUNDS.minLat},${BOUNDS.maxLng},${BOUNDS.maxLat}`,
      },
      headers: { 'User-Agent': 'OpenZagora/1.0' },
      timeout: 8000,
    });

    const result = response.data?.[0];
    if (!result) return null;

    const lat = parseFloat(result.lat);
    const lng = parseFloat(result.lon);

    if (lat < BOUNDS.minLat || lat > BOUNDS.maxLat || lng < BOUNDS.minLng || lng > BOUNDS.maxLng) {
      return null;
    }

    return { lat, lng };
  } catch (e) {
    return null;
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class EOPHybridGeocoder {
  async geocodeAll() {
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'eop_data'
        ) as exists
      `);
      if (!tableCheck.rows[0].exists) {
        console.log('eop_data table does not exist, skipping geocoding');
        return { updated: 0, skipped: 0 };
      }

      const { rows } = await pool.query('SELECT id, title FROM eop_data WHERE lat IS NULL OR lng IS NULL');
      console.log(`Geocoding ${rows.length} EOP records without coordinates...`);

      let updated = 0;
      let skipped = 0;

      for (const record of rows) {
        const address = extractAddress(record.title || '');

        if (!address) {
          skipped++;
          continue;
        }

        const coords = await geocodeAddress(address);
        await delay(1100);

        if (!coords) {
          skipped++;
          continue;
        }

        await pool.query(
          'UPDATE eop_data SET lat = $1, lng = $2, address = $3 WHERE id = $4',
          [coords.lat, coords.lng, address, record.id]
        );

        updated++;
        console.log(`  [${updated}] ${address} -> ${coords.lat}, ${coords.lng}`);
      }

      console.log(`Geocoding done: ${updated} placed, ${skipped} skipped`);
      return { updated, skipped };

    } catch (error) {
      console.error('Geocoding failed:', error);
      throw error;
    }
  }

  async clearAndGeocodeAll() {
    await pool.query('UPDATE eop_data SET lat = NULL, lng = NULL, address = NULL');
    console.log('Cleared all EOP coordinates');
    return this.geocodeAll();
  }
}

module.exports = new EOPHybridGeocoder();

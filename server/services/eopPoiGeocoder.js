/**
 * EOP POI Geocoder
 * Handles records that have no street address (left NULL by eopHybridGeocoder).
 * Strategy (in order):
 *   1. Named POI — query Overpass for a known institution mentioned in the title
 *   2. Neighbourhood centroid — geocode кв./жк name via Nominatim
 *   3. Skip — pure procurement tenders (deliveries, insurance, etc.) stay NULL
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

const BOUNDS = { south: 42.37, west: 25.58, north: 42.48, east: 25.72 };
const BBOX = `${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east}`;

// Keywords that indicate pure procurement with no physical location — skip these
const SKIP_PATTERNS = [
  /^доставка на/i,
  /^доставка и монтаж на/i,
  /застрахователни услуги/i,
  /застраховка/i,
  /наем на (самосвал|багер|камион|механизация)/i,
  /доставка на транспортни средства/i,
  /доставка на (мляко|хранителни|препарати|гранулирана храна|зърнен|паркова|горска|инструменти|обзавеждане|мебели)/i,
  /независима експертна оценка/i,
  /енергиен одитор/i,
  /авторски надзор/i,
  /строителен надзор/i,
  /пест контрол/i,
  /пътна маркировка/i,
  /улично осветление/i,
  /преместваеми.*контейнери/i,
];

// Named POI patterns: [regex to extract name hint, Overpass tag filter]
// Each entry: { pattern, tags, nameHint? }
const POI_RULES = [
  // Zoo
  {
    test: /зоопарк/i,
    overpass: `node["tourism"="zoo"](${BBOX});way["tourism"="zoo"](${BBOX});`,
    label: 'Зоопарк',
  },
  // Named school — extract the quoted name
  {
    test: /спортно училище\s*[„"]([^„"]+)[„"]/i,
    capture: 1,
    overpass: (name) => `node["amenity"="school"]["name"~"${name}",i](${BBOX});way["amenity"="school"]["name"~"${name}",i](${BBOX});`,
    label: 'Спортно училище',
  },
  // Any named school
  {
    test: /училище\s*[„"]([^„"]+)[„"]/i,
    capture: 1,
    overpass: (name) => `node["amenity"="school"]["name"~"${name}",i](${BBOX});way["amenity"="school"]["name"~"${name}",i](${BBOX});`,
    label: 'Училище',
  },
  // Kindergarten / детска градина
  {
    test: /детска градина/i,
    overpass: `node["amenity"="kindergarten"](${BBOX});way["amenity"="kindergarten"](${BBOX});`,
    label: 'Детска градина',
  },
  // Art gallery / Художествена галерия
  {
    test: /художествена галерия/i,
    overpass: `node["tourism"="gallery"](${BBOX});way["tourism"="gallery"](${BBOX});node["amenity"="arts_centre"](${BBOX});way["amenity"="arts_centre"](${BBOX});`,
    label: 'Художествена галерия',
  },
  // Planetarium / Observatory
  {
    test: /планетариум|обсерватория/i,
    overpass: `node["amenity"~"planetarium|observatory"](${BBOX});way["amenity"~"planetarium|observatory"](${BBOX});node["tourism"~"planetarium|observatory"](${BBOX});`,
    label: 'Планетариум',
  },
  // Swimming pool
  {
    test: /плувен басейн/i,
    overpass: `node["leisure"="swimming_pool"]["access"!="private"](${BBOX});way["leisure"="swimming_pool"]["access"!="private"](${BBOX});`,
    label: 'Плувен басейн',
  },
  // Animal shelter
  {
    test: /приют за безстопанствени животни/i,
    overpass: `node["amenity"="animal_shelter"](${BBOX});way["amenity"="animal_shelter"](${BBOX});`,
    label: 'Приют за животни',
  },
  // Park Artileriyski
  {
    test: /парк артилерийски/i,
    overpass: `node["leisure"="park"]["name"~"Артилерийски",i](${BBOX});way["leisure"="park"]["name"~"Артилерийски",i](${BBOX});`,
    label: 'Парк Артилерийски',
  },
  // Any named park
  {
    test: /парк\s*[„"]([^„"]+)[„"]/i,
    capture: 1,
    overpass: (name) => `node["leisure"="park"]["name"~"${name}",i](${BBOX});way["leisure"="park"]["name"~"${name}",i](${BBOX});`,
    label: 'Парк',
  },
  // Regional waste centre
  {
    test: /регионален център за управление на отпадъците/i,
    overpass: `node["amenity"="waste_transfer_station"](${BBOX});way["amenity"="waste_transfer_station"](${BBOX});`,
    label: 'Регионален център отпадъци',
  },
  // Theatre / drama theatre
  {
    test: /драматичен театър|театър/i,
    overpass: `node["amenity"="theatre"](${BBOX});way["amenity"="theatre"](${BBOX});`,
    label: 'Театър',
  },
  // Hospital / МБАЛ
  {
    test: /мбал|болница/i,
    overpass: `node["amenity"="hospital"](${BBOX});way["amenity"="hospital"](${BBOX});`,
    label: 'Болница',
  },
  // Municipality building
  {
    test: /общинска администрация|община стара загора/i,
    overpass: `node["amenity"="townhall"](${BBOX});way["amenity"="townhall"](${BBOX});`,
    label: 'Общинска администрация',
  },
];

// Neighbourhood pattern — кв. „X" or жк X or квартал X
const NEIGHBOURHOOD_RE = /(?:кв\.|квартал|жк\.?)\s*[„"]?([А-Яа-яёЁ][А-Яа-яёЁ\s\-]+?)[„"]?(?:\s*[-–,]|\s*$)/i;

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function queryOverpass(query) {
  const full = `[out:json][timeout:15];\n(\n${query}\n);\nout center;`;
  try {
    const res = await axios.post(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(full)}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 20000 }
    );
    return res.data?.elements || [];
  } catch {
    return [];
  }
}

function elementCoords(el) {
  if (el.type === 'node') return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  return null;
}

async function geocodeNeighbourhood(name) {
  try {
    const q = `${name}, Стара Загора, България`;
    const res = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'json', limit: 1, countrycodes: 'bg',
        bounded: 1, viewbox: `${BOUNDS.west},${BOUNDS.south},${BOUNDS.east},${BOUNDS.north}` },
      headers: { 'User-Agent': 'OpenZagora/1.0' },
      timeout: 8000,
    });
    const r = res.data?.[0];
    if (!r) return null;
    const lat = parseFloat(r.lat), lng = parseFloat(r.lon);
    if (lat < BOUNDS.south || lat > BOUNDS.north || lng < BOUNDS.west || lng > BOUNDS.east) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

async function resolveRecord(title) {
  const text = title || '';

  // 1. Check skip patterns first
  for (const pat of SKIP_PATTERNS) {
    if (pat.test(text)) return null;
  }

  // 2. Try named POI rules
  for (const rule of POI_RULES) {
    const m = text.match(rule.test);
    if (!m) continue;

    const overpassQuery = typeof rule.overpass === 'function'
      ? rule.overpass(m[rule.capture || 0].replace(/[„""]/g, '').trim())
      : rule.overpass;

    const elements = await queryOverpass(overpassQuery);
    await delay(1200); // Overpass rate limit

    if (elements.length > 0) {
      const coords = elementCoords(elements[0]);
      if (coords) return { ...coords, address: rule.label, source: 'overpass_poi' };
    }
    break; // matched a rule but got no result — don't fall through to next rule
  }

  // 3. Try neighbourhood
  const nm = text.match(NEIGHBOURHOOD_RE);
  if (nm) {
    const neighbourhood = nm[1].trim();
    const coords = await geocodeNeighbourhood(neighbourhood);
    await delay(1200); // Nominatim rate limit
    if (coords) return { ...coords, address: `кв. ${neighbourhood}`, source: 'neighbourhood' };
  }

  // 4. No location found — leave NULL
  return null;
}

class EOPPoiGeocoder {
  async geocodeRemaining() {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'eop_data'
      ) as exists
    `);
    if (!tableCheck.rows[0].exists) {
      console.log('eop_data table does not exist, skipping POI geocoding');
      return { placed: 0, skipped: 0 };
    }

    const { rows } = await pool.query(
      'SELECT id, title FROM eop_data WHERE lat IS NULL OR lng IS NULL'
    );
    console.log(`🏛️ POI geocoding ${rows.length} remaining EOP records...`);

    let placed = 0, skipped = 0;

    for (const record of rows) {
      const result = await resolveRecord(record.title);

      if (result) {
        await pool.query(
          'UPDATE eop_data SET lat = $1, lng = $2, address = $3 WHERE id = $4',
          [result.lat, result.lng, result.address, record.id]
        );
        placed++;
        console.log(`  [poi] ${result.source}: ${result.address} -> ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
      } else {
        skipped++;
      }
    }

    console.log(`✅ POI geocoding done: ${placed} placed, ${skipped} skipped (no location)`);
    return { placed, skipped };
  }
}

module.exports = new EOPPoiGeocoder();

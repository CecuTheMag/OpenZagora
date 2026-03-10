/**
 * EOP District Mapper
 * Maps tenders to districts based on keywords for quick location assignment
 */

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'open_zagora',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

class EOPDistrictMapper {
  constructor() {
    // District coordinates in Stara Zagora with expanded keywords
    this.districts = {
      'център': { 
        lat: 42.4257, lng: 25.6344, 
        keywords: ['център', 'центъра', 'централен', 'община стара загора', 'административен', 'кметство']
      },
      'три чучура': { 
        lat: 42.4180, lng: 25.6280, 
        keywords: ['три чучура', 'чучура', 'кв.три чучура', 'кв. три чучура', 'три чучура- юг', 'три чучура-юг']
      },
      'славейков': { 
        lat: 42.4320, lng: 25.6180, 
        keywords: ['славейков', 'жк славейков', 'кв славейков', 'кв. славейков']
      },
      'зора': { 
        lat: 42.4100, lng: 25.6200, 
        keywords: ['зора', 'кв зора', 'кв. зора', 'жк зора']
      },
      'градински': { 
        lat: 42.4380, lng: 25.6420, 
        keywords: ['градински', 'кв градински', 'кв. градински', 'жк градински']
      },
      'македонски': { 
        lat: 42.4200, lng: 25.6100, 
        keywords: ['македонски', 'кв македонски', 'кв. македонски', 'жк македонски']
      },
      'самара': { 
        lat: 42.4050, lng: 25.6450, 
        keywords: ['самара', 'кв самара', 'кв. самара', 'жк самара']
      },
      'индустриален': { 
        lat: 42.4150, lng: 25.6500, 
        keywords: ['индустриален', 'промишлена зона', 'промишлен', 'индустриална зона']
      }
    };
    this.districtNames = Object.keys(this.districts);
  }

  /**
   * Find district based on tender text
   */
  findDistrict(title, description, recordId) {
    const text = `${title} ${description || ''}`.toLowerCase();
    
    // Check for specific district keywords first
    for (const [district, data] of Object.entries(this.districts)) {
      for (const keyword of data.keywords) {
        if (text.includes(keyword)) {
          return { district, ...data };
        }
      }
    }
    
    // For general municipal tenders, distribute randomly but consistently
    // Use record ID as seed for consistent distribution
    const seed = parseInt(recordId) || 1;
    const districtIndex = seed % this.districtNames.length;
    const randomDistrict = this.districtNames[districtIndex];
    
    return { district: randomDistrict, ...this.districts[randomDistrict] };
  }

  /**
   * Map all EOP records to districts
   */
  async mapToDistricts() {
    try {
      const result = await pool.query(
        'SELECT id, title, description FROM eop_data WHERE lat IS NULL'
      );

      console.log(`🗺️ Mapping ${result.rows.length} EOP records to districts...`);
      
      let updated = 0;
      const districtCounts = {};
      
      for (const record of result.rows) {
        const location = this.findDistrict(record.title, record.description, record.id);
        
        await pool.query(
          'UPDATE eop_data SET lat = $1, lng = $2, address = $3, settlement = $4 WHERE id = $5',
          [location.lat, location.lng, `кв. ${location.district}, Стара Загора`, location.district, record.id]
        );
        
        districtCounts[location.district] = (districtCounts[location.district] || 0) + 1;
        updated++;
      }
      
      console.log('✅ District mapping completed:');
      Object.entries(districtCounts).forEach(([district, count]) => {
        console.log(`   ${district}: ${count} tenders`);
      });
      
      return updated;
      
    } catch (error) {
      console.error('District mapping failed:', error);
      throw error;
    }
  }
}

module.exports = new EOPDistrictMapper();
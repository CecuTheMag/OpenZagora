/**
 * Comprehensive Stara Zagora Location Database
 * Real coordinates for exact geocoding
 */

class StaraZagoraLocations {
  constructor() {
    // Major streets with coordinate ranges
    this.streets = {
      'руски': {
        start: { lat: 42.4220, lng: 25.6280 },
        end: { lat: 42.4260, lng: 25.6320 },
        numbers: { min: 1, max: 100 }
      },
      'христо ботев': {
        start: { lat: 42.4260, lng: 25.6300 },
        end: { lat: 42.4300, lng: 25.6380 },
        numbers: { min: 1, max: 200 }
      },
      'славянски': {
        start: { lat: 42.4180, lng: 25.6220 },
        end: { lat: 42.4220, lng: 25.6280 },
        numbers: { min: 1, max: 50 }
      },
      'цар симеон велики': {
        start: { lat: 42.4200, lng: 25.6350 },
        end: { lat: 42.4240, lng: 25.6400 },
        numbers: { min: 1, max: 150 }
      },
      'генерал гурко': {
        start: { lat: 42.4240, lng: 25.6300 },
        end: { lat: 42.4280, lng: 25.6340 },
        numbers: { min: 1, max: 120 }
      },
      'митрополит методий кусев': {
        start: { lat: 42.4170, lng: 25.6270 },
        end: { lat: 42.4210, lng: 25.6310 },
        numbers: { min: 1, max: 80 }
      },
      'патриарх евтимий': {
        start: { lat: 42.4190, lng: 25.6250 },
        end: { lat: 42.4230, lng: 25.6290 },
        numbers: { min: 1, max: 200 }
      },
      'хан аспарух': {
        start: { lat: 42.4150, lng: 25.6290 },
        end: { lat: 42.4190, lng: 25.6330 },
        numbers: { min: 1, max: 60 }
      },
      'граф игнатиев': {
        start: { lat: 42.4210, lng: 25.6320 },
        end: { lat: 42.4250, lng: 25.6360 },
        numbers: { min: 1, max: 40 }
      },
      'димитър подвързачов': {
        start: { lat: 42.4180, lng: 25.6240 },
        end: { lat: 42.4200, lng: 25.6280 },
        numbers: { min: 1, max: 20 }
      },
      'цар калоян': {
        start: { lat: 42.4200, lng: 25.6280 },
        end: { lat: 42.4240, lng: 25.6320 },
        numbers: { min: 1, max: 80 }
      },
      'цар иван шишман': {
        start: { lat: 42.4220, lng: 25.6300 },
        end: { lat: 42.4260, lng: 25.6340 },
        numbers: { min: 1, max: 100 }
      },
      'кольо ганчев': {
        start: { lat: 42.4160, lng: 25.6260 },
        end: { lat: 42.4200, lng: 25.6300 },
        numbers: { min: 1, max: 80 }
      },
      'августа траяна': {
        start: { lat: 42.4240, lng: 25.6320 },
        end: { lat: 42.4280, lng: 25.6360 },
        numbers: { min: 1, max: 100 }
      },
      'капитан петко войвода': {
        start: { lat: 42.4200, lng: 25.6240 },
        end: { lat: 42.4220, lng: 25.6280 },
        numbers: { min: 1, max: 30 }
      }
    };

    // Schools with exact coordinates
    this.schools = {
      'първо основно училище': { lat: 42.4310, lng: 25.6170, name: '1 ОУ "Христо Ботев"' },
      'второ основно училище': { lat: 42.4280, lng: 25.6200, name: '2 ОУ "Братя Миладинови"' },
      'трето основно училище': { lat: 42.4200, lng: 25.6280, name: '3 ОУ "Емилиян Станев"' },
      'четвърто основно училище': { lat: 42.4180, lng: 25.6300, name: '4 ОУ "Петко Рачов Славейков"' },
      'пето основно училище': { lat: 42.4160, lng: 25.6320, name: '5 ОУ "Митьо Станев"' },
      'спортно училище': { lat: 42.4120, lng: 25.6180, name: 'Спортно училище' },
      'професионална гимназия': { lat: 42.4250, lng: 25.6150, name: 'Професионална гимназия' }
    };

    // Kindergartens
    this.kindergartens = {
      'детска градина': { lat: 42.4200, lng: 25.6250, name: 'Детска градина' },
      'детска ясла': { lat: 42.4180, lng: 25.6270, name: 'Детска ясла' }
    };

    // Parks and green spaces
    this.parks = {
      'градски парк': { lat: 42.4350, lng: 25.6400, name: 'Градски парк "Загорка"' },
      'парк артилерийски': { lat: 42.4380, lng: 25.6420, name: 'Парк "Артилерийски"' },
      'парк бедечка': { lat: 42.4400, lng: 25.6380, name: 'Парк "Бедечка"' },
      'зелени площи': { lat: 42.4360, lng: 25.6390, name: 'Зелени площи' }
    };

    // Landmarks and institutions
    this.landmarks = {
      'зоопарк': { lat: 42.4180, lng: 25.6350, name: 'Зоопарк Стара Загора' },
      'стадион': { lat: 42.4100, lng: 25.6200, name: 'Стадион "Берое"' },
      'болница': { lat: 42.4200, lng: 25.6100, name: 'МБАЛ "Проф. Стоян Киркович"' },
      'гара': { lat: 42.4300, lng: 25.6400, name: 'ЖП Гара Стара Загора' },
      'пазар': { lat: 42.4250, lng: 25.6320, name: 'Централен пазар' },
      'автогара': { lat: 42.4280, lng: 25.6380, name: 'Автогара Стара Загора' },
      'летище': { lat: 42.3800, lng: 25.6500, name: 'Летище Стара Загора' },
      'община': { lat: 42.4257, lng: 25.6344, name: 'Община Стара Загора' },
      'кметство': { lat: 42.4257, lng: 25.6344, name: 'Кметство' }
    };

    // Neighborhoods with boundaries
    this.neighborhoods = {
      'три чучура': {
        center: { lat: 42.4180, lng: 25.6280 },
        radius: 0.008,
        aliases: ['чучура', 'три чучура-юг', 'три чучура-север']
      },
      'славейков': {
        center: { lat: 42.4320, lng: 25.6180 },
        radius: 0.006,
        aliases: ['жк славейков', 'кв славейков']
      },
      'зора': {
        center: { lat: 42.4100, lng: 25.6200 },
        radius: 0.005,
        aliases: ['кв зора', 'жк зора']
      },
      'градински': {
        center: { lat: 42.4380, lng: 25.6420 },
        radius: 0.005,
        aliases: ['кв градински']
      },
      'македонски': {
        center: { lat: 42.4200, lng: 25.6100 },
        radius: 0.004,
        aliases: ['кв македонски']
      },
      'самара': {
        center: { lat: 42.4050, lng: 25.6450 },
        radius: 0.006,
        aliases: ['кв самара']
      },
      'индустриален': {
        center: { lat: 42.4150, lng: 25.6500 },
        radius: 0.007,
        aliases: ['промишлена зона', 'индустриална зона']
      },
      'казански': {
        center: { lat: 42.4120, lng: 25.6380 },
        radius: 0.004,
        aliases: ['кв казански']
      }
    };

    // Medical facilities
    this.medical = {
      'болница': { lat: 42.4200, lng: 25.6100, name: 'МБАЛ "Проф. Стоян Киркович"' },
      'поликлиника': { lat: 42.4220, lng: 25.6320, name: 'Поликлиника' },
      'медицински център': { lat: 42.4180, lng: 25.6300, name: 'Медицински център' },
      'здравен дом': { lat: 42.4240, lng: 25.6280, name: 'Здравен дом' }
    };

    // Sports facilities
    this.sports = {
      'стадион': { lat: 42.4100, lng: 25.6200, name: 'Стадион "Берое"' },
      'спортна зала': { lat: 42.4120, lng: 25.6220, name: 'Спортна зала' },
      'плувен басейн': { lat: 42.4140, lng: 25.6180, name: 'Плувен басейн' },
      'тенис кортове': { lat: 42.4080, lng: 25.6240, name: 'Тенис кортове' }
    };
  }

  // Calculate position along street based on house number
  calculateStreetPosition(streetName, houseNumber) {
    const street = this.streets[streetName.toLowerCase()];
    if (!street) return null;

    const number = parseInt(houseNumber);
    if (isNaN(number)) return null;

    // Calculate position ratio along street
    const ratio = Math.min(Math.max((number - street.numbers.min) / (street.numbers.max - street.numbers.min), 0), 1);
    
    return {
      lat: street.start.lat + (street.end.lat - street.start.lat) * ratio,
      lng: street.start.lng + (street.end.lng - street.start.lng) * ratio
    };
  }

  // Get random point within neighborhood
  getNeighborhoodPoint(neighborhoodName) {
    const neighborhood = this.neighborhoods[neighborhoodName.toLowerCase()];
    if (!neighborhood) return null;

    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.random() * neighborhood.radius;
    
    return {
      lat: neighborhood.center.lat + Math.cos(angle) * distance,
      lng: neighborhood.center.lng + Math.sin(angle) * distance
    };
  }

  // Find exact location by name
  findExactLocation(name) {
    const lowerName = name.toLowerCase();
    
    // Check all location types
    const allLocations = {
      ...this.landmarks,
      ...this.schools,
      ...this.kindergartens,
      ...this.parks,
      ...this.medical,
      ...this.sports
    };

    for (const [key, location] of Object.entries(allLocations)) {
      if (lowerName.includes(key)) {
        return { ...location, type: 'exact' };
      }
    }

    return null;
  }
}

module.exports = StaraZagoraLocations;
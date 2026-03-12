/**
 * Overpass API Client
 * Fetches data from OpenStreetMap for Stara Zagora, Bulgaria
 * 
 * Data types: streets, buildings, bus stops, schools, hospitals, etc.
 */

const axios = require('axios');

// Overpass API endpoints (can use any of these)
const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
];

// Stara Zagora bounding box for location queries
const STARA_ZAGORA_BOUNDS = {
    south: 42.37,
    west: 25.58,
    north: 42.48,
    east: 25.72
};

// Stara Zagora area ID (for more accurate queries)
const STARA_ZAGORA_AREA_ID = 3415296; // OSM ID for Stara Zagora

class OverpassClient {
    constructor() {
        this.endpointIndex = 0;
        this.retryCount = 3;
        this.retryDelay = 2000;
    }

    /**
     * Get the current endpoint
     */
    getEndpoint() {
        return OVERPASS_ENDPOINTS[this.endpointIndex];
    }

    /**
     * Rotate to next endpoint
     */
    rotateEndpoint() {
        this.endpointIndex = (this.endpointIndex + 1) % OVERPASS_ENDPOINTS.length;
    }

    /**
     * Make request to Overpass API with retry logic
     */
    async makeRequest(query) {
        let lastError = null;
        
        for (let attempt = 0; attempt < this.retryCount; attempt++) {
            try {
                console.log(`      Attempt ${attempt + 1}: ${this.getEndpoint()}`);
                const response = await axios.post(
                    this.getEndpoint(),
                    `data=${encodeURIComponent(query)}`,
                    {
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Accept': 'application/json'
                        },
                        timeout: 30000
                    }
                );
                console.log(`      Success: ${response.data.elements?.length || 0} elements`);
                return response.data;
            } catch (error) {
                lastError = error;
                const status = error.response?.status;
                console.log(`      Failed (${status || 'no status'}): ${error.message}`);
                
                // If rate limited (429), wait longer
                if (status === 429) {
                    const waitTime = (attempt + 1) * 5000; // 5s, 10s, 15s
                    console.log(`      Rate limited, waiting ${waitTime/1000}s...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
                
                this.rotateEndpoint();
                
                if (attempt < this.retryCount - 1) {
                    await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                }
            }
        }
        
        throw new Error(`Overpass API failed after ${this.retryCount} attempts: ${lastError.message}`);
    }

    /**
     * Build bounding box string
     */
    buildBoundingBox() {
        return `${STARA_ZAGORA_BOUNDS.south},${STARA_ZAGORA_BOUNDS.west},${STARA_ZAGORA_BOUNDS.north},${STARA_ZAGORA_BOUNDS.east}`;
    }

    /**
     * Fetch all data types for Stara Zagora
     */
    async fetchAllData() {
        console.log('   Fetching from Overpass API (this may take 60-90 seconds)...');
        
        // Fetch with delays to avoid rate limiting
        const results = {};
        
        results.schools = await this.fetchSchools();
        await this.delay(3000);
        
        results.hospitals = await this.fetchHospitals();
        await this.delay(3000);
        
        results.libraries = await this.fetchLibraries();
        await this.delay(3000);
        
        results.busStops = await this.fetchBusStops();
        
        return results;
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Fetch streets/roads
     */
    async fetchStreets() {
        const query = `
            [out:json][timeout:60];
            (
                way["highway"~"primary|secondary|tertiary|residential|unclassified"](${this.buildBoundingBox()});
            );
            out body;
            >;
            out skel qt;
        `;
        
        const data = await this.makeRequest(query);
        return this.processWays(data, 'street');
    }

    /**
     * Fetch buildings
     */
    async fetchBuildings() {
        const query = `
            [out:json][timeout:60];
            (
                way["building"~"yes|house|apartments|commercial|public"](${this.buildBoundingBox()});
                relation["building"](${this.buildBoundingBox()});
            );
            out body;
            >;
            out skel qt;
        `;
        
        const data = await this.makeRequest(query);
        return this.processWays(data, 'building');
    }

    /**
     * Fetch bus stops
     */
    async fetchBusStops() {
        const query = `
            [out:json][timeout:60];
            (
                node["highway"="bus_stop"](${this.buildBoundingBox()});
                node["public_transport"="stop_position"](${this.buildBoundingBox()});
            );
            out body;
        `;
        
        const data = await this.makeRequest(query);
        return this.processNodes(data, 'bus_stop');
    }

    /**
     * Fetch schools
     */
    async fetchSchools() {
        const query = `
            [out:json][timeout:60];
            (
                node["amenity"="school"](${this.buildBoundingBox()});
                way["amenity"="school"](${this.buildBoundingBox()});
            );
            out body;
            >;
            out skel qt;
        `;
        
        const data = await this.makeRequest(query);
        const nodes = this.processNodes(data, 'school');
        const ways = this.processWays(data, 'school');
        return [...nodes, ...ways];
    }

    /**
     * Fetch hospitals and clinics
     */
    async fetchHospitals() {
        const query = `
            [out:json][timeout:60];
            (
                node["amenity"~"hospital|clinic|doctors"](${this.buildBoundingBox()});
                way["amenity"~"hospital|clinic|doctors"](${this.buildBoundingBox()});
            );
            out body;
            >;
            out skel qt;
        `;
        
        const data = await this.makeRequest(query);
        const nodes = this.processNodes(data, 'hospital');
        const ways = this.processWays(data, 'hospital');
        return [...nodes, ...ways];
    }

    /**
     * Fetch libraries
     */
    async fetchLibraries() {
        const query = `
            [out:json][timeout:60];
            (
                node["amenity"="library"](${this.buildBoundingBox()});
                way["amenity"="library"](${this.buildBoundingBox()});
            );
            out body;
            >;
            out skel qt;
        `;
        
        const data = await this.makeRequest(query);
        const nodes = this.processNodes(data, 'library');
        const ways = this.processWays(data, 'library');
        return [...nodes, ...ways];
    }

    /**
     * Fetch parks and green spaces
     */
    async fetchParks() {
        const query = `
            [out:json][timeout:60];
            (
                way["leisure"~"park|garden"](${this.buildBoundingBox()});
                relation["leisure"="park"](${this.buildBoundingBox()});
            );
            out body;
            >;
            out skel qt;
        `;
        
        const data = await this.makeRequest(query);
        return this.processWays(data, 'park');
    }

    /**
     * Fetch pharmacies
     */
    async fetchPharmacies() {
        const query = `
            [out:json][timeout:60];
            (
                node["amenity"="pharmacy"](${this.buildBoundingBox()});
            );
            out body;
        `;
        
        const data = await this.makeRequest(query);
        return this.processNodes(data, 'pharmacy');
    }

    /**
     * Process nodes from Overpass response
     */
    processNodes(data, dataType) {
        if (!data.elements) return [];
        
        return data.elements
            .filter(el => el.type === 'node')
            .map(el => ({
                osm_id: el.id,
                osm_type: 'node',
                data_type: dataType,
                name: el.tags?.name || el.tags?.['name:bg'] || null,
                tags: el.tags || {},
                lat: el.lat,
                lng: el.lon
            }));
    }

    /**
     * Process ways from Overpass response (get centroid for buildings)
     */
    processWays(data, dataType) {
        if (!data.elements) return [];
        
        const nodes = {};
        const ways = [];
        
        // First pass: collect all nodes
        data.elements.forEach(el => {
            if (el.type === 'node') {
                nodes[el.id] = { lat: el.lat, lon: el.lon };
            }
        });
        
        // Second pass: process ways
        data.elements.forEach(el => {
            if (el.type === 'way' && el.nodes && el.nodes.length > 0) {
                // Calculate centroid
                let latSum = 0, lngSum = 0;
                let validNodes = 0;
                
                el.nodes.forEach(nodeId => {
                    if (nodes[nodeId]) {
                        latSum += nodes[nodeId].lat;
                        lngSum += nodes[nodeId].lon;
                        validNodes++;
                    }
                });
                
                if (validNodes > 0) {
                    ways.push({
                        osm_id: el.id,
                        osm_type: 'way',
                        data_type: dataType,
                        name: el.tags?.name || el.tags?.['name:bg'] || null,
                        tags: el.tags || {},
                        lat: latSum / validNodes,
                        lng: lngSum / validNodes,
                        geometry: {
                            type: 'Polygon',
                            coordinates: [el.nodes.map(nid => [nodes[nid]?.lon || 0, nodes[nid]?.lat || 0])]
                        }
                    });
                }
            }
        });
        
        return ways;
    }

    /**
     * Fetch data for a specific type
     */
    async fetchByType(type) {
        const methods = {
            streets: () => this.fetchStreets(),
            buildings: () => this.fetchBuildings(),
            bus_stops: () => this.fetchBusStops(),
            schools: () => this.fetchSchools(),
            hospitals: () => this.fetchHospitals(),
            libraries: () => this.fetchLibraries(),
            parks: () => this.fetchParks(),
            pharmacies: () => this.fetchPharmacies()
        };
        
        if (!methods[type]) {
            throw new Error(`Unknown data type: ${type}`);
        }
        
        return methods[type]();
    }
}

module.exports = new OverpassClient();


/**
 * Geocoder Service
 * Uses Nominatim (OpenStreetMap) for free geocoding
 */

const axios = require('axios');

const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

class GeocoderService {
    constructor() {
        this.client = axios.create({
            baseURL: NOMINATIM_BASE_URL,
            timeout: 10000,
            headers: {
                'User-Agent': 'OpenZagora/1.0 (Municipal Transparency Dashboard)',
                'Accept': 'application/json'
            }
        });
        
        // Rate limiting: 1 request per second for Nominatim
        this.lastRequest = 0;
        this.minDelay = 1000;
    }

    /**
     * Rate-limited request
     */
    async rateLimitedRequest(fn) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequest;
        
        if (timeSinceLastRequest < this.minDelay) {
            await new Promise(resolve => 
                setTimeout(resolve, this.minDelay - timeSinceLastRequest)
            );
        }
        
        this.lastRequest = Date.now();
        return fn();
    }

    /**
     * Geocode an address to coordinates
     */
    async geocode(address) {
        if (!address) return null;
        
        try {
            const response = await this.rateLimitedRequest(() =>
                this.client.get('/search', {
                    params: {
                        q: address + ', Стара Загора, България',
                        format: 'json',
                        limit: 1,
                        addressdetails: 1
                    }
                })
            );
            
            if (response.data && response.data.length > 0) {
                const result = response.data[0];
                return {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    address: result.display_name,
                    type: result.type,
                    addressParts: result.address
                };
            }
            
            return null;
        } catch (error) {
            console.error(`Geocoding error for "${address}":`, error.message);
            return null;
        }
    }

    /**
     * Reverse geocode coordinates to address
     */
    async reverseGeocode(lat, lng) {
        try {
            const response = await this.rateLimitedRequest(() =>
                this.client.get('/reverse', {
                    params: {
                        lat,
                        lon: lng,
                        format: 'json',
                        addressdetails: 1
                    }
                })
            );
            
            if (response.data) {
                return {
                    address: response.data.display_name,
                    type: response.data.type,
                    addressParts: response.data.address
                };
            }
            
            return null;
        } catch (error) {
            console.error(`Reverse geocoding error for (${lat}, ${lng}):`, error.message);
            return null;
        }
    }

    /**
     * Geocode multiple addresses in batch
     */
    async geocodeBatch(addresses) {
        const results = [];
        
        for (const address of addresses) {
            const result = await this.geocode(address);
            results.push({
                input: address,
                result
            });
            
            // Small delay between batches of 10
            if (addresses.indexOf(address) % 10 === 9) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        return results;
    }

    /**
     * Search for places in Stara Zagora
     */
    async searchStaraZagora(query) {
        try {
            const response = await this.rateLimitedRequest(() =>
                this.client.get('/search', {
                    params: {
                        q: query + ', Стара Загора, България',
                        format: 'json',
                        limit: 10,
                        addressdetails: 1,
                        bounded: 1,
                        viewbox: '25.55,42.48,25.72,42.38' // Stara Zagora bounding box
                    }
                })
            );
            
            return response.data || [];
        } catch (error) {
            console.error(`Search error for "${query}":`, error.message);
            return [];
        }
    }

    /**
     * Get predefined locations in Stara Zagora
     */
    getKnownLocations() {
        return {
            'Стара Загора': { lat: 42.4257, lng: 25.6344 },
            'център': { lat: 42.4257, lng: 25.6344 },
            'кв. Казански': { lat: 42.4198, lng: 25.6421 },
            'кв. Зора': { lat: 42.4356, lng: 25.6189 },
            'кв. Тракия': { lat: 42.4423, lng: 25.6256 },
            'кв. Аязмото': { lat: 42.4089, lng: 25.6512 },
            'кв. Индустриална зона': { lat: 42.4456, lng: 25.6678 },
            'Железни врата': { lat: 42.3989, lng: 25.6123 },
            'Градински': { lat: 42.4323, lng: 25.6412 }
        };
    }

    /**
     * Try known locations first, then geocode
     */
    async geocodeWithFallback(address) {
        if (!address) return null;
        
        // Check known locations first
        const knownLocations = this.getKnownLocations();
        const lowerAddress = address.toLowerCase();
        
        for (const [key, coords] of Object.entries(knownLocations)) {
            if (lowerAddress.includes(key.toLowerCase())) {
                return {
                    lat: coords.lat,
                    lng: coords.lng,
                    address: key + ', Стара Загора',
                    type: 'known_location'
                };
            }
        }
        
        // Fall back to geocoding
        return await this.geocode(address);
    }
}

module.exports = new GeocoderService();


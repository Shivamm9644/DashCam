class GeocodingService {
    constructor() {
        this.cache = new Map();
        
        // Mock Address Database for Indore Route Simulation
        this.mockDb = [
            { lat: 22.719, lng: 75.857, address: "MG Road, Regal Square, Indore, Madhya Pradesh 452001" },
            { lat: 22.720, lng: 75.865, address: "Palasia Square, AB Road, Indore, Madhya Pradesh 452001" },
            { lat: 22.722, lng: 75.875, address: "LIG Square, AB Road, Indore, Madhya Pradesh 452011" },
            { lat: 22.724, lng: 75.885, address: "Vijay Nagar Square, Indore, Madhya Pradesh 452010" }
        ];
    }

    /**
     * Resolves an address from lat/lng using Local Mock DB.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<string>}
     */
    async resolveAddress(lat, lng) {
        const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Find nearest mock address
        let closest = this.mockDb[0];
        let minDistance = 999;
        
        for (const loc of this.mockDb) {
            const dist = Math.abs(loc.lat - lat) + Math.abs(loc.lng - lng);
            if (dist < minDistance) {
                minDistance = dist;
                closest = loc;
            }
        }

        let address = closest.address;
        
        // Add random house number for variety if it's not super close
        if (minDistance > 0.002) {
            address = `${Math.floor(Math.random() * 100) + 1}, ` + address;
        }

        this.cache.set(cacheKey, address);
        return address;
    }
}

module.exports = new GeocodingService();

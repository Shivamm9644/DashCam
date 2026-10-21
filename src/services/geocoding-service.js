class GeocodingService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Resolves an address from lat/lng using OpenStreetMap Reverse Geocoding.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<string>}
     */
    async resolveAddress(lat, lng) {
        if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return 'Awaiting GPS Fix';
        const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // Real coordinates anywhere in India: fetch reverse geocode or return high-precision GPS string
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
                headers: { 'User-Agent': 'DashCam-Fleet/2.0' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.display_name) {
                    const shortAddr = data.display_name.split(',').slice(0, 3).join(', ');
                    this.cache.set(cacheKey, shortAddr);
                    return shortAddr;
                }
            }
        } catch (e) {
            // Network fallback
        }

        const realGpsAddr = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
        this.cache.set(cacheKey, realGpsAddr);
        return realGpsAddr;
    }
}

module.exports = new GeocodingService();

class GeocodingService {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Resolves an address from lat/lng using BigDataCloud + OpenStreetMap Reverse Geocoding.
     * @param {number} lat 
     * @param {number} lng 
     * @returns {Promise<string>}
     */
    async resolveAddress(lat, lng) {
        if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return 'Awaiting GPS Fix';
        const numLat = parseFloat(lat);
        const numLng = parseFloat(lng);
        if (numLat === 0 && numLng === 0) return 'Awaiting GPS Fix (Searching Satellites)';

        const cacheKey = `${numLat.toFixed(4)},${numLng.toFixed(4)}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        // 1. Primary: BigDataCloud Free Reverse Geocoding (Ultra-fast, accurate locality/city/state in India)
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${numLat}&longitude=${numLng}&localityLanguage=en`, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                const parts = [
                    data.locality || data.localityInfo?.administrative?.[3]?.name,
                    data.city || data.localityInfo?.administrative?.[2]?.name,
                    data.principalSubdivision || data.localityInfo?.administrative?.[1]?.name,
                    data.countryName
                ].filter(Boolean);
                const uniqueParts = [...new Set(parts)];
                if (uniqueParts.length > 0) {
                    const addr = uniqueParts.join(', ');
                    this.cache.set(cacheKey, addr);
                    return addr;
                }
            }
        } catch (e) {
            // Fallback to OSM
        }

        // 2. Secondary: OpenStreetMap Nominatim
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${numLat}&lon=${numLng}`, {
                headers: { 'User-Agent': 'DashCam-FleetPlatform/2.4 (contact@inurum.com)' },
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
                const data = await res.json();
                if (data && data.address) {
                    const parts = [
                        data.address.road || data.address.suburb || data.address.neighbourhood,
                        data.address.city || data.address.town || data.address.village || data.address.county,
                        data.address.state
                    ].filter(Boolean);
                    if (parts.length > 0) {
                        const addr = parts.join(', ');
                        this.cache.set(cacheKey, addr);
                        return addr;
                    }
                }
                if (data && data.display_name) {
                    const shortAddr = data.display_name.split(',').slice(0, 3).map(s => s.trim()).join(', ');
                    this.cache.set(cacheKey, shortAddr);
                    return shortAddr;
                }
            }
        } catch (e) {
            // Network fallback
        }

        const realGpsAddr = `Lat: ${numLat.toFixed(6)}, Lng: ${numLng.toFixed(6)}`;
        this.cache.set(cacheKey, realGpsAddr);
        return realGpsAddr;
    }
}

module.exports = new GeocodingService();


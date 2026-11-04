/**
 * Geographic & Telemetry Calculation Engine
 * Implements standard Haversine great-circle distance and route segmentation.
 */

const EARTH_RADIUS_KM = 6371.0088; // WGS-84 Earth mean radius in kilometers

/**
 * Calculate great-circle distance between two points on Earth using the Haversine formula.
 * 
 * Formula:
 *   Δφ = (lat2 - lat1) in radians
 *   Δλ = (lon2 - lon1) in radians
 *   a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
 *   c = 2 * atan2(√a, √(1−a))
 *   d = R * c
 * 
 * @param {number} lat1 Latitude of point 1 in decimal degrees
 * @param {number} lon1 Longitude of point 1 in decimal degrees
 * @param {number} lat2 Latitude of point 2 in decimal degrees
 * @param {number} lon2 Longitude of point 2 in decimal degrees
 * @returns {number} Distance in kilometers
 */
function calculateHaversineDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const toRad = Math.PI / 180;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const deltaPhi = (lat2 - lat1) * toRad;
  const deltaLambda = (lon2 - lon1) * toRad;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate total accumulated distance along a sequence of GPS points.
 * Automatically skips points with missing coordinates or GPS drop gaps.
 * 
 * @param {Array<{lat: number, lng: number, isGap?: boolean}>} points GPS points
 * @returns {number} Total distance in kilometers
 */
function calculateTotalPathDistanceKm(points) {
  if (!points || points.length < 2) return 0;

  let totalKm = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    // Do not accumulate distance across marked satellite outage gaps
    if (p2.isGap) continue;

    if (p1 && p2 && p1.lat != null && p1.lng != null && p2.lat != null && p2.lng != null) {
      totalKm += calculateHaversineDistanceKm(p1.lat, p1.lng, p2.lat, p2.lng);
    }
  }

  return Math.round(totalKm * 100) / 100;
}

/**
 * Calculate compass bearing (heading in degrees 0..360) from point A to point B.
 */
function calculateBearing(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const y = Math.sin((lon2 - lon1) * toRad) * Math.cos(lat2 * toRad);
  const x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
            Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos((lon2 - lon1) * toRad);

  const brng = Math.atan2(y, x) * toDeg;
  return Math.round((brng + 360) % 360);
}

module.exports = {
  calculateHaversineDistanceKm,
  calculateTotalPathDistanceKm,
  calculateBearing,
  EARTH_RADIUS_KM
};

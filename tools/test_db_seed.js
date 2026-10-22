const db = require('../src/storage/db');
console.log('Total Trips:', db.getAllTrips().length);
const t = db.getAllTrips().find(x => x.tripId === 'TRIP-INDORE-01');
if (t) {
  console.log('TRIP-INDORE-01 found with', t.route ? t.route.length : 0, 'waypoints!');
} else {
  console.log('TRIP-INDORE-01 not found');
}

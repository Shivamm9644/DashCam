const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../storage/db');
const geocodingService = require('./geocoding-service');

class TripService {
    constructor() {
        this.activeTrips = new Map(); // vehicleId -> tripRecord
        this.initLocks = new Set(); // Prevent race conditions during async trip initialization
        this.baseStoragePath = config.TRIPS_DIR;

        // Restore existing trips from SQLite into active map on boot
        try {
            const existing = db.getAllTrips();
            for (const trip of existing) {
                if (!trip.endTime) {
                    this.activeTrips.set(trip.vehicleId, trip);
                }
            }
        } catch (e) {
            console.error('[TripService] Failed to preload trips from DB:', e.message);
        }
    }

    /**
     * Process incoming telemetry to manage trip lifecycle and stop detection.
     * Computes durations strictly from event timestamps, handling duplicates and late data.
     * @param {NormalizedTelemetry} telemetry 
     */
    async processTelemetry(telemetry) {
        const vehicleId = telemetry.vehicleId || `VEH-${telemetry.terminalId.slice(-4)}`;
        
        // 1. Concurrency-safe initialization
        if (!this.activeTrips.has(vehicleId)) {
            if (this.initLocks.has(vehicleId)) {
                // Another async operation is already initializing this vehicle's trip
                return;
            }
            this.initLocks.add(vehicleId);

            try {
                const startAddress = await geocodingService.resolveAddress(telemetry.latitude, telemetry.longitude);
                const tripId = `TRIP-${new Date(telemetry.timestamp).toISOString().slice(0, 10).replace(/-/g, '')}-${vehicleId}`;
                
                const newTrip = {
                    tripId: tripId,
                    vehicleId: vehicleId,
                    terminalId: telemetry.terminalId,
                    startTime: telemetry.timestamp,
                    endTime: null,
                    startAddress: startAddress,
                    endAddress: null,
                    metrics: {
                        totalDistanceKm: 0,
                        drivingTimeSec: 0,
                        stoppedTimeSec: 0,
                        maxSpeed: 0
                    },
                    stops: [],
                    route: [],
                    isSimulated: !!telemetry.isSimulated,
                    _lastPoint: telemetry,
                    _currentStopStart: null,
                    _currentStopDuration: 0,
                    _zeroSpeedCount: 0
                };

                this.activeTrips.set(vehicleId, newTrip);
            } finally {
                this.initLocks.delete(vehicleId);
            }
        }

        const trip = this.activeTrips.get(vehicleId);
        if (!trip) return;

        // 2. Compute delta from event timestamps
        const currentMs = new Date(telemetry.timestamp).getTime();
        const lastMs = trip._lastPoint ? new Date(trip._lastPoint.timestamp).getTime() : currentMs;
        const deltaMs = currentMs - lastMs;

        // Handle duplicates or out-of-order packets
        if (deltaMs <= 0 && trip.route.length > 0) {
            // Duplicate timestamp or out of order - do not add spurious time or distance
            return;
        }

        const deltaSec = trip.route.length === 0 ? 0 : Math.min(deltaMs / 1000, 30); // Cap at 30s to prevent huge jumps on disconnect

        // 3. Append to Route (sample every point or maximum 10,000 points per trip)
        trip.route.push({
            lat: telemetry.latitude,
            lng: telemetry.longitude,
            speed: telemetry.speed,
            time: telemetry.timestamp
        });

        // 4. Update Metrics
        if (telemetry.speed > trip.metrics.maxSpeed) {
            trip.metrics.maxSpeed = telemetry.speed;
        }

        if (trip._lastPoint && (telemetry.latitude !== trip._lastPoint.latitude || telemetry.longitude !== trip._lastPoint.longitude)) {
            // Haversine formula
            const R = 6371; // km
            const dLat = (telemetry.latitude - trip._lastPoint.latitude) * Math.PI / 180;
            const dLon = (telemetry.longitude - trip._lastPoint.longitude) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(trip._lastPoint.latitude * Math.PI / 180) * Math.cos(telemetry.latitude * Math.PI / 180) *
                      Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;
            if (!isNaN(distance) && distance > 0) {
                trip.metrics.totalDistanceKm += distance;
            }
        }

        // 5. Stop Detection Logic based on event timestamps
        if (telemetry.speed === 0) {
            trip._zeroSpeedCount++;
            trip.metrics.stoppedTimeSec += deltaSec;

            if (trip._zeroSpeedCount === 5) {
                // Confirmed Stop start
                trip._currentStopStart = trip._lastPoint.timestamp;
            }
        } else {
            // Vehicle is moving
            trip.metrics.drivingTimeSec += deltaSec;

            if (trip._zeroSpeedCount >= 5 && trip._currentStopStart) {
                // Vehicle just started moving after confirmed stop
                const stopAddress = await geocodingService.resolveAddress(trip._lastPoint.latitude, trip._lastPoint.longitude);
                const stopDurationSec = Math.round((currentMs - new Date(trip._currentStopStart).getTime()) / 1000);
                
                trip.stops.push({
                    startTime: trip._currentStopStart,
                    endTime: telemetry.timestamp,
                    durationSec: Math.max(1, stopDurationSec),
                    latitude: trip._lastPoint.latitude,
                    longitude: trip._lastPoint.longitude,
                    address: stopAddress
                });
            }
            trip._zeroSpeedCount = 0;
            trip._currentStopStart = null;
        }

        trip._lastPoint = telemetry;
        this.saveTrip(trip);
    }

    saveTrip(trip) {
        // Authoritative SQLite persistence
        db.upsertTrip(trip);

        // Periodic JSON export
        try {
            const filePath = path.join(this.baseStoragePath, `${trip.tripId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(trip, null, 2));
        } catch (e) {
            // Ignore minor disk write error
        }
    }

    getAllTrips() {
        return db.getAllTrips();
    }
}

module.exports = new TripService();

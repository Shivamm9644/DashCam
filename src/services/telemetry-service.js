const db = require('../storage/db');

class TelemetryService {
    constructor() {
        // terminalId -> Array of NormalizedTelemetry (recent in-memory cache)
        this.recentCache = new Map();
        this.MAX_RECENT_POINTS = 300; // ~5-10 minutes of active live points
    }

    /**
     * Add a new telemetry point to durable SQLite storage and recent in-memory cache.
     * @param {NormalizedTelemetry} telemetry 
     */
    addTelemetry(telemetry) {
        // 1. Authoritative durable persistence in SQLite
        db.insertTelemetry(telemetry);

        // 2. Rolling in-memory cache for fast live access
        if (!this.recentCache.has(telemetry.terminalId)) {
            this.recentCache.set(telemetry.terminalId, []);
        }

        const terminalHistory = this.recentCache.get(telemetry.terminalId);
        terminalHistory.push(telemetry);

        if (terminalHistory.length > this.MAX_RECENT_POINTS) {
            terminalHistory.shift();
        }
    }

    /**
     * Get recent telemetry history for a specific terminal.
     * @param {string} terminalId 
     * @returns {Array<NormalizedTelemetry>}
     */
    getHistory(terminalId) {
        if (this.recentCache.has(terminalId) && this.recentCache.get(terminalId).length > 0) {
            return this.recentCache.get(terminalId);
        }
        // Fallback to SQLite DB
        const rows = db.stmtGetTelemetryRange.all(terminalId, 0, Date.now() + 100000000);
        return rows.map(r => ({
            terminalId: r.terminal_id,
            vehicleId: r.vehicle_id,
            latitude: r.latitude,
            longitude: r.longitude,
            speed: r.speed,
            heading: r.heading,
            altitude: r.altitude,
            ignition: r.ignition === 1,
            timestamp: r.timestamp,
            alarmType: r.alarm_type,
            eventType: r.event_type,
            impactGForce: r.impact_gforce,
            isSimulated: r.is_simulated === 1,
            _sourceSerialNo: r.source_serial
        }));
    }

    /**
     * Query historical telemetry within a precise UTC time window.
     */
    getRange(terminalId, fromMs, toMs) {
        return db.getTelemetryRange(terminalId, fromMs, toMs).map(r => ({
            terminalId: r.terminal_id,
            vehicleId: r.vehicle_id,
            latitude: r.latitude,
            longitude: r.longitude,
            speed: r.speed,
            heading: r.heading,
            altitude: r.altitude,
            ignition: r.ignition === 1,
            timestamp: r.timestamp,
            alarmType: r.alarm_type,
            eventType: r.event_type,
            impactGForce: r.impact_gforce,
            isSimulated: r.is_simulated === 1
        }));
    }

    /**
     * Get telemetry point matching or immediately preceding a specific UTC millisecond timestamp.
     */
    getAtOrBefore(terminalId, timeMs) {
        const r = db.getTelemetryAtOrBefore(terminalId, timeMs);
        if (!r) return null;
        return {
            terminalId: r.terminal_id,
            vehicleId: r.vehicle_id,
            latitude: r.latitude,
            longitude: r.longitude,
            speed: r.speed,
            heading: r.heading,
            altitude: r.altitude,
            ignition: r.ignition === 1,
            timestamp: r.timestamp,
            timestampMs: r.timestamp_ms,
            alarmType: r.alarm_type,
            eventType: r.event_type,
            impactGForce: r.impact_gforce,
            isSimulated: r.is_simulated === 1
        };
    }

    getLatest(terminalId) {
        const r = db.getLatestTelemetry(terminalId);
        if (!r) return null;
        return {
            terminalId: r.terminal_id,
            vehicleId: r.vehicle_id,
            latitude: r.latitude,
            longitude: r.longitude,
            speed: r.speed,
            heading: r.heading,
            altitude: r.altitude,
            ignition: r.ignition === 1,
            timestamp: r.timestamp,
            alarmType: r.alarm_type,
            eventType: r.event_type,
            impactGForce: r.impact_gforce,
            isSimulated: r.is_simulated === 1
        };
    }

    getCount(terminalId) {
        return db.getTelemetryCount(terminalId);
    }
}

module.exports = new TelemetryService();

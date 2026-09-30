const config = require('../config');
const db = require('../storage/db');

class SyncService {
    /**
     * Resolve synchronized telemetry for a specific media presentation time.
     * @param {string} terminalId 
     * @param {number} mediaUtcMs Presentation timestamp in UTC milliseconds
     * @param {Object} options { toleranceMs, interpolate }
     */
    getTelemetryForMediaUtc(terminalId, mediaUtcMs, options = {}) {
        const toleranceMs = options.toleranceMs || config.MAX_SYNC_TOLERANCE_MS;
        const doInterpolate = options.interpolate !== undefined ? options.interpolate : true;

        // 1. Fetch telemetry at or immediately before media time
        const prev = db.getTelemetryAtOrBefore(terminalId, mediaUtcMs);

        if (!prev) {
            return {
                status: 'NO_DATA',
                message: 'No telemetry available at or before this media time',
                mediaUtcTime: new Date(mediaUtcMs).toISOString()
            };
        }

        const ageMs = mediaUtcMs - prev.timestamp_ms;
        const isStale = ageMs > toleranceMs;

        // Format times
        const displayTime = this.formatDisplayTime(prev.timestamp_ms, config.DISPLAY_TIMEZONE);
        const mediaDisplayTime = this.formatDisplayTime(mediaUtcMs, config.DISPLAY_TIMEZONE);

        // Check if interpolation is possible with next point
        let latitude = prev.latitude;
        let longitude = prev.longitude;
        let speed = prev.speed;
        let isInterpolated = false;

        if (doInterpolate && !isStale && ageMs > 50) {
            const nextRows = db.getTelemetryRange(terminalId, mediaUtcMs, mediaUtcMs + toleranceMs);
            if (nextRows && nextRows.length > 0) {
                const next = nextRows[0];
                const spanMs = next.timestamp_ms - prev.timestamp_ms;
                if (spanMs > 0 && spanMs <= toleranceMs) {
                    const ratio = ageMs / spanMs;
                    latitude = parseFloat((prev.latitude + (next.latitude - prev.latitude) * ratio).toFixed(6));
                    longitude = parseFloat((prev.longitude + (next.longitude - prev.longitude) * ratio).toFixed(6));
                    speed = parseFloat((prev.speed + (next.speed - prev.speed) * ratio).toFixed(1));
                    isInterpolated = true;
                }
            }
        }

        return {
            status: isStale ? 'STALE' : 'SYNCED',
            ageMs,
            isStale,
            isInterpolated,
            terminalId: prev.terminal_id,
            vehicleId: prev.vehicle_id,
            latitude,
            longitude,
            speed,
            heading: prev.heading,
            altitude: prev.altitude,
            ignition: prev.ignition === 1,
            alarmType: prev.alarm_type,
            eventType: prev.event_type,
            impactGForce: prev.impact_gforce,
            isSimulated: prev.is_simulated === 1,
            telemetryUtc: prev.timestamp,
            mediaUtc: new Date(mediaUtcMs).toISOString(),
            displayTime,
            mediaDisplayTime,
            displayTimeZone: config.DISPLAY_TIMEZONE
        };
    }

    formatDisplayTime(timeMs, timeZone) {
        try {
            return new Intl.DateTimeFormat('en-IN', {
                timeZone: timeZone || 'Asia/Kolkata',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            }).format(new Date(timeMs)) + ` (${timeZone || 'IST'})`;
        } catch (e) {
            return new Date(timeMs).toISOString();
        }
    }
}

module.exports = new SyncService();

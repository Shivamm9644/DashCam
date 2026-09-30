const NormalizedTelemetry = require('../../models/telemetry');

class MockParser {
    /**
     * Parses the mock JSON buffer into a NormalizedTelemetry object.
     * @param {Buffer} data 
     * @returns {NormalizedTelemetry | null}
     */
    parse(data) {
        try {
            const strData = data.toString('utf8');
            if(strData.startsWith('{')) {
                const payload = JSON.parse(strData);
                
                return new NormalizedTelemetry({
                    terminalId: payload.terminalId,
                    vehicleId: payload.vehicleId,
                    latitude: payload.lat || payload.latitude,
                    longitude: payload.lng || payload.longitude,
                    speed: payload.speed,
                    heading: payload.heading,
                    ignition: payload.ignition,
                    timestamp: payload.timestamp,
                    alarmType: payload.alarmType,
                    eventType: payload.eventType || payload.alert || 'NORMAL',
                    impactGForce: payload.impactGForce
                });
            }
        } catch (err) {
            console.error('[MockParser] Failed to parse payload:', err.message);
        }
        return null;
    }
}

module.exports = new MockParser();

class NormalizedTelemetry {
    constructor({ terminalId, vehicleId, latitude, longitude, speed, heading, ignition, timestamp, alarmType, eventType, impactGForce }) {
        this.terminalId = terminalId;
        this.vehicleId = vehicleId || terminalId; // Fallback
        this.latitude = parseFloat(latitude) || 0.0;
        this.longitude = parseFloat(longitude) || 0.0;
        this.speed = parseFloat(speed) || 0.0;
        this.heading = heading || 0;
        this.ignition = ignition !== undefined ? ignition : true;
        this.timestamp = timestamp || new Date().toISOString();
        
        // JT/T 808 specific or mock
        this.alarmType = alarmType || null; 
        this.eventType = eventType || 'NORMAL'; // NORMAL or ACCIDENT
        this.impactGForce = impactGForce || null;
    }
}

module.exports = NormalizedTelemetry;

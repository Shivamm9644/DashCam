const fs = require('fs');
const path = require('path');
const config = require('../config');
const db = require('../storage/db');
const wsService = require('./websocket-service');
const telemetryService = require('./telemetry-service');
const geocodingService = require('./geocoding-service');

class AccidentService {
    constructor() {
        this.accidents = new Map(); // accidentId -> record
        this.baseStoragePath = config.ACCIDENTS_DIR;

        // Restore historical accidents on startup from SQLite and disk metadata
        this.restoreAccidentsOnBoot();
    }

    restoreAccidentsOnBoot() {
        // 1. From SQLite
        try {
            const dbAccidents = db.getAllAccidents();
            for (const acc of dbAccidents) {
                this.accidents.set(acc.accidentId, acc);
            }
        } catch (e) {
            console.error('[AccidentService] Failed to load accidents from DB:', e.message);
        }

        // 2. From Disk files (syncing legacy metadata into DB)
        try {
            if (fs.existsSync(this.baseStoragePath)) {
                const files = fs.readdirSync(this.baseStoragePath);
                for (const f of files) {
                    if (f.endsWith('.json')) {
                        try {
                            const raw = fs.readFileSync(path.join(this.baseStoragePath, f), 'utf8');
                            const record = JSON.parse(raw);
                            if (record.accidentId && !this.accidents.has(record.accidentId)) {
                                // Clean legacy BigBuckBunny links
                                if (record.evidence && record.evidence.frontCamera && record.evidence.frontCamera.includes('BigBuckBunny')) {
                                    record.evidence.frontCamera = null;
                                }
                                this.accidents.set(record.accidentId, record);
                                db.upsertAccident(record);
                            }
                        } catch (err) {}
                    }
                }
            }
        } catch (e) {
            console.error('[AccidentService] Failed to load legacy accident files:', e.message);
        }
    }

    /**
     * Process an incoming NormalizedTelemetry event that is flagged as an ACCIDENT.
     * @param {NormalizedTelemetry} telemetry 
     */
    async processAccident(telemetry) {
        if (telemetry.eventType !== 'ACCIDENT') return;

        const eventTimeMs = new Date(telemetry.timestamp).getTime();
        const dateStr = new Date(telemetry.timestamp).toISOString().slice(0, 10).replace(/-/g, '');
        const randomId = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        const accidentId = `ACC-${dateStr}-${randomId}`;

        // 1. Historical telemetry window (30s before to event time)
        const windowFromMs = eventTimeMs - 30000;
        const history = telemetryService.getRange(telemetry.terminalId, windowFromMs, eventTimeMs + 5000);

        // 2. Determine previous speed
        let previousSpeed = telemetry.speed;
        if (history.length > 2) {
            previousSpeed = history[history.length - 3].speed;
        }

        // 3. Resolve Media Evidence from SQLite
        const matchingSeg = db.getSegmentAtTime(telemetry.terminalId, 1, eventTimeMs);
        let mediaUrl = null;
        let mediaStartMs = eventTimeMs - 3000;

        if (matchingSeg) {
            mediaUrl = matchingSeg.mp4_clip_url || matchingSeg.hls_segment_url;
            mediaStartMs = matchingSeg.start_utc_ms;
        }

        // 4. Generate synchronized timeline based on actual media-time mapping (not raw array index)
        const timeline = history.map((item) => {
            const itemMs = new Date(item.timestamp).getTime();
            const realVideoOffsetSec = Math.max(0, parseFloat(((itemMs - mediaStartMs) / 1000).toFixed(2)));
            return {
                timestamp: item.timestamp.split('T')[1]?.substring(0, 8) || item.timestamp,
                videoOffset: realVideoOffsetSec,
                latitude: item.latitude,
                longitude: item.longitude,
                speed: item.speed,
                heading: item.heading,
                event: item.eventType
            };
        });

        // Resolve Address
        const address = await geocodingService.resolveAddress(telemetry.latitude, telemetry.longitude);

        // 5. Build Accident Record (honestly preserve alarm type and null G-force)
        const accidentRecord = {
            accidentId: accidentId,
            terminalId: telemetry.terminalId,
            vehicleId: telemetry.vehicleId || `VEH-${telemetry.terminalId.slice(-4)}`,
            vehicleNumber: `MOCK-${telemetry.terminalId.substring(0, 4)}`,
            timestamp: telemetry.timestamp,
            location: {
                latitude: telemetry.latitude,
                longitude: telemetry.longitude,
                address: address
            },
            speedAtImpact: telemetry.speed,
            previousSpeed: previousSpeed,
            heading: telemetry.heading,
            ignition: telemetry.ignition,
            impactGForce: telemetry.impactGForce !== undefined ? telemetry.impactGForce : null, // Never invent fake 4.5
            alarmType: telemetry.alarmType || 'COLLISION_WARNING',
            status: matchingSeg ? 'VERIFIED' : 'PENDING_MEDIA',
            isSimulated: !!telemetry.isSimulated,
            evidence: {
                frontCamera: mediaUrl, // Real local media clip or null
                cabinCamera: null,
                audio: null
            },
            timeline: timeline
        };

        // 6. Store Accident in Memory and SQLite
        this.accidents.set(accidentId, accidentRecord);
        db.upsertAccident(accidentRecord);
        this.saveAccidentToDisk(accidentRecord);

        // 7. Broadcast Alert to Dashboard
        console.log(`[AccidentService] Registered Accident: ${accidentId} for ${telemetry.terminalId} [Type: ${accidentRecord.alarmType}]`);
        wsService.emit('accident_alert', accidentRecord);
    }

    /**
     * Attach newly encoded media segment to any awaiting accident records in the segment's timeframe.
     */
    linkMediaToAccidents(terminalId, channel, segment) {
        for (const [id, acc] of this.accidents.entries()) {
            if (acc.terminalId === terminalId && (!acc.evidence.frontCamera || acc.status === 'PENDING_MEDIA')) {
                const accMs = new Date(acc.timestamp).getTime();
                if (accMs >= segment.startUtcMs && accMs < segment.endUtcMs) {
                    acc.evidence.frontCamera = segment.mp4ClipUrl || segment.hlsSegmentUrl;
                    acc.status = 'VERIFIED';
                    acc.timeline=telemetryService.getRange(terminalId,segment.startUtcMs,segment.endUtcMs-1).map(item=>({timestamp:item.timestamp,videoOffset:(Date.parse(item.timestamp)-segment.startUtcMs)/1000,latitude:item.latitude,longitude:item.longitude,speed:item.speed,heading:item.heading,event:item.eventType}));
                    db.upsertAccident(acc);
                    this.saveAccidentToDisk(acc);
                    console.log(`[AccidentService] Linked media segment ${segment.segmentId} to accident ${acc.accidentId}`);
                }
            }
        }
    }

    saveAccidentToDisk(record) {
        try {
            const filePath = path.join(this.baseStoragePath, `${record.accidentId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
        } catch (e) {
            console.error('[AccidentService] Failed to save accident metadata to disk:', e.message);
        }
    }

    getAllAccidents() {
        return Array.from(this.accidents.values()).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    getAccidentById(id) {
        return this.accidents.get(id) || null;
    }
}

module.exports = new AccidentService();

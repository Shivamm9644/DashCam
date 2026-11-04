
const path = require('path');
const config = require('../config');

/**
 * Safety Service
 * Manages safety incidents, driver coaching triage, dual-camera video review,
 * and hardware alarms (Collision, Harsh Braking, Acceleration, Overspeed, SOS).
 */
class SafetyService {
    constructor({ db, wsService }) {
        this.db = db;
        this.wsService = wsService;
        this._initSchema();
    }

    _initSchema() {
        try {
            // Check if accidents table has triage columns
            const cols = this.db.db.prepare("PRAGMA table_info(accidents)").all();
            const colNames = cols.map(c => c.name);

            if (!colNames.includes('triage_status')) {
                this.db.db.exec("ALTER TABLE accidents ADD COLUMN triage_status TEXT DEFAULT 'NEEDS_REVIEW'");
            }
            if (!colNames.includes('coaching_notes')) {
                this.db.db.exec("ALTER TABLE accidents ADD COLUMN coaching_notes TEXT");
            }
            if (!colNames.includes('coached_by')) {
                this.db.db.exec("ALTER TABLE accidents ADD COLUMN coached_by TEXT");
            }
            if (!colNames.includes('coached_at')) {
                this.db.db.exec("ALTER TABLE accidents ADD COLUMN coached_at TEXT");
            }
            if (!colNames.includes('severity')) {
                this.db.db.exec("ALTER TABLE accidents ADD COLUMN severity TEXT DEFAULT 'CRITICAL'");
            }
            console.log('[SAFETY_SERVICE] Schema verified for triage and coaching inbox.');
        } catch (e) {
            console.error('[SAFETY_SERVICE] Schema check error:', e.message);
        }
    }

    getIncidents({ severity, type, status, terminalId, offset = 0, limit = 50 }) {
        try {
            let sql = 'SELECT * FROM accidents WHERE 1=1';
            const params = [];

            if (terminalId && terminalId !== 'ALL') {
                sql += ' AND terminal_id = ?';
                params.push(String(terminalId).trim());
            }
            if (severity && severity !== 'ALL') {
                sql += ' AND severity = ?';
                params.push(severity);
            }
            if (type && type !== 'ALL') {
                sql += ' AND alarm_type LIKE ?';
                params.push(`%${type}%`);
            }
            if (status && status !== 'ALL') {
                sql += ' AND triage_status = ?';
                params.push(status);
            }

            sql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const rows = this.db.db.prepare(sql).all(...params);

            return rows.map(r => {
                let evidence = {};
                try { evidence = JSON.parse(r.evidence_json || '{}'); } catch (_) {}

                return {
                    id: r.accident_id,
                    terminalId: r.terminal_id,
                    vehiclePlate: r.vehicle_number || ('MH-12-AP-' + r.terminal_id.slice(-4)),
                    driverName: r.driver_name || 'Assigned Driver',
                    type: r.alarm_type || 'COLLISION_WARNING',
                    severity: r.severity || 'CRITICAL',
                    status: r.triage_status || 'NEEDS_REVIEW',
                    timestamp: r.timestamp,
                    lat: r.latitude,
                    lng: r.longitude,
                    address: r.address || 'Highway Segment',
                    speed: r.speed_at_impact || 0,
                    media: {
                        ch1Url: evidence.frontCamera || `/media/live/${r.terminal_id}_1/live.m3u8`,
                        ch2Url: evidence.cabinCamera || `/media/live/${r.terminal_id}_2/live.m3u8`,
                        hasDualCam: Boolean(evidence.frontCamera && evidence.cabinCamera)
                    },
                    coachingNotes: r.coaching_notes || '',
                    coachedBy: r.coached_by || null,
                    coachedAt: r.coached_at || null
                };
            });
        } catch (e) {
            console.error('[SAFETY_SERVICE] Error listing incidents:', e.message);
            return [];
        }
    }

    getIncidentById(id) {
        try {
            const r = this.db.db.prepare('SELECT * FROM accidents WHERE accident_id = ?').get(id);
            if (!r) return null;

            let evidence = {};
            try { evidence = JSON.parse(r.evidence_json || '{}'); } catch (_) {}

            return {
                id: r.accident_id,
                terminalId: r.terminal_id,
                vehiclePlate: r.vehicle_number || ('MH-12-AP-' + r.terminal_id.slice(-4)),
                driverName: r.driver_name || 'Assigned Driver',
                type: r.alarm_type || 'COLLISION_WARNING',
                severity: r.severity || 'CRITICAL',
                status: r.triage_status || 'NEEDS_REVIEW',
                timestamp: r.timestamp,
                lat: r.latitude,
                lng: r.longitude,
                address: r.address || 'Highway Segment',
                speed: r.speed_at_impact || 0,
                media: {
                    ch1Url: evidence.frontCamera || `/media/live/${r.terminal_id}_1/live.m3u8`,
                    ch2Url: evidence.cabinCamera || `/media/live/${r.terminal_id}_2/live.m3u8`,
                    hasDualCam: Boolean(evidence.frontCamera && evidence.cabinCamera)
                },
                coachingNotes: r.coaching_notes || '',
                coachedBy: r.coached_by || null,
                coachedAt: r.coached_at || null,
                telemetryPoints: [
                    { timeOffsetSec: -4, speed: Math.max(0, (r.speed_at_impact || 50) + 12) },
                    { timeOffsetSec: -3, speed: Math.max(0, (r.speed_at_impact || 50) + 8) },
                    { timeOffsetSec: -2, speed: Math.max(0, (r.speed_at_impact || 50) + 4) },
                    { timeOffsetSec: -1, speed: (r.speed_at_impact || 50) },
                    { timeOffsetSec: 0, speed: Math.max(0, (r.speed_at_impact || 50) - 15) },
                    { timeOffsetSec: 1, speed: Math.max(0, (r.speed_at_impact || 50) - 30) },
                    { timeOffsetSec: 2, speed: 0 }
                ]
            };
        } catch (e) {
            console.error('[SAFETY_SERVICE] Error getting incident:', e.message);
            return null;
        }
    }

    reviewIncident(id, { status = 'COACHED', notes = '', coachedBy = 'Fleet Manager' }) {
        try {
            const nowIso = new Date().toISOString();
            this.db.db.prepare(`
                UPDATE accidents
                SET triage_status = ?, coaching_notes = ?, coached_by = ?, coached_at = ?
                WHERE accident_id = ?
            `).run(status, notes, coachedBy, nowIso, id);

            console.log(`[SAFETY_SERVICE] Incident ${id} marked as ${status} by ${coachedBy}`);

            this.wsService.emit('incident_reviewed', {
                id,
                status,
                coachedBy,
                coachedAt: nowIso
            });

            return this.getIncidentById(id);
        } catch (e) {
            console.error('[SAFETY_SERVICE] Review error:', e.message);
            throw e;
        }
    }
}

module.exports = SafetyService;

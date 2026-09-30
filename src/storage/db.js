const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const config = require('../config');

// Ensure storage directories exist
if (!fs.existsSync(config.STORAGE_DIR)) {
    fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
}
if (!fs.existsSync(config.MEDIA_DIR)) {
    fs.mkdirSync(config.MEDIA_DIR, { recursive: true });
}
if (!fs.existsSync(config.TRIPS_DIR)) {
    fs.mkdirSync(config.TRIPS_DIR, { recursive: true });
}
if (!fs.existsSync(config.ACCIDENTS_DIR)) {
    fs.mkdirSync(config.ACCIDENTS_DIR, { recursive: true });
}

class DatabaseManager {
    constructor() {
        this.db = new DatabaseSync(config.DB_PATH);
        this.initSchema();
        this.prepareStatements();
    }

    initSchema() {
        // WAL mode for fast concurrency
        this.db.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE IF NOT EXISTS telemetry (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                terminal_id TEXT NOT NULL,
                vehicle_id TEXT NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                speed REAL NOT NULL,
                heading REAL NOT NULL,
                altitude REAL DEFAULT 0,
                ignition INTEGER NOT NULL,
                timestamp TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                alarm_type TEXT,
                event_type TEXT DEFAULT 'NORMAL',
                impact_gforce REAL,
                is_simulated INTEGER DEFAULT 0,
                source_serial INTEGER,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_telemetry_terminal_time ON telemetry (terminal_id, timestamp_ms);
            CREATE INDEX IF NOT EXISTS idx_telemetry_event ON telemetry (terminal_id, event_type);

            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                terminal_id TEXT NOT NULL,
                channel INTEGER NOT NULL,
                start_time_utc TEXT NOT NULL,
                start_time_ms INTEGER NOT NULL,
                end_time_utc TEXT,
                end_time_ms INTEGER,
                anchor_utc_ms INTEGER,
                anchor_pts_ms INTEGER,
                status TEXT DEFAULT 'ACTIVE',
                is_simulated INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_sessions_terminal_ch ON sessions (terminal_id, channel);

            CREATE TABLE IF NOT EXISTS media_segments (
                segment_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                terminal_id TEXT NOT NULL,
                channel INTEGER NOT NULL,
                seq_num INTEGER NOT NULL,
                start_pts_ms INTEGER NOT NULL,
                end_pts_ms INTEGER NOT NULL,
                start_utc_ms INTEGER NOT NULL,
                end_utc_ms INTEGER NOT NULL,
                duration_sec REAL NOT NULL,
                file_path TEXT NOT NULL,
                hls_segment_url TEXT,
                mp4_clip_url TEXT,
                thumbnail_url TEXT,
                has_audio INTEGER DEFAULT 0,
                is_keyframe INTEGER DEFAULT 1,
                status TEXT DEFAULT 'READY',
                is_simulated INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_media_term_time ON media_segments (terminal_id, channel, start_utc_ms, end_utc_ms);
            CREATE INDEX IF NOT EXISTS idx_media_session ON media_segments (session_id, seq_num);

            CREATE TABLE IF NOT EXISTS accidents (
                accident_id TEXT PRIMARY KEY,
                terminal_id TEXT NOT NULL,
                vehicle_id TEXT NOT NULL,
                vehicle_number TEXT,
                timestamp TEXT NOT NULL,
                timestamp_ms INTEGER NOT NULL,
                latitude REAL NOT NULL,
                longitude REAL NOT NULL,
                address TEXT,
                speed_at_impact REAL NOT NULL,
                previous_speed REAL NOT NULL,
                heading REAL NOT NULL,
                ignition INTEGER NOT NULL,
                impact_gforce REAL,
                alarm_type TEXT NOT NULL,
                status TEXT DEFAULT 'NEW',
                evidence_json TEXT,
                timeline_json TEXT,
                is_simulated INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_accidents_terminal ON accidents (terminal_id, timestamp_ms);

            CREATE TABLE IF NOT EXISTS trips (
                trip_id TEXT PRIMARY KEY,
                vehicle_id TEXT NOT NULL,
                terminal_id TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                start_address TEXT,
                end_address TEXT,
                metrics_json TEXT,
                stops_json TEXT,
                route_json TEXT,
                is_simulated INTEGER DEFAULT 0,
                updated_at TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_trips_vehicle ON trips (vehicle_id, start_time);
        `);
    }

    prepareStatements() {
        // Telemetry
        this.stmtInsertTelemetry = this.db.prepare(`
            INSERT INTO telemetry (
                terminal_id, vehicle_id, latitude, longitude, speed, heading, altitude,
                ignition, timestamp, timestamp_ms, alarm_type, event_type, impact_gforce,
                is_simulated, source_serial, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        this.stmtGetTelemetryAtOrBefore = this.db.prepare(`
            SELECT * FROM telemetry
            WHERE terminal_id = ? AND timestamp_ms <= ?
            ORDER BY timestamp_ms DESC
            LIMIT 1
        `);

        this.stmtGetTelemetryRange = this.db.prepare(`
            SELECT * FROM telemetry
            WHERE terminal_id = ? AND timestamp_ms >= ? AND timestamp_ms <= ?
            ORDER BY timestamp_ms ASC
        `);

        this.stmtGetLatestTelemetry = this.db.prepare(`
            SELECT * FROM telemetry
            WHERE terminal_id = ?
            ORDER BY timestamp_ms DESC
            LIMIT 1
        `);

        this.stmtCountTelemetry = this.db.prepare(`
            SELECT COUNT(*) as count FROM telemetry WHERE terminal_id = ?
        `);

        // Sessions
        this.stmtUpsertSession = this.db.prepare(`
            INSERT INTO sessions (
                session_id, terminal_id, channel, start_time_utc, start_time_ms,
                end_time_utc, end_time_ms, anchor_utc_ms, anchor_pts_ms, status, is_simulated, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                end_time_utc = excluded.end_time_utc,
                end_time_ms = excluded.end_time_ms,
                anchor_utc_ms = COALESCE(sessions.anchor_utc_ms, excluded.anchor_utc_ms),
                anchor_pts_ms = COALESCE(sessions.anchor_pts_ms, excluded.anchor_pts_ms),
                status = excluded.status
        `);

        this.stmtGetActiveSession = this.db.prepare(`
            SELECT * FROM sessions
            WHERE terminal_id = ? AND channel = ? AND status = 'ACTIVE'
            ORDER BY start_time_ms DESC
            LIMIT 1
        `);

        this.stmtGetSession = this.db.prepare(`
            SELECT * FROM sessions WHERE session_id = ?
        `);

        // Media Segments
        this.stmtInsertSegment = this.db.prepare(`
            INSERT INTO media_segments (
                segment_id, session_id, terminal_id, channel, seq_num,
                start_pts_ms, end_pts_ms, start_utc_ms, end_utc_ms, duration_sec,
                file_path, hls_segment_url, mp4_clip_url, thumbnail_url,
                has_audio, is_keyframe, status, is_simulated, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(segment_id) DO UPDATE SET
                duration_sec = excluded.duration_sec,
                end_pts_ms = excluded.end_pts_ms,
                end_utc_ms = excluded.end_utc_ms,
                hls_segment_url = excluded.hls_segment_url,
                mp4_clip_url = excluded.mp4_clip_url,
                thumbnail_url = excluded.thumbnail_url,
                status = excluded.status
        `);

        this.stmtGetSegmentsForReels = this.db.prepare(`
            SELECT * FROM media_segments
            WHERE terminal_id = ? AND channel = ? AND is_simulated = 0
            ORDER BY start_utc_ms ASC
        `);

        this.stmtGetSegmentAtTime = this.db.prepare(`
            SELECT * FROM media_segments
            WHERE terminal_id = ? AND channel = ? AND start_utc_ms <= ? AND end_utc_ms >= ?
            ORDER BY start_utc_ms DESC
            LIMIT 1
        `);

        // Accidents
        this.stmtUpsertAccident = this.db.prepare(`
            INSERT INTO accidents (
                accident_id, terminal_id, vehicle_id, vehicle_number, timestamp, timestamp_ms,
                latitude, longitude, address, speed_at_impact, previous_speed, heading,
                ignition, impact_gforce, alarm_type, status, evidence_json, timeline_json,
                is_simulated, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(accident_id) DO UPDATE SET
                evidence_json = excluded.evidence_json,
                timeline_json = excluded.timeline_json,
                status = excluded.status
        `);

        this.stmtGetAllAccidents = this.db.prepare(`
            SELECT * FROM accidents
            ORDER BY timestamp_ms DESC
        `);

        // Trips
        this.stmtUpsertTrip = this.db.prepare(`
            INSERT INTO trips (
                trip_id, vehicle_id, terminal_id, start_time, end_time,
                start_address, end_address, metrics_json, stops_json, route_json,
                is_simulated, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(trip_id) DO UPDATE SET
                end_time = excluded.end_time,
                end_address = excluded.end_address,
                metrics_json = excluded.metrics_json,
                stops_json = excluded.stops_json,
                route_json = excluded.route_json,
                updated_at = excluded.updated_at
        `);

        this.stmtGetAllTrips = this.db.prepare(`
            SELECT * FROM trips
            ORDER BY start_time DESC
        `);
    }

    // --- Telemetry Methods ---
    insertTelemetry(t) {
        const timeMs = new Date(t.timestamp).getTime();
        return this.stmtInsertTelemetry.run(
            t.terminalId,
            t.vehicleId || `VEH-${t.terminalId.slice(-4)}`,
            t.latitude,
            t.longitude,
            t.speed,
            t.heading,
            t.altitude || 0,
            t.ignition ? 1 : 0,
            t.timestamp,
            timeMs,
            t.alarmType || null,
            t.eventType || 'NORMAL',
            t.impactGForce !== undefined ? t.impactGForce : null,
            t.isSimulated ? 1 : 0,
            t._sourceSerialNo || 0,
            new Date().toISOString()
        );
    }

    getTelemetryAtOrBefore(terminalId, timeMs) {
        return this.stmtGetTelemetryAtOrBefore.get(terminalId, timeMs);
    }

    getTelemetryRange(terminalId, fromMs, toMs) {
        return this.stmtGetTelemetryRange.all(terminalId, fromMs, toMs);
    }

    getLatestTelemetry(terminalId) {
        return this.stmtGetLatestTelemetry.get(terminalId);
    }

    getTelemetryCount(terminalId) {
        const row = this.stmtCountTelemetry.get(terminalId);
        return row ? row.count : 0;
    }

    // --- Session Methods ---
    upsertSession(session) {
        const now = new Date().toISOString();
        return this.stmtUpsertSession.run(
            session.sessionId,
            session.terminalId,
            session.channel || 1,
            session.startTimeUtc,
            new Date(session.startTimeUtc).getTime(),
            session.endTimeUtc || null,
            session.endTimeUtc ? new Date(session.endTimeUtc).getTime() : null,
            session.anchorUtcMs || null,
            session.anchorPtsMs || null,
            session.status || 'ACTIVE',
            session.isSimulated ? 1 : 0,
            now
        );
    }

    getActiveSession(terminalId, channel = 1) {
        return this.stmtGetActiveSession.get(terminalId, channel);
    }

    getSession(sessionId) {
        return this.stmtGetSession.get(sessionId);
    }

    // --- Media Segment Methods ---
    insertSegment(seg) {
        const now = new Date().toISOString();
        return this.stmtInsertSegment.run(
            seg.segmentId,
            seg.sessionId,
            seg.terminalId,
            seg.channel || 1,
            seg.seqNum,
            seg.startPtsMs,
            seg.endPtsMs,
            seg.startUtcMs,
            seg.endUtcMs,
            seg.durationSec,
            seg.filePath,
            seg.hlsSegmentUrl || null,
            seg.mp4ClipUrl || null,
            seg.thumbnailUrl || null,
            seg.hasAudio ? 1 : 0,
            seg.isKeyframe ? 1 : 0,
            seg.status || 'READY',
            seg.isSimulated ? 1 : 0,
            now
        );
    }

    getSegmentsForReels(terminalId, channel = 1) {
        return this.stmtGetSegmentsForReels.all(terminalId, channel);
    }

    getSegmentAtTime(terminalId, channel, timeMs) {
        return this.stmtGetSegmentAtTime.get(terminalId, channel, timeMs, timeMs);
    }

    // --- Accident Methods ---
    upsertAccident(acc) {
        const now = new Date().toISOString();
        const timeMs = new Date(acc.timestamp).getTime();
        return this.stmtUpsertAccident.run(
            acc.accidentId,
            acc.terminalId,
            acc.vehicleId,
            acc.vehicleNumber || `MOCK-${acc.terminalId.slice(-4)}`,
            acc.timestamp,
            timeMs,
            acc.location ? acc.location.latitude : acc.latitude,
            acc.location ? acc.location.longitude : acc.longitude,
            acc.location ? acc.location.address : acc.address || '',
            acc.speedAtImpact,
            acc.previousSpeed,
            acc.heading,
            acc.ignition ? 1 : 0,
            acc.impactGForce !== undefined ? acc.impactGForce : null,
            acc.alarmType,
            acc.status || 'NEW',
            JSON.stringify(acc.evidence || {}),
            JSON.stringify(acc.timeline || []),
            acc.isSimulated ? 1 : 0,
            now
        );
    }

    getAllAccidents() {
        const rows = this.stmtGetAllAccidents.all();
        return rows.map(r => ({
            accidentId: r.accident_id,
            terminalId: r.terminal_id,
            vehicleId: r.vehicle_id,
            vehicleNumber: r.vehicle_number,
            timestamp: r.timestamp,
            location: {
                latitude: r.latitude,
                longitude: r.longitude,
                address: r.address
            },
            speedAtImpact: r.speed_at_impact,
            previousSpeed: r.previous_speed,
            heading: r.heading,
            ignition: r.ignition === 1,
            impactGForce: r.impact_gforce,
            alarmType: r.alarm_type,
            status: r.status,
            evidence: JSON.parse(r.evidence_json || '{}'),
            timeline: JSON.parse(r.timeline_json || '[]'),
            isSimulated: r.is_simulated === 1
        }));
    }

    // --- Trip Methods ---
    upsertTrip(trip) {
        const now = new Date().toISOString();
        return this.stmtUpsertTrip.run(
            trip.tripId,
            trip.vehicleId,
            trip.terminalId,
            trip.startTime,
            trip.endTime || null,
            trip.startAddress || '',
            trip.endAddress || null,
            JSON.stringify(trip.metrics || {}),
            JSON.stringify(trip.stops || []),
            JSON.stringify(trip.route || []),
            trip.isSimulated ? 1 : 0,
            now
        );
    }

    getAllTrips() {
        const rows = this.stmtGetAllTrips.all();
        return rows.map(r => ({
            tripId: r.trip_id,
            vehicleId: r.vehicle_id,
            terminalId: r.terminal_id,
            startTime: r.start_time,
            endTime: r.end_time,
            startAddress: r.start_address,
            endAddress: r.end_address,
            metrics: JSON.parse(r.metrics_json || '{}'),
            stops: JSON.parse(r.stops_json || '[]'),
            route: JSON.parse(r.route_json || '[]'),
            isSimulated: r.is_simulated === 1
        }));
    }

    close() {
        this.db.close();
    }
}

module.exports = new DatabaseManager();

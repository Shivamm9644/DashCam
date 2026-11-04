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

            CREATE TABLE IF NOT EXISTS devices (
                device_id TEXT PRIMARY KEY,
                vehicle_no TEXT NOT NULL,
                device_type TEXT DEFAULT 'MDVR (Dual Cam)',
                status TEXT DEFAULT 'Online',
                sim_no TEXT DEFAULT '-',
                firmware TEXT DEFAULT 'v1.2.6',
                last_online TEXT,
                last_lat REAL,
                last_lng REAL,
                last_speed REAL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS drivers (
                driver_id TEXT PRIMARY KEY,
                vehicle_no TEXT NOT NULL,
                driver_name TEXT NOT NULL,
                phone TEXT,
                vehicle_type TEXT,
                status TEXT DEFAULT 'Active',
                last_active TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS geofences (
                geofence_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                type TEXT NOT NULL,
                location TEXT,
                area TEXT,
                vehicles INTEGER DEFAULT 0,
                status INTEGER DEFAULT 1,
                is_restricted INTEGER DEFAULT 0,
                coords_json TEXT,
                center_json TEXT,
                radius REAL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tenants (
                tenant_id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                slug TEXT NOT NULL UNIQUE,
                plan TEXT DEFAULT 'Enterprise Cloud',
                status TEXT DEFAULT 'ACTIVE',
                seats_limit INTEGER DEFAULT 50,
                storage_limit_gb INTEGER DEFAULT 500,
                storage_used_gb REAL DEFAULT 14.2,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS api_keys (
                key_id TEXT PRIMARY KEY,
                tenant_id TEXT NOT NULL,
                name TEXT NOT NULL,
                api_key TEXT NOT NULL UNIQUE,
                scope TEXT DEFAULT 'read:write',
                last_used TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS users (
                user_id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                role TEXT NOT NULL CHECK(role IN ('superadmin', 'admin', 'user')),
                tenant_id TEXT DEFAULT 'tenant_inurum_global',
                status TEXT DEFAULT 'ACTIVE',
                last_login TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tags (
                entity_id TEXT PRIMARY KEY,
                tag_value TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS asset_tags (
                asset_id TEXT NOT NULL,
                tag_value TEXT NOT NULL,
                PRIMARY KEY (asset_id, tag_value)
            );

            CREATE TABLE IF NOT EXISTS asset_configs (
                asset_id TEXT PRIMARY KEY,
                override_fleet_settings INTEGER DEFAULT 1,
                ignition_off_standby_delay INTEGER DEFAULT 300,
                road_cam_enable INTEGER DEFAULT 1,
                road_cam_quality TEXT DEFAULT 'Standard Quality',
                driver_audio_enable INTEGER DEFAULT 0,
                driver_cam_enable INTEGER DEFAULT 1,
                driver_cam_quality TEXT DEFAULT 'Extended Storage',
                safety_config_json TEXT,
                updated_at TEXT NOT NULL
            );
        `);

        // Seed default tenants if none exist
        const tenantCount = this.db.prepare(`SELECT COUNT(*) as count FROM tenants`).get().count;
        if (tenantCount === 0) {
            const now = new Date().toISOString();
            const insertTenant = this.db.prepare(`
                INSERT INTO tenants (tenant_id, name, slug, plan, status, seats_limit, storage_limit_gb, storage_used_gb, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            insertTenant.run('tenant_inurum_global', 'Inurum Logistics (Global HQ)', 'inurum-global', 'Enterprise Cloud', 'ACTIVE', 50, 500, 14.2, now);
            insertTenant.run('tenant_north_hub', 'North Region Fleet Hub', 'inurum-north', 'Pro Fleet', 'ACTIVE', 20, 200, 38.6, now);
            insertTenant.run('tenant_west_depot', 'Western Express Depot', 'inurum-west', 'Starter Fleet', 'ACTIVE', 10, 50, 8.1, now);
        }

        // Seed default enterprise API keys if none exist
        const keyCount = this.db.prepare(`SELECT COUNT(*) as count FROM api_keys`).get().count;
        if (keyCount === 0) {
            const now = new Date().toISOString();
            const insertKey = this.db.prepare(`
                INSERT INTO api_keys (key_id, tenant_id, name, api_key, scope, last_used, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            insertKey.run('key_prod_telematics', 'tenant_inurum_global', 'ERP Telematics Dispatch Key', 'sk_live_inurum_9a4f21b380ed5c48', 'telematics:stream', 'Just now', now);
            insertKey.run('key_mobile_dashcam', 'tenant_inurum_global', 'Mobile Dashcam Driver Key', 'sk_live_inurum_3c87e10df65241b9', 'dashcam:read', '10 mins ago', now);
        }

        // Seed default 3 roles (superadmin, admin, user) if none exist
        const userCount = this.db.prepare(`SELECT COUNT(*) as count FROM users`).get().count;
        if (userCount === 0) {
            const now = new Date().toISOString();
            const insertUser = this.db.prepare(`
                INSERT INTO users (user_id, username, password, full_name, email, role, tenant_id, status, last_login, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            // 1. Super Admin: full control over SaaS workspaces, billing, api keys, settings & all fleets
            insertUser.run('usr_superadmin', 'superadmin', 'password', 'System SuperAdmin', 'superadmin@inurum.com', 'superadmin', 'tenant_inurum_global', 'ACTIVE', 'Active Session', now);
            // 2. Admin: fleet & video operations, safety monitoring, reports, driver/device management
            insertUser.run('usr_admin', 'admin', 'password', 'Fleet Operations Admin', 'admin@inurum.com', 'admin', 'tenant_inurum_global', 'ACTIVE', 'Yesterday, 18:30', now);
            // 3. User: operational viewing & monitoring only
            insertUser.run('usr_user', 'user', 'password', 'Fleet Dispatcher', 'user@inurum.com', 'user', 'tenant_inurum_global', 'ACTIVE', '2 hours ago', now);
        }

        // Seed default tags if none exist
        const tagCount = this.db.prepare(`SELECT COUNT(*) as count FROM tags`).get().count;
        if (tagCount === 0) {
            const now = new Date().toISOString();
            const insertTag = this.db.prepare(`INSERT INTO tags (entity_id, tag_value, created_at) VALUES (?, ?, ?)`);
            insertTag.run('tag1', 'maintenance-due', now);
            insertTag.run('tag2', 'high_value_asset', now);
        }
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
            WHERE terminal_id = ? AND channel = ?
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

        // Devices
        this.stmtUpsertDevice = this.db.prepare(`
            INSERT INTO devices (
                device_id, vehicle_no, device_type, status, sim_no, firmware,
                last_online, last_lat, last_lng, last_speed, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET
                vehicle_no = COALESCE(excluded.vehicle_no, devices.vehicle_no),
                device_type = COALESCE(excluded.device_type, devices.device_type),
                status = excluded.status,
                sim_no = COALESCE(excluded.sim_no, devices.sim_no),
                firmware = COALESCE(excluded.firmware, devices.firmware),
                last_online = excluded.last_online,
                last_lat = COALESCE(excluded.last_lat, devices.last_lat),
                last_lng = COALESCE(excluded.last_lng, devices.last_lng),
                last_speed = COALESCE(excluded.last_speed, devices.last_speed),
                updated_at = excluded.updated_at
        `);

        this.stmtGetAllDevices = this.db.prepare(`
            SELECT * FROM devices ORDER BY updated_at DESC
        `);

        this.stmtGetDevice = this.db.prepare(`
            SELECT * FROM devices WHERE device_id = ?
        `);

        this.stmtDeleteDevice = this.db.prepare(`
            DELETE FROM devices WHERE device_id = ?
        `);

        // Drivers
        this.stmtGetAllDrivers = this.db.prepare(`
            SELECT * FROM drivers ORDER BY created_at DESC
        `);

        this.stmtUpsertDriver = this.db.prepare(`
            INSERT INTO drivers (driver_id, vehicle_no, driver_name, phone, vehicle_type, status, last_active, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(driver_id) DO UPDATE SET
                vehicle_no = excluded.vehicle_no,
                driver_name = excluded.driver_name,
                phone = excluded.phone,
                vehicle_type = excluded.vehicle_type,
                status = excluded.status,
                last_active = excluded.last_active
        `);

        // Geofences
        this.stmtGetAllGeofences = this.db.prepare(`
            SELECT * FROM geofences ORDER BY created_at DESC
        `);

        this.stmtUpsertGeofence = this.db.prepare(`
            INSERT INTO geofences (geofence_id, name, type, location, area, vehicles, status, is_restricted, coords_json, center_json, radius, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(geofence_id) DO UPDATE SET
                name = excluded.name,
                type = excluded.type,
                location = excluded.location,
                area = excluded.area,
                vehicles = excluded.vehicles,
                status = excluded.status,
                is_restricted = excluded.is_restricted,
                coords_json = excluded.coords_json,
                center_json = excluded.center_json,
                radius = excluded.radius
        `);

        // SaaS Tenants
        this.stmtGetAllTenants = this.db.prepare(`
            SELECT * FROM tenants ORDER BY created_at ASC
        `);

        this.stmtGetTenant = this.db.prepare(`
            SELECT * FROM tenants WHERE tenant_id = ?
        `);

        this.stmtUpdateTenant = this.db.prepare(`
            UPDATE tenants SET name = ?, plan = ?, seats_limit = ?, storage_limit_gb = ?, storage_used_gb = ?
            WHERE tenant_id = ?
        `);

        // SaaS API Keys
        this.stmtGetAllApiKeys = this.db.prepare(`
            SELECT * FROM api_keys WHERE tenant_id = ? ORDER BY created_at DESC
        `);

        this.stmtInsertApiKey = this.db.prepare(`
            INSERT INTO api_keys (key_id, tenant_id, name, api_key, scope, last_used, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        this.stmtDeleteApiKey = this.db.prepare(`
            DELETE FROM api_keys WHERE key_id = ?
        `);

        // Users & Roles (SuperAdmin, Admin, User)
        this.stmtGetUserByUsername = this.db.prepare(`
            SELECT * FROM users WHERE username = ?
        `);

        this.stmtGetUserById = this.db.prepare(`
            SELECT * FROM users WHERE user_id = ?
        `);

        this.stmtGetAllUsers = this.db.prepare(`
            SELECT user_id, username, full_name, email, role, tenant_id, status, last_login, created_at FROM users ORDER BY created_at ASC
        `);

        this.stmtInsertUser = this.db.prepare(`
            INSERT INTO users (user_id, username, password, full_name, email, role, tenant_id, status, last_login, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        this.stmtUpdateUser = this.db.prepare(`
            UPDATE users SET full_name = ?, email = ?, role = ?, status = ? WHERE user_id = ?
        `);

        this.stmtDeleteUser = this.db.prepare(`
            DELETE FROM users WHERE user_id = ?
        `);

        this.stmtUpdateUserLastLogin = this.db.prepare(`
            UPDATE users SET last_login = ? WHERE user_id = ?
        `);

        // Roadeazy Tags & Asset Configs
        this.stmtGetAllTags = this.db.prepare(`SELECT entity_id as entityId, tag_value as tagValue, created_at as createdAt FROM tags ORDER BY created_at ASC`);
        this.stmtInsertTag = this.db.prepare(`INSERT INTO tags (entity_id, tag_value, created_at) VALUES (?, ?, ?)`);
        this.stmtUpdateTag = this.db.prepare(`UPDATE tags SET tag_value = ? WHERE entity_id = ?`);
        this.stmtDeleteTag = this.db.prepare(`DELETE FROM tags WHERE entity_id = ?`);
        this.stmtGetAssetTags = this.db.prepare(`SELECT tag_value FROM asset_tags WHERE asset_id = ?`);
        this.stmtClearAssetTags = this.db.prepare(`DELETE FROM asset_tags WHERE asset_id = ?`);
        this.stmtAddAssetTag = this.db.prepare(`INSERT OR IGNORE INTO asset_tags (asset_id, tag_value) VALUES (?, ?)`);
        this.stmtGetAssetConfig = this.db.prepare(`SELECT * FROM asset_configs WHERE asset_id = ?`);
        this.stmtUpsertAssetConfig = this.db.prepare(`
            INSERT INTO asset_configs (asset_id, override_fleet_settings, ignition_off_standby_delay, road_cam_enable, road_cam_quality, driver_audio_enable, driver_cam_enable, driver_cam_quality, safety_config_json, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(asset_id) DO UPDATE SET
                override_fleet_settings = excluded.override_fleet_settings,
                ignition_off_standby_delay = excluded.ignition_off_standby_delay,
                road_cam_enable = excluded.road_cam_enable,
                road_cam_quality = excluded.road_cam_quality,
                driver_audio_enable = excluded.driver_audio_enable,
                driver_cam_enable = excluded.driver_cam_enable,
                driver_cam_quality = excluded.driver_cam_quality,
                safety_config_json = excluded.safety_config_json,
                updated_at = excluded.updated_at
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

    // --- Device Methods ---
    upsertDevice(dev) {
        const now = new Date().toISOString();
        return this.stmtUpsertDevice.run(
            dev.deviceId,
            dev.vehicleNo || `VEH-${dev.deviceId.slice(-4)}`,
            dev.deviceType || 'MDVR (Dual Cam)',
            dev.status || 'Online',
            dev.simNo || '-',
            dev.firmware || 'v1.2.6',
            dev.lastOnline || now,
            dev.lastLat !== undefined ? dev.lastLat : null,
            dev.lastLng !== undefined ? dev.lastLng : null,
            dev.lastSpeed !== undefined ? dev.lastSpeed : null,
            now,
            now
        );
    }

    touchDevice(deviceId, extra = {}) {
        const now = new Date().toISOString();
        return this.stmtUpsertDevice.run(
            deviceId,
            extra.vehicleNo || `VEH-${deviceId.slice(-4)}`,
            extra.deviceType || 'MDVR (Dual Cam)',
            extra.status || 'Online',
            extra.simNo || '-',
            extra.firmware || 'v1.2.6',
            now,
            extra.latitude !== undefined ? extra.latitude : null,
            extra.longitude !== undefined ? extra.longitude : null,
            extra.speed !== undefined ? extra.speed : null,
            now,
            now
        );
    }

    getAllDevices() {
        const rows = this.stmtGetAllDevices.all();
        return rows.map(r => ({
            deviceId: r.device_id,
            vehicleNo: r.vehicle_no,
            deviceType: r.device_type,
            status: r.status,
            simNo: r.sim_no,
            firmware: r.firmware,
            lastOnline: r.last_online,
            latitude: r.last_lat,
            longitude: r.last_lng,
            speed: r.last_speed
        }));
    }

    getDevice(deviceId) {
        const r = this.stmtGetDevice.get(deviceId);
        if (!r) return null;
        return {
            deviceId: r.device_id,
            vehicleNo: r.vehicle_no,
            deviceType: r.device_type,
            status: r.status,
            simNo: r.sim_no,
            firmware: r.firmware,
            lastOnline: r.last_online,
            latitude: r.last_lat,
            longitude: r.last_lng,
            speed: r.last_speed
        };
    }

    deleteDevice(deviceId) {
        this.stmtDeleteDevice.run(deviceId);
        return true;
    }

    // --- Driver Methods ---
    getAllDrivers() {
        const rows = this.stmtGetAllDrivers.all();
        return rows.map(r => ({
            driverId: r.driver_id,
            vehicleNo: r.vehicle_no,
            driverName: r.driver_name,
            phone: r.phone,
            vehicleType: r.vehicle_type,
            status: r.status,
            lastActive: r.last_active
        }));
    }

    upsertDriver(dr) {
        const now = new Date().toISOString();
        return this.stmtUpsertDriver.run(
            dr.driverId || `DRV-${Date.now()}`,
            dr.vehicleNo || 'Unassigned',
            dr.driverName,
            dr.phone || '',
            dr.vehicleType || 'Truck',
            dr.status || 'Active',
            dr.lastActive || now,
            now
        );
    }

    // --- Geofence Methods ---
    getAllGeofences() {
        const rows = this.stmtGetAllGeofences.all();
        return rows.map(r => ({
            id: r.geofence_id,
            name: r.name,
            type: r.type,
            location: r.location,
            area: r.area,
            vehicles: r.vehicles,
            status: r.status === 1,
            isRestricted: r.is_restricted === 1,
            coords: r.coords_json ? JSON.parse(r.coords_json) : null,
            center: r.center_json ? JSON.parse(r.center_json) : null,
            radius: r.radius
        }));
    }

    upsertGeofence(geo) {
        const now = new Date().toISOString();
        return this.stmtUpsertGeofence.run(
            geo.id || `geo-${Date.now()}`,
            geo.name,
            geo.type || 'Polygon',
            geo.location || '',
            geo.area || '',
            geo.vehicles || 0,
            geo.status ? 1 : 0,
            geo.isRestricted ? 1 : 0,
            geo.coords ? JSON.stringify(geo.coords) : null,
            geo.center ? JSON.stringify(geo.center) : null,
            geo.radius || null,
            now
        );
    }

    // --- SaaS Multi-Tenant & API Key Methods ---
    getAllTenants() {
        const rows = this.stmtGetAllTenants.all();
        return rows.map(r => ({
            id: r.tenant_id,
            name: r.name,
            slug: r.slug,
            plan: r.plan,
            status: r.status,
            seatsLimit: r.seats_limit,
            storageLimitGb: r.storage_limit_gb,
            storageUsedGb: r.storage_used_gb,
            createdAt: r.created_at
        }));
    }

    getTenant(tenantId) {
        const r = this.stmtGetTenant.get(tenantId);
        if (!r) return null;
        return {
            id: r.tenant_id,
            name: r.name,
            slug: r.slug,
            plan: r.plan,
            status: r.status,
            seatsLimit: r.seats_limit,
            storageLimitGb: r.storage_limit_gb,
            storageUsedGb: r.storage_used_gb,
            createdAt: r.created_at
        };
    }

    updateTenant(tenantId, fields = {}) {
        const current = this.getTenant(tenantId);
        if (!current) return false;
        const name = fields.name !== undefined ? fields.name : current.name;
        const plan = fields.plan !== undefined ? fields.plan : current.plan;
        const seatsLimit = fields.seatsLimit !== undefined ? fields.seatsLimit : current.seatsLimit;
        const storageLimitGb = fields.storageLimitGb !== undefined ? fields.storageLimitGb : current.storageLimitGb;
        const storageUsedGb = fields.storageUsedGb !== undefined ? fields.storageUsedGb : current.storageUsedGb;
        this.stmtUpdateTenant.run(name, plan, seatsLimit, storageLimitGb, storageUsedGb, tenantId);
        return this.getTenant(tenantId);
    }

    getAllApiKeys(tenantId = 'tenant_inurum_global') {
        const rows = this.stmtGetAllApiKeys.all(tenantId);
        return rows.map(r => ({
            id: r.key_id,
            tenantId: r.tenant_id,
            name: r.name,
            apiKey: r.api_key,
            scope: r.scope,
            lastUsed: r.last_used,
            createdAt: r.created_at
        }));
    }

    createApiKey(tenantId = 'tenant_inurum_global', name = 'Default API Key', scope = 'telematics:stream') {
        const crypto = require('crypto');
        const keyId = `key_${Date.now()}`;
        const apiKey = `sk_live_inurum_${crypto.randomBytes(12).toString('hex')}`;
        const now = new Date().toISOString();
        this.stmtInsertApiKey.run(keyId, tenantId, name, apiKey, scope, 'Never', now);
        return {
            id: keyId,
            tenantId,
            name,
            apiKey,
            scope,
            lastUsed: 'Never',
            createdAt: now
        };
    }

    deleteApiKey(keyId) {
        return this.stmtDeleteApiKey.run(keyId);
    }

    getSaasMetrics(tenantId = 'tenant_inurum_global') {
        let tenant = this.getTenant(tenantId);
        if (!tenant) {
            const all = this.getAllTenants();
            tenant = all[0] || {
                id: 'tenant_inurum_global',
                name: 'Inurum Logistics (Global HQ)',
                slug: 'inurum-global',
                plan: 'Enterprise Cloud',
                seatsLimit: 50,
                storageLimitGb: 500,
                storageUsedGb: 14.2
            };
        }
        const devices = this.getAllDevices();
        const apiKeys = this.getAllApiKeys(tenant.id);
        const storagePercent = Math.min(100, Math.round((tenant.storageUsedGb / tenant.storageLimitGb) * 100));

        return {
            activeTenant: tenant,
            allTenants: this.getAllTenants(),
            usage: {
                storageUsedGb: tenant.storageUsedGb,
                storageLimitGb: tenant.storageLimitGb,
                storagePercent: storagePercent,
                activeStreams: devices.filter(d => d.status === 'Online').length || 1,
                seatsLimit: tenant.seatsLimit,
                totalVehicles: devices.length,
                totalApiKeys: apiKeys.length
            }
        };
    }

    // --- User & RBAC Methods (superadmin, admin, user) ---
    authenticateUser(username, password) {
        if (!username || !password) return null;
        const row = this.stmtGetUserByUsername.get(username);
        if (!row || row.password !== password) return null;
        
        // Update last login timestamp
        const nowStr = new Date().toLocaleString();
        this.stmtUpdateUserLastLogin.run(nowStr, row.user_id);
        
        return {
            id: row.user_id,
            username: row.username,
            fullName: row.full_name,
            email: row.email,
            role: row.role, // 'superadmin' | 'admin' | 'user'
            tenantId: row.tenant_id,
            status: row.status,
            lastLogin: nowStr
        };
    }

    getAllUsers() {
        const rows = this.stmtGetAllUsers.all();
        return rows.map(r => ({
            id: r.user_id,
            username: r.username,
            fullName: r.full_name,
            email: r.email,
            role: r.role,
            tenantId: r.tenant_id,
            status: r.status,
            lastLogin: r.last_login,
            createdAt: r.created_at
        }));
    }

    createUser(data) {
        const userId = `usr_${Date.now()}`;
        const now = new Date().toISOString();
        const role = ['superadmin', 'admin', 'user'].includes(data.role) ? data.role : 'user';
        this.stmtInsertUser.run(
            userId,
            data.username,
            data.password || 'password',
            data.fullName || data.username,
            data.email || `${data.username}@inurum.com`,
            role,
            data.tenantId || 'tenant_inurum_global',
            data.status || 'ACTIVE',
            'Never',
            now
        );
        return {
            id: userId,
            username: data.username,
            fullName: data.fullName || data.username,
            email: data.email || `${data.username}@inurum.com`,
            role,
            tenantId: data.tenantId || 'tenant_inurum_global',
            status: data.status || 'ACTIVE',
            lastLogin: 'Never',
            createdAt: now
        };
    }

    updateUser(userId, data) {
        const role = ['superadmin', 'admin', 'user'].includes(data.role) ? data.role : 'user';
        this.stmtUpdateUser.run(data.fullName, data.email, role, data.status || 'ACTIVE', userId);
        return true;
    }

    deleteUser(userId) {
        // Protect primary superadmin from deletion
        if (userId === 'usr_superadmin') return false;
        this.stmtDeleteUser.run(userId);
        return true;
    }

    getUserById(userId) {
        const r = this.stmtGetUserById.get(userId);
        if (!r) return null;
        return {
            id: r.user_id,
            username: r.username,
            fullName: r.full_name,
            email: r.email,
            role: r.role,
            tenantId: r.tenant_id,
            status: r.status,
            lastLogin: r.last_login,
            createdAt: r.created_at
        };
    }

    // --- Roadeazy Tags & Asset Config Methods ---
    getAllTags() {
        return this.stmtGetAllTags.all();
    }

    createTag(tagValue) {
        const entityId = `tag_${Date.now()}`;
        const now = new Date().toISOString();
        this.stmtInsertTag.run(entityId, tagValue, now);
        return { entityId, tagValue, createdAt: now };
    }

    updateTag(entityId, tagValue) {
        this.stmtUpdateTag.run(tagValue, entityId);
        return { entityId, tagValue };
    }

    deleteTag(entityId) {
        this.stmtDeleteTag.run(entityId);
        return true;
    }

    getAssetTags(assetId) {
        return this.stmtGetAssetTags.all(assetId).map(r => r.tag_value);
    }

    setAssetTags(assetId, tags) {
        this.stmtClearAssetTags.run(assetId);
        if (Array.isArray(tags)) {
            for (const t of tags) {
                if (t && typeof t === 'string') {
                    this.stmtAddAssetTag.run(assetId, t.trim());
                }
            }
        }
        return this.getAssetTags(assetId);
    }

    getAssetConfig(assetId) {
        const row = this.stmtGetAssetConfig.get(assetId);
        if (!row) {
            return {
                overrideFleetSettings: true,
                ignitionOffStandbyDelay: 300,
                roadCamEnable: true,
                roadCamQuality: 'Standard Quality',
                driverAudioEnable: false,
                driverCamEnable: true,
                driverCamQuality: 'Extended Storage',
                safetyConfig: {
                    audioMode: 1,
                    harshBraking: { enabled: true },
                    harshAcceleration: { enabled: true },
                    driverDistracted: { audibleAlert: true, triggerNotification: 1 },
                    tailgating: { audibleAlert: false, triggerNotification: 2 }
                }
            };
        }
        let safetyConfig = null;
        try {
            safetyConfig = row.safety_config_json ? JSON.parse(row.safety_config_json) : null;
        } catch (_) {}
        return {
            overrideFleetSettings: Boolean(row.override_fleet_settings),
            ignitionOffStandbyDelay: row.ignition_off_standby_delay,
            roadCamEnable: Boolean(row.road_cam_enable),
            roadCamQuality: row.road_cam_quality,
            driverAudioEnable: Boolean(row.driver_audio_enable),
            driverCamEnable: Boolean(row.driver_cam_enable),
            driverCamQuality: row.driver_cam_quality,
            safetyConfig: safetyConfig || {
                audioMode: 1,
                harshBraking: { enabled: true },
                harshAcceleration: { enabled: true },
                driverDistracted: { audibleAlert: true, triggerNotification: 1 },
                tailgating: { audibleAlert: false, triggerNotification: 2 }
            }
        };
    }

    updateAssetConfig(assetId, config, safetyConfig) {
        const current = this.getAssetConfig(assetId);
        const mergedConfig = { ...current, ...(config || {}) };
        const mergedSafety = safetyConfig !== undefined ? safetyConfig : current.safetyConfig;
        const now = new Date().toISOString();

        this.stmtUpsertAssetConfig.run(
            assetId,
            mergedConfig.overrideFleetSettings ? 1 : 0,
            mergedConfig.ignitionOffStandbyDelay !== undefined ? Number(mergedConfig.ignitionOffStandbyDelay) : 300,
            mergedConfig.roadCamEnable ? 1 : 0,
            mergedConfig.roadCamQuality || 'Standard Quality',
            mergedConfig.driverAudioEnable ? 1 : 0,
            mergedConfig.driverCamEnable ? 1 : 0,
            mergedConfig.driverCamQuality || 'Extended Storage',
            mergedSafety ? JSON.stringify(mergedSafety) : null,
            now
        );
        return this.getAssetConfig(assetId);
    }

    close() {
        this.db.close();
    }
}

module.exports = new DatabaseManager();

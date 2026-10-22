const net = require('net');
const dgram = require('dgram');
const express = require('express');
const http = require('http');
const path = require('path');
const config = require('./config');

// Persistence & DB
const db = require('./storage/db');

// Services
const wsService = require('./services/websocket-service');
const telemetryService = require('./services/telemetry-service');
const accidentService = require('./services/accident-service');
const tripService = require('./services/trip-service');
const syncService = require('./services/sync-service');
const storageService = require('./services/storage-service');
const geocodingService = require('./services/geocoding-service');

// Protocols
const binaryParser = require('./protocols/jtt808/binary-parser');
const binaryEncoder = require('./protocols/jtt808/binary-encoder');
const mediaHandler = require('./protocols/jtt1078/media-handler');
const mediaParser = require('./protocols/jtt1078/media-parser');

// Simulator
const simulator = require('./simulator/engine');

// Roadeazy Public API Router
const createRoadeazyRouter = require('./routes/roadeazy-api');

// ==========================================
// 1. Express API & WebSocket Server
// ==========================================
const app = express();
const cors = require('cors');
app.use(cors());
const server = http.createServer(app);

app.use(express.json());
app.use('/vendor/hls', express.static(path.dirname(require.resolve('hls.js/dist/hls.min.js'))));
app.use('/vendor/leaflet', express.static(path.dirname(require.resolve('leaflet/dist/leaflet.js'))));

// Serve Front-End Dashboard (HTML/CSS/JS)
app.use(express.static(path.join(__dirname, '../public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve Static Assets & Reconstructed Media
app.use('/media', express.static(config.MEDIA_DIR, {
    setHeaders(res, file) {
        if (file.endsWith('.m3u8')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.setHeader('Access-Control-Allow-Origin', '*');
        } else if (file.endsWith('.ts')) {
            res.setHeader('Cache-Control', 'public, max-age=10');
            res.setHeader('Access-Control-Allow-Origin', '*');
        }
    }
}));

// Initialize WebSocket Service
wsService.init(server);

// --- Authentication & User Management (superadmin, admin, user) ---
let activeUserSession = {
    id: 'usr_superadmin',
    username: 'superadmin',
    fullName: 'System SuperAdmin',
    email: 'superadmin@inurum.com',
    role: 'superadmin',
    tenantId: 'tenant_inurum_global'
};

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};

    // First attempt DB authentication
    let user = db.authenticateUser(username, password);

    // Backward-compatibility fallback for config admin credentials
    if (!user && username === config.ADMIN_USER && password === config.ADMIN_PASS) {
        user = {
            id: 'usr_admin',
            username: config.ADMIN_USER,
            fullName: 'Fleet Operations Admin',
            email: 'admin@inurum.com',
            role: 'admin',
            tenantId: 'tenant_inurum_global',
            status: 'ACTIVE',
            lastLogin: new Date().toLocaleString()
        };
    }

    if (user) {
        activeUserSession = user;
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                role: user.role, // 'superadmin' | 'admin' | 'user'
                tenantId: user.tenantId,
                status: user.status,
                lastLogin: user.lastLogin
            },
            token: `token-${user.role}-${Date.now()}`
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid username or password' });
    }
});

app.get('/api/auth/me', (req, res) => {
    res.json({ authenticated: true, user: activeUserSession });
});

app.get('/api/users', (req, res) => {
    res.json(db.getAllUsers());
});

app.post('/api/users', (req, res) => {
    const { username, password, fullName, email, role } = req.body || {};
    if (!username) return res.status(400).json({ error: 'username is required' });
    const newUser = db.createUser({ username, password, fullName, email, role });
    res.json({ success: true, user: newUser });
});

app.put('/api/users/:id', (req, res) => {
    db.updateUser(req.params.id, req.body || {});
    res.json({ success: true });
});

app.delete('/api/users/:id', (req, res) => {
    const success = db.deleteUser(req.params.id);
    if (!success) {
        return res.status(400).json({ error: 'Cannot delete primary superadmin' });
    }
    res.json({ success: true });
});

// --- System Status ---
app.get('/api/status', (req, res) => {
    const os = require('os');
    const nets = os.networkInterfaces();
    let localIp = '127.0.0.1';
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                localIp = net.address;
                break;
            }
        }
    }
    const publicIp = config.MEDIA_SERVER_IP || '100.31.90.51';
    res.json({
        status: "online",
        serverIp: publicIp,
        publicIp: publicIp,
        localIp: localIp,
        ports: {
            web: config.API_PORT,
            jt808: config.JT808_PORT,
            jt1078: config.JT1078_PORT
        },
        timezones: {
            device: config.DEVICE_TIMEZONE,
            display: config.DISPLAY_TIMEZONE
        },
        database: "SQLite (Authoritative)",
        recordingMode: config.RECORDING_MODE,
        codecs: {
            video: ["H.264 (Baseline)", "H.265 (Passthrough)"],
            audio: ["AAC (ADTS, Standard PT 19)"]
        }
    });
});

// ==========================================
// SaaS Multi-Tenancy, Billing & API Keys API
// ==========================================
let currentActiveTenantId = 'tenant_inurum_global';

app.get('/api/saas/tenant', (req, res) => {
    const data = db.getSaasMetrics(currentActiveTenantId);
    res.json(data);
});

app.post('/api/saas/tenant/switch', (req, res) => {
    const { tenantId } = req.body || {};
    if (tenantId && db.getTenant(tenantId)) {
        currentActiveTenantId = tenantId;
    }
    const data = db.getSaasMetrics(currentActiveTenantId);
    res.json({ success: true, ...data });
});

app.get('/api/saas/billing', (req, res) => {
    const metrics = db.getSaasMetrics(currentActiveTenantId);
    const plans = [
        {
            id: 'starter',
            name: 'Starter Fleet',
            priceMonthly: 49,
            priceYearly: 490,
            vehicles: 'Up to 10 Vehicles',
            storage: '50 GB Cloud Storage',
            retention: '7-day Event Loop',
            resolution: '720p HD Streaming',
            audio: 'One-Way Audio',
            support: 'Community & Email',
            popular: false
        },
        {
            id: 'pro',
            name: 'Pro Fleet',
            priceMonthly: 149,
            priceYearly: 1490,
            vehicles: 'Up to 25 Vehicles',
            storage: '200 GB High-Speed NVMe',
            retention: '30-day History & Reels',
            resolution: '1080p Full HD Dual-Cam',
            audio: 'Two-Way Live Voice',
            support: '24/7 Priority Support',
            popular: true
        },
        {
            id: 'enterprise',
            name: 'Enterprise Cloud',
            priceMonthly: 399,
            priceYearly: 3990,
            vehicles: '50+ Unlimited Fleet',
            storage: '500 GB Dedicated S3/NVMe',
            retention: '90-day Compliant Archive',
            resolution: '4K Ultra & 1080p 60fps',
            audio: 'Real-Time Voice Intercom + Siren',
            support: 'Dedicated Technical Account Mgr',
            popular: false
        }
    ];

    const invoices = [
        { id: 'INV-2026-10-01', date: '2026-10-01', amount: '$399.00', status: 'Paid', method: 'Corporate Card •••• 4242' },
        { id: 'INV-2026-09-01', date: '2026-09-01', amount: '$399.00', status: 'Paid', method: 'Corporate Card •••• 4242' },
        { id: 'INV-2026-08-01', date: '2026-08-01', amount: '$399.00', status: 'Paid', method: 'Corporate Card •••• 4242' }
    ];

    res.json({
        activeTenant: metrics.activeTenant,
        plans,
        invoices,
        usage: metrics.usage
    });
});

app.post('/api/saas/billing/upgrade', (req, res) => {
    const { plan } = req.body || {};
    if (!plan) return res.status(400).json({ error: 'plan is required' });
    let seats = 10;
    let storage = 50;
    if (plan.toLowerCase().includes('enterprise')) { seats = 50; storage = 500; }
    else if (plan.toLowerCase().includes('pro')) { seats = 25; storage = 200; }

    const updated = db.updateTenant(currentActiveTenantId, { plan, seatsLimit: seats, storageLimitGb: storage });
    res.json({ success: true, tenant: updated });
});

app.get('/api/saas/api-keys', (req, res) => {
    const keys = db.getAllApiKeys(currentActiveTenantId);
    res.json(keys);
});

app.post('/api/saas/api-keys/generate', (req, res) => {
    const { name, scope } = req.body || {};
    const key = db.createApiKey(currentActiveTenantId, name || 'Enterprise Live Key', scope || 'telematics:stream');
    res.json({ success: true, apiKey: key });
});

app.delete('/api/saas/api-keys/:id', (req, res) => {
    db.deleteApiKey(req.params.id);
    res.json({ success: true });
});

// --- Accidents & History ---
app.get('/api/accidents', (req, res) => {
    res.json(accidentService.getAllAccidents());
});

app.get('/api/trips', (req, res) => {
    res.json(tripService.getAllTrips());
});

// --- Enterprise Fleet Management Endpoints ---
// --- Enterprise Fleet Management Endpoints (Durable SQLite Database) ---
app.get('/api/fleet/summary', (req, res) => {
    const devices = db.getAllDevices();
    const trips = tripService.getAllTrips();
    const accidents = accidentService.getAllAccidents();
    const onlineCount = devices.filter(d => {
        const sock = activeJT808Sockets.get(d.deviceId) || activeJT808Sockets.get(String(d.deviceId).padStart(12, '0'));
        return Boolean(sock && !sock.destroyed);
    }).length;
    res.json({
        totalVehicles: devices.length,
        onlineVehicles: onlineCount,
        offlineVehicles: Math.max(0, devices.length - onlineCount),
        activeTrips: trips.filter(t => !t.endTime).length,
        todayEvents: accidents.length
    });
});

app.get('/api/devices', (req, res) => {
    let list = db.getAllDevices();
    if (!list || list.length === 0 || !list.some(d => d.deviceId === '872312858278')) {
        const latest = db.getLatestTelemetry('872312858278');
        const sock = activeJT808Sockets.get('872312858278');
        const isOnline = Boolean(sock && !sock.destroyed);
        db.touchDevice('872312858278', {
            vehicleNo: latest?.vehicle_id || 'VEH-8278',
            deviceType: 'MDVR Dual-Cam (GD19)',
            status: isOnline ? 'Online' : 'Offline',
            simNo: '872312858278',
            latitude: latest?.latitude ?? null,
            longitude: latest?.longitude ?? null,
            speed: latest?.speed || 0
        });
        list = db.getAllDevices();
    }
    const dynamicList = list.map(d => {
        const sock = activeJT808Sockets.get(d.deviceId) || activeJT808Sockets.get(String(d.deviceId).padStart(12, '0'));
        const isOnline = Boolean(sock && !sock.destroyed);
        return {
            ...d,
            status: isOnline ? 'Online' : 'Offline'
        };
    });
    res.json(dynamicList);
});

app.post('/api/devices', (req, res) => {
    if (!req.body || !req.body.deviceId) {
        return res.status(400).json({ error: 'deviceId required' });
    }
    db.upsertDevice(req.body);
    res.json({ success: true, device: req.body });
});

app.put('/api/devices/:id', (req, res) => {
    const existing = db.getDevice(req.params.id) || {};
    const updated = { ...existing, ...req.body, deviceId: req.params.id };
    db.upsertDevice(updated);
    res.json({ success: true, device: updated });
});

app.delete('/api/devices/:id', (req, res) => {
    db.deleteDevice(req.params.id);
    res.json({ success: true, message: `Device ${req.params.id} deleted` });
});

app.get('/api/drivers', (req, res) => {
    res.json(db.getAllDrivers());
});

app.post('/api/drivers', (req, res) => {
    if (!req.body || !req.body.driverName) {
        return res.status(400).json({ error: 'driverName required' });
    }
    db.upsertDriver(req.body);
    res.json({ success: true, driver: req.body });
});

app.put('/api/drivers/:id', (req, res) => {
    const existing = db.getDriver(req.params.id) || {};
    const updated = { ...existing, ...req.body, driverId: req.params.id };
    db.upsertDriver(updated);
    res.json({ success: true, driver: updated });
});

app.delete('/api/drivers/:id', (req, res) => {
    db.deleteDriver(req.params.id);
    res.json({ success: true, message: `Driver ${req.params.id} deleted` });
});

app.get('/api/geofences', (req, res) => {
    res.json(db.getAllGeofences());
});

app.post('/api/geofences', (req, res) => {
    if (!req.body || !req.body.name) {
        return res.status(400).json({ error: 'name required' });
    }
    db.upsertGeofence(req.body);
    res.json({ success: true, geofence: req.body });
});

app.post('/api/geofences/:id/toggle', (req, res) => {
    const active = db.toggleGeofence(req.params.id);
    res.json({ success: true, active });
});

app.delete('/api/geofences/:id', (req, res) => {
    db.deleteGeofence(req.params.id);
    res.json({ success: true, message: `Geofence ${req.params.id} deleted` });
});

app.get('/api/search', (req, res) => {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json({ devices: [], drivers: [], geofences: [], accidents: [] });
    
    const devices = db.getAllDevices().filter(d => 
        (d.deviceId && d.deviceId.toLowerCase().includes(q)) || 
        (d.vehicleNo && d.vehicleNo.toLowerCase().includes(q)) ||
        (d.deviceType && d.deviceType.toLowerCase().includes(q))
    );
    const drivers = db.getAllDrivers().filter(dr =>
        (dr.driverName && dr.driverName.toLowerCase().includes(q)) ||
        (dr.vehicleNo && dr.vehicleNo.toLowerCase().includes(q)) ||
        (dr.phone && dr.phone.includes(q))
    );
    const geofences = db.getAllGeofences().filter(g =>
        (g.name && g.name.toLowerCase().includes(q)) ||
        (g.location && g.location.toLowerCase().includes(q))
    );
    const accidents = accidentService.getAllAccidents().filter(a =>
        (a.vehicleId && a.vehicleId.toLowerCase().includes(q)) ||
        (a.terminalId && a.terminalId.toLowerCase().includes(q)) ||
        (a.alarmType && a.alarmType.toLowerCase().includes(q))
    );
    res.json({ devices, drivers, geofences, accidents });
});

app.get('/api/reports/analytics', (req, res) => {
    const accidents = accidentService.getAllAccidents();
    const trips = tripService.getAllTrips();
    const devices = db.getAllDevices();

    let totalDist = 0;
    let drivingHours = 0;
    let totalSpeed = 0;
    let speedCount = 0;

    trips.forEach(tr => {
        if (tr.metrics) {
            if (tr.metrics.distanceKm) totalDist += tr.metrics.distanceKm;
            if (tr.metrics.drivingHours) drivingHours += tr.metrics.drivingHours;
            if (tr.metrics.avgSpeed) { totalSpeed += tr.metrics.avgSpeed; speedCount++; }
        }
    });

    const avgSpeed = speedCount > 0 ? Math.round(totalSpeed / speedCount) : 0;

    // Real event distribution from accidents table
    const counts = {};
    accidents.forEach(a => {
        const type = a.alarmType || 'Collision Warning';
        counts[type] = (counts[type] || 0) + 1;
    });

    const colors = ['#06b6d4', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#ef4444'];
    let colorIdx = 0;
    const eventDistribution = Object.keys(counts).map(type => ({
        type,
        count: counts[type],
        percentage: accidents.length > 0 ? Math.round((counts[type] / accidents.length) * 100) : 0,
        color: colors[(colorIdx++) % colors.length]
    }));

    const summaryData = {
        totalDistance: Math.round(totalDist),
        totalDistanceKm: Math.round(totalDist),
        distanceTrend: totalDist > 0 ? '+100%' : '0%',
        drivingHours: Math.round(drivingHours),
        hoursTrend: drivingHours > 0 ? '+100%' : '0%',
        avgSpeed: avgSpeed,
        avgSpeedKmH: avgSpeed,
        totalEvents: accidents.length,
        eventsTrend: accidents.length > 0 ? '+100%' : '0%'
    };

    res.json({
        kpis: summaryData,
        summary: summaryData,
        dailyDistance: [],
        eventDistribution: eventDistribution
    });
});

// --- Telemetry Queries ---
app.get('/api/telemetry', (req, res) => {
    const { terminalId, from, to } = req.query;
    if (!terminalId) {
        return res.status(400).json({ error: 'terminalId required' });
    }
    if (from && to) {
        const fromMs = new Date(from).getTime();
        const toMs = new Date(to).getTime();
        return res.json(telemetryService.getRange(terminalId, fromMs, toMs));
    }
    res.json(telemetryService.getHistory(terminalId));
});

// --- Video-Driven Synchronization API ---
app.get('/api/sync/telemetry', (req, res) => {
    const { terminalId, mediaUtcMs } = req.query;
    if (!terminalId || !mediaUtcMs) {
        return res.status(400).json({ error: 'terminalId and mediaUtcMs required' });
    }
    const synced = syncService.getTelemetryForMediaUtc(terminalId, parseInt(mediaUtcMs, 10));
    res.json(synced);
});

// --- REAL PHONE VIDEO HACK ---
let frameCount = 0;
app.post('/api/video/upload-frame', express.raw({ type: '*/*', limit: '10mb' }), (req, res) => {
    try {
        let buf = req.body;
        if (!Buffer.isBuffer(buf)) {
            buf = Buffer.from(buf);
        }
        if (buf && buf.length > 0) {
            frameCount++;
            if (frameCount % 10 === 0) console.log(`Received real video frame ${frameCount}, size: ${buf.length}`);

            const termId = req.query.terminalId || '013812345678';
            db.touchDevice(termId, {
                latitude: req.query.lat ? parseFloat(req.query.lat) : undefined,
                longitude: req.query.lng ? parseFloat(req.query.lng) : undefined,
                speed: req.query.speed ? parseFloat(req.query.speed) : undefined,
                status: 'Online'
            });

            const wsService = require('./services/websocket-service');
            wsService.emit('real_live_frame', {
                terminalId: termId,
                image: buf.toString('base64'),
                latitude: req.query.lat ? parseFloat(req.query.lat) : undefined,
                longitude: req.query.lng ? parseFloat(req.query.lng) : undefined,
                speed: req.query.speed ? parseFloat(req.query.speed) : undefined
            });
        }
    } catch (e) {
        console.error("Frame upload error:", e);
    }
    res.sendStatus(200);
});

// --- Live Telemetry for Terminal (Immediate on load) ---
app.get('/api/telemetry/latest', async (req, res) => {
    const terminalId = req.query.terminalId || '872312858278';
    const latest = db.getLatestTelemetry(terminalId);
    if (latest) {
        let address = null;
        if (latest.latitude && latest.longitude && !(Number(latest.latitude) === 0 && Number(latest.longitude) === 0)) {
            address = await geocodingService.resolveAddress(latest.latitude, latest.longitude);
        }
        res.json({
            success: true,
            telemetry: {
                terminalId: latest.terminal_id,
                vehicleId: latest.vehicle_id,
                latitude: latest.latitude,
                longitude: latest.longitude,
                speed: latest.speed,
                heading: latest.heading,
                altitude: latest.altitude,
                ignition: latest.ignition,
                timestamp: latest.timestamp,
                timestampMs: latest.timestamp_ms,
                deviceTime: latest.timestamp,
                address: address,
                status: 'Online'
            }
        });
    } else {
        res.json({ success: false, message: 'No telemetry found' });
    }
});

// --- Reverse Geocoding Endpoint for Instant Street/Area Resolution ---
app.get('/api/geocoding/reverse', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: 'Valid lat and lng query parameters required' });
    }
    try {
        const address = await geocodingService.resolveAddress(lat, lng);
        res.json({ success: true, latitude: lat, longitude: lng, address });
    } catch (e) {
        res.json({ success: false, latitude: lat, longitude: lng, address: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}` });
    }
});

// Force-request live video stream for CH1 & CH2 on demand
app.all('/api/video/start-live', (req, res) => {
    const terminalId = req.query.terminalId || req.body?.terminalId || '872312858278';
    const normId = String(terminalId).trim();
    let sock = activeJT808Sockets.get(normId) || activeJT808Sockets.get(normId.padStart(12, '0')) || activeJT808Sockets.get(normId.replace(/^0+/, ''));

    // Fallback: If terminal registered with slightly different prefix, use active socket
    if (!sock || sock.destroyed) {
        for (const [id, s] of activeJT808Sockets.entries()) {
            if (!s.destroyed) { sock = s; break; }
        }
    }

    if (sock && !sock.destroyed) {
        const targetId = sock.terminalPhone || normId;
        const req1 = binaryEncoder.buildLiveStartRequest(targetId, {
            serverIp: config.MEDIA_SERVER_IP,
            tcpPort: config.JT1078_PORT,
            udpPort: 0,
            channel: 1,
            dataType: 0,
            streamType: 0
        });
        const req2 = binaryEncoder.buildLiveStartRequest(targetId, {
            serverIp: config.MEDIA_SERVER_IP,
            tcpPort: config.JT1078_PORT,
            udpPort: 0,
            channel: 2,
            dataType: 0,
            streamType: 0
        });
        sock.write(req1);
        setTimeout(() => { if (!sock.destroyed) sock.write(req2); }, 1000);
        console.log(`[API] Triggered 0x9101 for CH1 & CH2 to terminal ${targetId}`);
        return res.json({ success: true, message: `Sent 0x9101 for CH1 & CH2 to ${targetId}` });
    } else {
        return res.status(404).json({
            success: false,
            error: 'TERMINAL_NOT_CONNECTED',
            message: `Terminal JT808 socket for ${terminalId} is not currently connected`
        });
    }
});

// Stream health diagnostics endpoint
app.get('/api/video/stream-health', (req, res) => {
    const terminalId = req.query.terminalId || '872312858278';
    const normId = String(terminalId).trim();
    const sock = activeJT808Sockets.get(normId) || activeJT808Sockets.get(normId.padStart(12, '0')) || activeJT808Sockets.get(normId.replace(/^0+/, ''));
    const ch1 = mediaHandler.getStreamStats(terminalId, 1);
    const ch2 = mediaHandler.getStreamStats(terminalId, 2);
    const disk = storageService.getDiskUsage();

    res.json({
        terminalId,
        recordingMode: config.RECORDING_MODE,
        jt808: {
            connected: Boolean(sock && !sock.destroyed),
            remoteAddress: sock ? `${sock.remoteAddress}:${sock.remotePort}` : null,
            lastSeen: sock?.lastSeen ? new Date(sock.lastSeen).toISOString() : null,
            authenticated: Boolean(sock?.authenticated)
        },
        streams: {
            ch1,
            ch2
        },
        disk,
        serverTime: new Date().toISOString()
    });
});

// --- Configurable Recording Mode API (LIVE_ONLY vs LIVE_AND_RECORD) ---
app.get('/api/video/recording-mode', (req, res) => {
    res.json({
        recordingMode: config.RECORDING_MODE,
        options: ['LIVE_ONLY', 'LIVE_AND_RECORD'],
        livePlaylistSegments: config.LIVE_PLAYLIST_SEGMENTS,
        liveGraceSegments: config.LIVE_GRACE_SEGMENTS,
        boundedStorage: true
    });
});

function requireAdminAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const customToken = req.headers['x-auth-token'];
    const activeToken = token || customToken;

    if (activeToken) {
        if (activeToken.startsWith('token-superadmin') || activeToken.startsWith('token-admin')) {
            return next();
        }
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Admin or SuperAdmin role required' });
    }

    if (activeUserSession && (activeUserSession.role === 'admin' || activeUserSession.role === 'superadmin')) {
        return next();
    }

    return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required. Please log in as admin.' });
}

app.post('/api/video/recording-mode', requireAdminAuth, (req, res) => {
    const { mode } = req.body || {};
    if (mode === 'LIVE_ONLY' || mode === 'LIVE_AND_RECORD') {
        config.RECORDING_MODE = mode;
        console.log(`[RECORDING_MODE] Updated to: ${mode}`);
        return res.json({ success: true, recordingMode: config.RECORDING_MODE });
    }
    return res.status(400).json({ error: 'Invalid mode. Supported: LIVE_ONLY, LIVE_AND_RECORD' });
});

// --- System Disk Usage API ---
app.get('/api/system/disk', (req, res) => {
    res.json(storageService.getDiskUsage());
});

// --- Media Segments for Reels ---
app.get('/api/media/segments', (req, res) => {
    const terminalId = req.query.terminalId || '013812345678';
    const channel = parseInt(req.query.channel || '1', 10);
    const segments = db.getSegmentsForReels(terminalId, channel);
    res.json(segments);
});

// --- REAL PHONE MP4 CLIP UPLOAD ---
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, config.MEDIA_DIR + '/reels/')
    },
    filename: function (req, file, cb) {
        cb(null, uuidv4() + '.mp4')
    }
});
const upload = multer({ storage: storage });

app.post('/api/video/upload-clip', upload.single('video'), (req, res) => {
    if (!req.file) return res.status(400).send('No file uploaded.');

    const terminalId = req.query.terminalId;
    if (!terminalId) return res.status(400).json({ error: "terminalId required" });
    const sessionId = req.query.sessionId || `session_${Date.now()}`;
    const startUtcMs = parseInt(req.query.startUtcMs || Date.now(), 10);
    const durationSec = parseInt(req.query.durationSec || 3, 10);

    // Insert into sessions if not exists (simplified)
    try {
        db.db.exec(`INSERT OR IGNORE INTO sessions (session_id, terminal_id, channel, start_time_utc, start_time_ms, status) 
            VALUES ('${sessionId}', '${terminalId}', 1, '${new Date(startUtcMs).toISOString()}', ${startUtcMs}, 'ACTIVE')`);

        // Insert into media_segments
        const segmentId = uuidv4();
        const endUtcMs = startUtcMs + (durationSec * 1000);

        db.db.exec(`INSERT INTO media_segments (segment_id, session_id, terminal_id, channel, seq_num, start_pts_ms, end_pts_ms, start_utc_ms, end_utc_ms, duration_sec, file_path, mp4_clip_url, created_at)
            VALUES ('${segmentId}', '${sessionId}', '${terminalId}', 1, ${Date.now()}, 0, ${durationSec * 1000}, ${startUtcMs}, ${endUtcMs}, ${durationSec}, '${req.file.path}', '/media/reels/${req.file.filename}', '${new Date().toISOString()}')`);

        // Notify the frontend via WS
        const wsService = require('./services/websocket-service');
        wsService.emit('media_segment', {
            terminalId: terminalId,
            sessionId: sessionId,
            channel: 1
        });

    } catch (e) {
        console.error('Failed to insert real clip into db:', e);
    }

    res.json({ success: true, file: req.file.filename });
});

app.get('/api/media/recordings', (req, res) => {
    const rows = db.getSegmentsForReels(req.query.terminalId || '013812345678', Number(req.query.channel || 1));
    const sessions = new Map();
    for (const r of rows) { if (!sessions.has(r.session_id)) sessions.set(r.session_id, { sessionId: r.session_id, startUtcMs: r.start_utc_ms, endUtcMs: r.end_utc_ms, playlist: (r.hls_segment_url ? r.hls_segment_url.replace(/[^/]+$/, 'recording.m3u8') : r.mp4_clip_url) }); sessions.get(r.session_id).endUtcMs = r.end_utc_ms; }
    res.json([...sessions.values()]);
});

// --- Dashcam Video & Audio String Data in JSON ---
app.get('/api/media/string-data', (req, res) => {
    const terminalId = req.query.terminalId;
    if (!terminalId) return res.status(400).json({ error: "terminalId required" });
    const channel = parseInt(req.query.channel || '1', 10);
    const format = (req.query.format || 'base64').toLowerCase(); // 'base64' or 'hex'
    const fs = require('fs');

    if (req.query.type === 'raw') {
        const h264Path = path.join(__dirname, '..', 'mock_data', 'generated', 'test_video_30s.h264');
        const aacPath = path.join(__dirname, '..', 'mock_data', 'generated', 'test_audio_30s.aac');
        let h264Buf = fs.existsSync(h264Path) ? fs.readFileSync(h264Path) : null;
        let aacBuf = fs.existsSync(aacPath) ? fs.readFileSync(aacPath) : null;

        return res.json({
            success: true,
            terminalId,
            channel,
            type: 'raw_elementary_streams',
            format,
            videoH264: h264Buf ? {
                codec: 'h264 (Annex-B)',
                byteLength: h264Buf.length,
                dataString: (format === 'hex') ? h264Buf.toString('hex') : h264Buf.toString('base64')
            } : null,
            audioAac: aacBuf ? {
                codec: 'aac (ADTS)',
                byteLength: aacBuf.length,
                dataString: (format === 'hex') ? aacBuf.toString('hex') : aacBuf.toString('base64')
            } : null
        });
    }

    const segments = db.getSegmentsForReels(terminalId, channel);
    if (!segments || segments.length === 0) {
        return res.status(404).json({ error: 'No media segments found' });
    }

    const seg = segments[segments.length - 1]; // latest segment
    let videoBuf = fs.existsSync(seg.file_path) ? fs.readFileSync(seg.file_path) : null;
    const tsPath = seg.file_path.replace(/\.mp4$/, '.ts');
    let tsBuf = fs.existsSync(tsPath) ? fs.readFileSync(tsPath) : null;

    res.json({
        success: true,
        segmentId: seg.segment_id,
        sessionId: seg.session_id,
        terminalId: seg.terminal_id,
        channel: seg.channel,
        seqNum: seg.seq_num,
        startUtcMs: seg.start_utc_ms,
        endUtcMs: seg.end_utc_ms,
        durationSec: seg.duration_sec,
        stringFormat: format,
        video: videoBuf ? {
            format: 'mp4 (H.264 + AAC)',
            byteLength: videoBuf.length,
            dataUri: format === 'base64' ? `data:video/mp4;base64,${videoBuf.toString('base64')}` : undefined,
            dataString: (format === 'hex') ? videoBuf.toString('hex') : videoBuf.toString('base64')
        } : null,
        transportStream: tsBuf ? {
            format: 'ts (JT/T 1078 PES Multiplexed)',
            byteLength: tsBuf.length,
            dataString: (format === 'hex') ? tsBuf.toString('hex') : tsBuf.toString('base64')
        } : null
    });
});
// --- One-String Input & Simulator Console API ---
app.post('/api/simulator/command', async (req, res) => {
    const { input, mode } = req.body || {};
    if (!input || typeof input !== 'string') {
        return res.status(400).json({ error: 'Input string required' });
    }

    const trimmed = input.trim();

    // 1. Safe format detection or explicit mode
    const isJson = (mode === 'json') || (mode !== 'jt808' && mode !== 'jt1078' && trimmed.startsWith('{') && trimmed.endsWith('}'));
    const is808 = (mode === 'jt808') || (mode !== 'json' && mode !== 'jt1078' && trimmed.toUpperCase().startsWith('7E') && trimmed.toUpperCase().endsWith('7E'));
    const is1078 = (mode === 'jt1078') || (mode !== 'json' && mode !== 'jt808' && trimmed.toUpperCase().startsWith('30316364'));

    if (isJson) {
        try {
            const cmd = JSON.parse(trimmed);
            if (cmd.action === 'startSimulation') {
                mediaHandler.simulated.add(`${cmd.terminalId || "013812345678"}_${cmd.channel || 1}`);
                await simulator.start(cmd);
                return res.json({ type: 'JSON_COMMAND', action: 'startSimulation', status: simulator.getStatus() });
            } else if (cmd.action === 'pauseSimulation') {
                return res.json({ type: 'JSON_COMMAND', action: 'pauseSimulation', status: simulator.pause() });
            } else if (cmd.action === 'resumeSimulation') {
                return res.json({ type: 'JSON_COMMAND', action: 'resumeSimulation', status: simulator.resume() });
            } else if (cmd.action === 'stopSimulation') {
                return res.json({ type: 'JSON_COMMAND', action: 'stopSimulation', status: simulator.stop() });
            } else {
                return res.status(400).json({ error: `Unsupported JSON action: ${cmd.action}` });
            }
        } catch (e) {
            return res.status(400).json({ error: `JSON parse error: ${e.message}` });
        }
    } else if (is808) {
        // Raw JT808 HEX Processing
        try {
            const rawBuf = Buffer.from(trimmed.replace(/\s+/g, ''), 'hex');
            const parsed = binaryParser.parse(rawBuf);
            if (!parsed) {
                return res.status(400).json({ type: 'JT808_HEX', error: 'Malformed or incomplete JT808 frame' });
            }

            // Build appropriate real ACK
            let ackPacket = null;
            if (parsed.frame && parsed.checksumValid) {
                if (parsed.frame.messageId === 0x0100) {
                    ackPacket = binaryEncoder.buildRegistrationResponse(parsed.frame.terminalPhone, parsed.frame.serialNo, 0, "AUTH12345");
                } else if ([0x0002, 0x0102, 0x0200].includes(parsed.frame.messageId)) {
                    ackPacket = binaryEncoder.buildPlatformResponse(parsed.frame.terminalPhone, parsed.frame.serialNo, parsed.frame.messageId, 0);
                }

                // If location report, save to DB and broadcast
                if (parsed.telemetry) {
                    if (parsed.telemetry.latitude && parsed.telemetry.longitude && !(Number(parsed.telemetry.latitude) === 0 && Number(parsed.telemetry.longitude) === 0)) {
                        parsed.telemetry.address = await geocodingService.resolveAddress(parsed.telemetry.latitude, parsed.telemetry.longitude);
                    }
                    telemetryService.addTelemetry(parsed.telemetry);
                    db.touchDevice(parsed.telemetry.terminalId, {
                        vehicleNo: parsed.telemetry.vehicleId,
                        latitude: parsed.telemetry.latitude,
                        longitude: parsed.telemetry.longitude,
                        speed: parsed.telemetry.speed,
                        address: parsed.telemetry.address,
                        status: 'Online'
                    });
                    tripService.processTelemetry(parsed.telemetry);
                    wsService.emit('telemetry', parsed.telemetry);
                }
            }

            return res.json({
                type: 'JT808_HEX',
                frame: parsed.frame,
                decoded: parsed.decoded,
                telemetry: parsed.telemetry,
                ackHex: ackPacket ? ackPacket.toString('hex').toUpperCase() : null,
                mediaAssociation: parsed.telemetry ? "Telemetry received; checking active media stream." : "Control/status packet"
            });
        } catch (err) {
            return res.status(400).json({ type: 'JT808_HEX', error: err.message });
        }
    } else if (is1078) {
        // Raw JT1078 HEX Processing
        try {
            const rawBuf = Buffer.from(trimmed.replace(/\s+/g, ''), 'hex');
            const parsed = mediaParser.parsePacket(rawBuf);
            if (!parsed || parsed.error) {
                return res.json({
                    type: 'JT1078_HEX',
                    status: 'Waiting for remaining fragments/keyframe',
                    detail: parsed ? parsed.error : 'Incomplete header'
                });
            }

            return res.json({
                type: 'JT1078_HEX',
                status: parsed.packet.subpackage === 0 ? 'Complete atomic frame received' : 'Fragment received; waiting for reassembly',
                packet: {
                    simNumber: parsed.packet.simNumber,
                    channel: parsed.packet.channel,
                    codecName: parsed.packet.codecName,
                    dataType: parsed.packet.dataTypeName,
                    subpackage: parsed.packet.subpackageName,
                    timestampMs: parsed.packet.timestampMs,
                    bodyLength: parsed.packet.bodyLength
                }
            });
        } catch (err) {
            return res.status(400).json({ type: 'JT1078_HEX', error: err.message });
        }
    } else {
        return res.status(400).json({ error: 'Input does not match JSON command, JT808 HEX (7E...7E), or JT1078 HEX (30316364...)' });
    }
});

// --- Same-Origin Simulator Control Endpoints ---
app.post('/api/simulator/control', async (req, res) => {
    const { action, terminalId, channel, durationSeconds } = req.body || {};
    if (action === 'start' || action === 'startSimulation') {
        const termId = terminalId || '872312858278';
        const ch = parseInt(channel || 1, 10);
        mediaHandler.simulated.add(`${termId}_${ch}`);
        try {
            await simulator.start({
                action: 'startSimulation',
                terminalId: termId,
                channel: ch,
                scenario: 'indore-demo',
                telemetryCount: 600,
                telemetryIntervalMs: 1000,
                durationSeconds: durationSeconds || 600,
                segmentSeconds: 3
            });
            return res.json({ success: true, status: simulator.getStatus() });
        } catch (err) {
            return res.status(500).json({ success: false, error: err.message });
        }
    } else if (action === 'pause') res.json(simulator.pause());
    else if (action === 'resume') res.json(simulator.resume());
    else if (action === 'stop') res.json(simulator.stop());
    else res.json(simulator.getStatus());
});

app.get('/api/simulator/status', (req, res) => {
    res.json(simulator.getStatus());
});

app.post('/api/simulator/trigger-accident', (req, res) => {
    const termId = req.query.terminalId || req.body?.terminalId || '013812345678';
    let latest = telemetryService.getLatest(termId) || telemetryService.getLatest('013812345678');
    if (!latest) {
        // Fallback default coordinate near Indore route
        latest = {
            terminalId: termId,
            vehicleId: `VEH-${termId.slice(-4)}`,
            latitude: 22.7533,
            longitude: 75.8937,
            speed: 68.4,
            heading: 92,
            altitude: 540,
            ignition: 1,
            timestamp: new Date().toISOString(),
            isSimulated: 1
        };
        telemetryService.addTelemetry(latest);
    }

    const accidentTelemetry = {
        ...latest,
        timestamp: new Date().toISOString(),
        eventType: 'ACCIDENT',
        alarmType: 'COLLISION_WARNING',
        impactGForce: 3.8,
        speed: latest.speed || 60
    };
    accidentService.processAccident(accidentTelemetry);

    // Ensure simulator generated media is marked as simulated
    mediaHandler.simulated.add(`${termId}_1`);

    res.json({ success: true, message: 'Accident simulated', accident: accidentTelemetry });
});

server.listen(config.API_PORT, () => {
    console.log(`[Web] Admin Dashboard listening on http://${config.MEDIA_SERVER_IP || '100.31.90.51'}:${config.API_PORT} (Local: http://localhost:${config.API_PORT})`);
});

// ==========================================
// 2. JT/T 808 Server (GPS & Telemetry)
// ==========================================
const activeJT808Sockets = new Map(); // normalizedPhone -> net.Socket
const connectedSockets808 = new Set(); // all open TCP sockets on port 7800

function registerJT808Socket(terminalPhone, socket) {
    if (!terminalPhone) return;
    const norm = String(terminalPhone).trim();
    const existing = activeJT808Sockets.get(norm);
    if (existing && existing !== socket && !existing.destroyed) {
        console.log(`[JT808] Terminal ${norm} reconnected. Closing previous stale socket.`);
        try { existing.destroy(); } catch (_) {}
    }
    socket.terminalPhone = norm;
    socket.lastSeen = Date.now();
    activeJT808Sockets.set(norm, socket);
}

function unregisterJT808Socket(socket) {
    if (socket.terminalPhone) {
        const current = activeJT808Sockets.get(socket.terminalPhone);
        if (current === socket) {
            activeJT808Sockets.delete(socket.terminalPhone);
            console.log(`[JT808] Cleaned up active socket mapping for ${socket.terminalPhone}`);
        } else {
            console.log(`[JT808] Disconnected socket for ${socket.terminalPhone} was already superseded by newer connection.`);
        }
    }
}

function requestLiveStreams(socket, terminalPhone) {
    if (!socket || socket.destroyed || socket.liveRequested) return;
    socket.liveRequested = true;
    const req1 = binaryEncoder.buildLiveStartRequest(terminalPhone, {
        serverIp: config.MEDIA_SERVER_IP,
        tcpPort: config.JT1078_PORT,
        udpPort: 0,
        channel: 1,
        dataType: 0,
        streamType: 0
    });
    const req2 = binaryEncoder.buildLiveStartRequest(terminalPhone, {
        serverIp: config.MEDIA_SERVER_IP,
        tcpPort: config.JT1078_PORT,
        udpPort: 0,
        channel: 2,
        dataType: 0,
        streamType: 0
    });
    setTimeout(() => {
        if (!socket.destroyed) {
            console.log(`[JT808] Sending 0x9101 Video Request (CH1) to ${terminalPhone}`);
            socket.write(req1);
        }
    }, 500);
    setTimeout(() => {
        if (!socket.destroyed) {
            console.log(`[JT808] Sending 0x9101 Video Request (CH2) to ${terminalPhone}`);
            socket.write(req2);
        }
    }, 1500);
}

// ==========================================
// Roadeazy Public API Compatibility Layer
// ==========================================
const roadeazyRouter = createRoadeazyRouter({
    db,
    wsService,
    telemetryService,
    accidentService,
    tripService,
    activeJT808Sockets,
    requestLiveStreams,
    config
});
app.use(roadeazyRouter);
app.use('/api', roadeazyRouter);

app.all('/api/video/start-live', (req, res) => {
    const terminalId = req.query.terminalId || req.body?.terminalId || '872312858278';
    let socket = activeJT808Sockets.get(terminalId);
    let matchedBy = 'terminalId';

    if (!socket || socket.destroyed) {
        // Fallback: use the most recently connected active JT808 socket
        const activeSockets = Array.from(connectedSockets808).filter(s => !s.destroyed);
        if (activeSockets.length > 0) {
            socket = activeSockets[activeSockets.length - 1];
            matchedBy = `connectedSocket_${socket.remoteAddress}:${socket.remotePort}`;
        }
    }

    if (!socket || socket.destroyed) {
        return res.status(404).json({
            success: false,
            error: 'No active JT808 socket connected from dashcam',
            connectedSocketsCount: connectedSockets808.size
        });
    }

    // Reset flag to force re-request
    socket.liveRequested = false;
    requestLiveStreams(socket, terminalId);

    // Also send Location Query 0x8201
    try {
        const locQuery = binaryEncoder.buildLocationQuery(terminalId);
        socket.write(locQuery);
    } catch (_) {}

    res.json({
        success: true,
        terminalId,
        matchedBy,
        target: `${socket.remoteAddress}:${socket.remotePort}`,
        message: 'Live video request (0x9101 CH1 & CH2) and location query (0x8201) dispatched to dashcam socket'
    });
});

const server808 = net.createServer((socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[JT808] Terminal connected: ${clientAddress}`);
    wsService.emit('dashcam_connected', { ip: clientAddress });

    connectedSockets808.add(socket);
    const removeConn = () => connectedSockets808.delete(socket);
    socket.on('end', removeConn);
    socket.on('close', removeConn);
    socket.on('error', removeConn);

    socket.buffer = Buffer.alloc(0);
    socket.authenticated = false;
    socket.terminalPhone = null;
    socket.lastSeen = Date.now();
    socket.liveRequested = false;

    socket.setNoDelay(true);
    socket.setKeepAlive(true, 15000);
    socket.setTimeout(180000); // 3-minute inactivity timeout
    socket.on('timeout', () => {
        console.warn(`[JT808] Socket idle timeout (180s): ${clientAddress}`);
        socket.destroy();
    });

    // Proactive probe: If terminal connects but sends no data in 1.5s, probe with 0x8201 & 0x9101
    const probeTimer = setTimeout(() => {
        if (!socket.destroyed && !socket.terminalPhone) {
            const defaultTerminal = config.DEFAULT_TERMINAL_ID || '872312858278';
            console.log(`[JT808] Probing connected socket ${clientAddress} with 0x8201 (Location Query) & 0x9101 (Live Stream) for ${defaultTerminal}`);
            try {
                const locQuery = binaryEncoder.buildLocationQuery(defaultTerminal);
                socket.write(locQuery);
                requestLiveStreams(socket, defaultTerminal);
            } catch (err) {
                console.error(`[JT808] Probe error on ${clientAddress}:`, err.message);
            }
        }
    }, 1500);
    socket.on('close', () => clearTimeout(probeTimer));

    socket.on('data', async (data) => {
        clearTimeout(probeTimer);
        socket.lastSeen = Date.now();
        console.log(`[JT808] <<< RAW DATA (${data.length} bytes) from ${clientAddress}: ${data.slice(0, 24).toString('hex')}`);
        socket.buffer = Buffer.concat([socket.buffer, data]);

        while (socket.buffer.length > 0) {
            const startIndex = socket.buffer.indexOf(0x7E);

            if (startIndex === -1) {
                if (socket.buffer.length > 4096) socket.buffer = Buffer.alloc(0);
                break;
            }

            if (startIndex > 0) {
                socket.buffer = socket.buffer.subarray(startIndex);
                continue;
            }

            const endIndex = socket.buffer.indexOf(0x7E, 1);
            if (endIndex === -1) break;

            if (endIndex === 1) {
                socket.buffer = socket.buffer.subarray(1);
                continue;
            }

            const frameBuffer = socket.buffer.subarray(0, endIndex + 1);
            socket.buffer = socket.buffer.subarray(endIndex + 1);

            const result = binaryParser.parse(frameBuffer);

            if (result && result.frame) {
                const { frame, decoded, telemetry, error } = result;

                // Handle Checksum / Length Errors
                if (error) {
                    console.warn(`[JT808] Frame rejected: ${error}`);
                    const nack = binaryEncoder.buildPlatformResponse(
                        frame.terminalPhone || "000000000000",
                        frame.serialNo || 0,
                        frame.messageId || 0,
                        1 // Failure
                    );
                    socket.write(nack);
                    continue;
                }

                registerJT808Socket(frame.terminalPhone, socket);

                // Route response based on Message ID
                let responsePacket = null;

                if (frame.messageId === 0x0001) {
                    // Terminal General Response
                    if (decoded && decoded.valid) {
                        console.log(`[JT808] Terminal ${frame.terminalPhone} Response: cmd=${decoded.replyMessageHex} serial=${decoded.replySerialNo} result=${decoded.result} (${decoded.resultText})`);
                        if (decoded.replyMessageId === 0x9101) {
                            console.log(`[JT808] Terminal ${frame.terminalPhone} ACK for 0x9101: ${decoded.result === 0 ? 'ACCEPTED - Video stream starting on port 10780' : 'FAILED: ' + decoded.resultText}`);
                        }
                    }
                } else if (frame.messageId === 0x0100) {
                    // Registration
                    responsePacket = binaryEncoder.buildRegistrationResponse(
                        frame.terminalPhone,
                        frame.serialNo,
                        0, // Success
                        "AUTH12345"
                    );
                } else if (frame.messageId === 0x0102) {
                    // Authentication (Accept valid auth code from real DashCam)
                    if (decoded && decoded.valid) {
                        socket.authenticated = true;
                        console.log(`[JT808] Terminal ${frame.terminalPhone} authenticated successfully (authCode: ${decoded.authCode})`);
                        responsePacket = binaryEncoder.buildPlatformResponse(
                            frame.terminalPhone,
                            frame.serialNo,
                            frame.messageId,
                            0 // Success
                        );

                        // Issue 0x9101 Real-Time Video Request after auth (Dual Cam: CH1 & CH2)
                        requestLiveStreams(socket, frame.terminalPhone);
                    } else {
                        responsePacket = binaryEncoder.buildPlatformResponse(
                            frame.terminalPhone,
                            frame.serialNo,
                            frame.messageId,
                            1 // Failure / Wrong auth
                        );
                    }
                } else if (frame.messageId === 0x0002) {
                    // Heartbeat
                    if (!socket.liveRequested) {
                        requestLiveStreams(socket, frame.terminalPhone);
                    }
                    responsePacket = binaryEncoder.buildPlatformResponse(
                        frame.terminalPhone,
                        frame.serialNo,
                        frame.messageId,
                        0
                    );
                } else if (frame.messageId === 0x0200) {
                    // Location Information Report
                    if (!socket.liveRequested) {
                        requestLiveStreams(socket, frame.terminalPhone);
                    }
                    if (telemetry) {
                        const hasCoords = (telemetry.latitude !== 0 || telemetry.longitude !== 0);
                        const isChinaDummy = (Math.abs(telemetry.latitude - 23.116778) < 0.001 && Math.abs(telemetry.longitude - 114.481235) < 0.001);
                        const isGpsValid = (Boolean(decoded && decoded.positioning) || hasCoords) && !isChinaDummy && hasCoords;

                        if (isGpsValid) {
                            const addr = await geocodingService.resolveAddress(telemetry.latitude, telemetry.longitude);
                            telemetry.address = addr;
                            console.log(`📡 [REAL DASHCAM GPS] Terminal: ${telemetry.terminalId} | Lat: ${telemetry.latitude.toFixed(6)} | Lng: ${telemetry.longitude.toFixed(6)} | Address: ${addr} | Speed: ${telemetry.speed} km/h | Sat-Fix: ${decoded?.positioning ? '3D FIX (Locked)' : 'Weak/2D Signal'}`);
                            telemetryService.addTelemetry(telemetry);
                            db.touchDevice(telemetry.terminalId, {
                                vehicleNo: telemetry.vehicleId,
                                latitude: telemetry.latitude,
                                longitude: telemetry.longitude,
                                speed: telemetry.speed,
                                address: addr,
                                status: 'Online'
                            });
                            await tripService.processTelemetry(telemetry);
                            wsService.emit('telemetry', telemetry);

                            if (telemetry.eventType === 'ACCIDENT') {
                                accidentService.processAccident(telemetry);
                            }
                        } else {
                            // GPS searching / cold start near window
                            console.log(`[JT808] Terminal ${telemetry.terminalId} online. Awaiting satellite lock near window (lat=${telemetry.latitude}, lng=${telemetry.longitude}, status=0x${(decoded?.status || 0).toString(16)})`);
                            db.touchDevice(telemetry.terminalId, {
                                vehicleNo: telemetry.vehicleId,
                                status: 'Online',
                                speed: telemetry.speed || 0
                            });
                            wsService.emit('telemetry', {
                                terminalId: telemetry.terminalId,
                                vehicleId: telemetry.vehicleId,
                                speed: telemetry.speed || 0,
                                ignition: telemetry.ignition,
                                timestamp: telemetry.timestamp,
                                status: 'Online',
                                gpsFixed: false
                            });
                        }

                        responsePacket = binaryEncoder.buildPlatformResponse(
                            frame.terminalPhone,
                            frame.serialNo,
                            frame.messageId,
                            0 // Success
                        );
                    } else {
                        // Malformed or empty body
                        responsePacket = binaryEncoder.buildPlatformResponse(
                            frame.terminalPhone,
                            frame.serialNo,
                            frame.messageId,
                            2 // Message Error
                        );
                    }
                } else {
                    // Send general success for any other standard JT808 message
                    if (frame.messageId !== 0x0001) {
                        responsePacket = binaryEncoder.buildPlatformResponse(
                            frame.terminalPhone,
                            frame.serialNo,
                            frame.messageId,
                            0 // Success
                        );
                    }
                }

                if (responsePacket) {
                    socket.write(responsePacket);
                }
            }
        }
    });

    socket.on('end', () => {
        unregisterJT808Socket(socket);
        console.log(`[JT808] Terminal disconnected (end): ${clientAddress}`);
    });

    socket.on('close', () => {
        unregisterJT808Socket(socket);
        console.log(`[JT808] Terminal disconnected (close): ${clientAddress}`);
    });

    socket.on('error', (err) => {
        unregisterJT808Socket(socket);
        console.error(`[JT808] Error: ${err.message}`);
    });
});

server808.listen(config.JT808_PORT, () => {
    console.log(`[JT808] Server listening on port ${config.JT808_PORT}`);
});

// ==========================================
// 2b. JT/T 808 Server (UDP Support)
// ==========================================
const udpServer808 = dgram.createSocket('udp4');

udpServer808.on('message', async (msg, rinfo) => {
    console.log(`[JT808-UDP] <<< RAW DATA (${msg.length} bytes) from ${rinfo.address}:${rinfo.port}: ${msg.slice(0, 24).toString('hex')}`);

    let buffer = msg;
    while (buffer.length > 0) {
        const startIndex = buffer.indexOf(0x7E);
        if (startIndex === -1) break;
        if (startIndex > 0) {
            buffer = buffer.subarray(startIndex);
            continue;
        }

        const endIndex = buffer.indexOf(0x7E, 1);
        if (endIndex === -1) break;
        if (endIndex === 1) {
            buffer = buffer.subarray(1);
            continue;
        }

        const frameBuffer = buffer.subarray(0, endIndex + 1);
        buffer = buffer.subarray(endIndex + 1);

        const result = binaryParser.parse(frameBuffer);
        if (result && result.frame) {
            const { frame, decoded, telemetry, error } = result;
            if (error) {
                console.warn(`[JT808-UDP] Frame rejected: ${error}`);
                continue;
            }

            console.log(`[JT808-UDP] Terminal ${frame.terminalPhone} Message: 0x${frame.messageId.toString(16).padStart(4, '0')} (${frame.messageName})`);
            let responsePacket = null;

            if (frame.messageId === 0x0100) {
                // Registration
                responsePacket = binaryEncoder.buildRegistrationResponse(
                    frame.terminalPhone,
                    frame.serialNo,
                    0,
                    "AUTH12345"
                );
            } else if (frame.messageId === 0x0102) {
                // Authentication
                responsePacket = binaryEncoder.buildPlatformResponse(
                    frame.terminalPhone,
                    frame.serialNo,
                    frame.messageId,
                    0
                );
            } else if (frame.messageId === 0x0002) {
                // Heartbeat
                responsePacket = binaryEncoder.buildPlatformResponse(
                    frame.terminalPhone,
                    frame.serialNo,
                    frame.messageId,
                    0
                );
            } else if (frame.messageId === 0x0200) {
                // Location Information
                if (telemetry) {
                    if (telemetry.latitude && telemetry.longitude && !(Number(telemetry.latitude) === 0 && Number(telemetry.longitude) === 0)) {
                        telemetry.address = await geocodingService.resolveAddress(telemetry.latitude, telemetry.longitude);
                    }
                    telemetryService.addTelemetry(telemetry);
                    db.touchDevice(telemetry.terminalId, {
                        vehicleNo: telemetry.vehicleId,
                        latitude: telemetry.latitude,
                        longitude: telemetry.longitude,
                        speed: telemetry.speed,
                        address: telemetry.address,
                        status: 'Online'
                    });
                    await tripService.processTelemetry(telemetry);
                    wsService.emit('telemetry', telemetry);
                }
                responsePacket = binaryEncoder.buildPlatformResponse(
                    frame.terminalPhone,
                    frame.serialNo,
                    frame.messageId,
                    0
                );
            } else {
                if (frame.messageId !== 0x0001) {
                    responsePacket = binaryEncoder.buildPlatformResponse(
                        frame.terminalPhone,
                        frame.serialNo,
                        frame.messageId,
                        0
                    );
                }
            }

            if (responsePacket) {
                udpServer808.send(responsePacket, rinfo.port, rinfo.address, (err) => {
                    if (err) console.error(`[JT808-UDP] Send error: ${err.message}`);
                });
            }
        }
    }
});

udpServer808.on('error', (err) => {
    console.error(`[JT808-UDP] Error: ${err.message}`);
});

udpServer808.bind(config.JT808_PORT, () => {
    console.log(`[JT808-UDP] Server listening on UDP port ${config.JT808_PORT}`);
});

// ==========================================
// 3. JT/T 1078 Server (Video & Audio Ingestion)
// ==========================================
const server1078 = net.createServer((socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[JT1078] Media stream connected: ${clientAddress}`);
    socket.setNoDelay(true);
    socket.setKeepAlive(true, 15000);
    socket.setTimeout(60000); // 60s timeout if no media packets received
    socket.on('timeout', () => {
        console.warn(`[JT1078] Media stream idle timeout (60s): ${clientAddress}`);
        socket.destroy();
    });

    socket.on('data', (data) => {
        console.log(`[JT1078] <<< RAW MEDIA (${data.length} bytes) from ${clientAddress}`);
        try { mediaHandler.handleData(socket, data); } catch (e) { console.error(e.message); socket.destroy(); }
    });

    let ended = false;
    const finish = () => { if (ended) return; ended = true; for (const key of socket.sessionKeys || []) { const [term, ch] = key.split('_'); mediaHandler.handleSocketDisconnect(term, Number(ch)); } };
    socket.on('end', finish);
    socket.on('close', finish);
    socket.on('error', err => { console.error('[JT1078]', err.message); finish(); });

});

server1078.listen(config.JT1078_PORT, () => {
    console.log(`[JT1078] Media Server listening on port ${config.JT1078_PORT}`);
});

module.exports = { app, server, server808, server1078, udpServer808 };

let shuttingDown = false;
async function shutdown() {
    if (shuttingDown) return; shuttingDown = true; simulator.stop();
    await new Promise(r => setTimeout(r, 100));
    try { udpServer808.close(); } catch (e) {}
    await Promise.all([...mediaHandler.sessions.values()].map(s => mediaHandler.closeSession(s.terminalId, s.channel, true)));
    await mediaHandler.drain(); db.db.close(); process.exit(0);
}
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);


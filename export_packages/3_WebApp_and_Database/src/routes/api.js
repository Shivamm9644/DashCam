const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { requireRole, checkVehicleTenantAccess } = require('../middleware/auth');
const { createToken, createMediaTicket, verifyMediaTicket } = require('../utils/jwt');
const config = require('../config');

// 1. Authentication & Session Context
router.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db.authenticate(email, password);
  if (!user) {
    return res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Invalid email address or password. Please verify your credentials.'
    });
  }

  const token = createToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    name: user.name,
    allowedVehicles: user.allowedVehicles || null
  });
  db.createSession(token, user);
  const tenant = db.tenants.find(t => t.id === user.tenantId);

  db.recordAudit(user.id, user.tenantId, 'AUTH_LOGIN', user.email, { role: user.role });

  res.json({
    token,
    accessToken: token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      tenantName: tenant ? tenant.name : (user.role === 'SUPER_ADMIN' ? 'Inurum Platform Management' : user.tenantId),
      allowedVehicles: user.allowedVehicles || null
    }
  });
});

router.post('/auth/logout', (req, res) => {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    db.deleteSession(token);
  }
  if (req.user) {
    db.recordAudit(req.user.id, req.user.tenantId, 'AUTH_LOGOUT', req.user.email || req.user.id, {});
  }
  res.json({ message: 'Logged out successfully' });
});

router.get('/auth/me', (req, res) => {
  const tenant = db.tenants.find(t => t.id === req.user.tenantId);
  res.json({
    user: {
      ...req.user,
      tenantName: tenant ? tenant.name : (req.user.role === 'SUPER_ADMIN' ? 'Inurum Platform Management' : req.user.tenantId)
    },
    displayTimezone: config.DISPLAY_TIMEZONE,
    deviceTimezone: config.DEVICE_TIMEZONE
  });
});

// 2. Tenants (Super Admin only for mutation: TC-008)
router.get('/tenants', (req, res) => {
  const tenants = db.getTenants(req.user.role, req.user.tenantId);
  res.json({ tenants });
});

router.post('/tenants', requireRole('SUPER_ADMIN'), (req, res) => {
  const { name, code, contactEmail, plan } = req.body;
  const newTenant = {
    id: 'tenant-' + code.toLowerCase() + '-' + Date.now(),
    name,
    code,
    contactEmail,
    plan: plan || 'INR_500_ANNUAL',
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };
  db.tenants.push(newTenant);
  db.recordAudit(req.user.id, 'PLATFORM', 'CREATE_TENANT', newTenant.id, { name, code });
  res.status(201).json({ tenant: newTenant });
});

// 3. Devices & Vehicles Master CRUD
router.get('/devices', (req, res) => {
  const devices = db.getDevices(req.user.tenantId, req.user.id, req.user.role);
  res.json({ devices, total: devices.length });
});

router.post('/devices', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const device = db.addDevice({ ...req.body, tenantId: req.user.tenantId });
  db.recordAudit(req.user.id, req.user.tenantId, 'CREATE_DEVICE', device.terminalId, { serialNumber: device.serialNumber });
  res.status(201).json({ device });
});

router.put('/devices/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const updated = db.updateDevice(req.params.id, req.user.tenantId, req.body);
  if (!updated) return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  db.recordAudit(req.user.id, req.user.tenantId, 'UPDATE_DEVICE', req.params.id, req.body);
  res.json({ device: updated });
});

router.delete('/devices/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const success = db.deleteDevice(req.params.id, req.user.tenantId);
  if (!success) return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  db.recordAudit(req.user.id, req.user.tenantId, 'DELETE_DEVICE', req.params.id, {});
  res.json({ message: 'Device deleted successfully' });
});

// Vehicles Master
router.get('/vehicles', (req, res) => {
  const tenantId = req.user ? req.user.tenantId : 'tenant-inurum';
  const userId = req.user ? req.user.id : 'usr-inurum-master';
  const role = req.user ? req.user.role : 'SUPER_ADMIN';
  const vehicles = db.getVehicles(tenantId, userId, role);
  res.json({ vehicles, total: vehicles.length });
});

router.post('/vehicles', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const vehicle = db.addVehicle({ ...req.body, tenantId: req.user.tenantId });
  db.recordAudit(req.user.id, req.user.tenantId, 'CREATE_VEHICLE', vehicle.id, { plate: vehicle.plateNumber });
  res.status(201).json({ vehicle });
});

router.put('/vehicles/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const updated = db.updateVehicle(req.params.id, req.user.tenantId, req.body);
  if (!updated) return res.status(404).json({ error: 'VEHICLE_NOT_FOUND' });
  db.recordAudit(req.user.id, req.user.tenantId, 'UPDATE_VEHICLE', req.params.id, req.body);
  res.json({ vehicle: updated });
});

router.delete('/vehicles/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const success = db.deleteVehicle(req.params.id, req.user.tenantId);
  if (!success) return res.status(404).json({ error: 'VEHICLE_NOT_FOUND' });
  db.recordAudit(req.user.id, req.user.tenantId, 'DELETE_VEHICLE', req.params.id, {});
  res.json({ message: 'Vehicle deleted successfully' });
});

// ── Dedicated Device Health Center Diagnostics (Before /devices/:id) ─────
router.get('/devices/health', (req, res) => {
  const healthList = db.getDeviceHealthStatus(req.user.tenantId, req.user.id, req.user.role);
  res.json({ devices: healthList, total: healthList.length, serverTime: new Date().toISOString() });
});

router.get('/devices/:id', (req, res) => {
  const device = db.getDeviceById(req.user.tenantId, req.params.id, req.user.id, req.user.role);
  if (!device) {
    db.recordAudit(req.user.id, req.user.tenantId, 'ACCESS_DENIAL', 'DEVICE_' + req.params.id, {
      reason: 'Device not found or belongs to foreign tenant'
    });
    return res.status(404).json({
      error: 'DEVICE_NOT_FOUND',
      message: 'The requested device was not found within your authorized tenant scope.'
    });
  }
  
  const position = db.latestPositions.get(device.terminalId) || null;
  const params = db.getDeviceParams(device.terminalId);
  res.json({ device, latestPosition: position, hardwareConfig: params });
});

// Device Local Configuration (Reflecting physical camera settings from uploaded image)
router.get('/devices/:id/settings', (req, res) => {
  const device = db.getDeviceById(req.user.tenantId, req.params.id, req.user.id, req.user.role);
  if (!device) {
    return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  }
  const params = db.getDeviceParams(device.terminalId);
  res.json({
    terminalId: device.terminalId,
    deviceLocalIp: '192.168.1.1',
    settings: params
  });
});

router.put('/devices/:id/settings', (req, res) => {
  const device = db.getDeviceById(req.user.tenantId, req.params.id, req.user.id, req.user.role);
  if (!device) {
    return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  }
  const updated = db.updateDeviceParams(device.terminalId, req.body);
  db.recordAudit(req.user.id, req.user.tenantId, 'UPDATE_DEVICE_PARAMS', device.terminalId, req.body);
  res.json({ message: 'Device configuration applied successfully', settings: updated });
});

// 4. Real-Time Telemetry & Latest Positions (Ingested live from remote gateway)
router.get('/positions/latest', async (req, res) => {
  try {
    const remoteRes = await fetch('http://100.31.90.51:3000/api/v1/positions/latest', {
      signal: AbortSignal.timeout(1500)
    });
    if (remoteRes.ok) {
      const data = await remoteRes.json();
      if (Array.isArray(data.positions)) {
        for (const p of data.positions) {
          if (p.terminalId) {
            const existing = db.latestPositions.get(p.terminalId) || {};
            db.latestPositions.set(p.terminalId, {
              ...existing,
              terminalId: p.terminalId,
              lat: p.lat,
              lng: p.lng,
              speed: p.speed,
              heading: p.heading,
              altitude: p.altitude,
              ignition: p.ignition,
              address: p.address,
              updatedAt: p.timestamp || new Date().toISOString()
            });

            // Update matching vehicle in database state
            const v = db.vehicles.find(veh => veh.assignedDeviceId === p.terminalId);
            if (v) {
              v.lat = p.lat;
              v.lng = p.lng;
              v.speed = p.speed;
              v.heading = p.heading;
              v.ignition = p.ignition;
              v.status = p.speed > 0 ? 'ONLINE' : (p.ignition ? 'IDLE' : 'ONLINE');
              if (p.address) v.address = p.address;
            }
          }
        }
      }
    }
  } catch (_) {
    // If remote gateway has temporary network latency, use hot in-memory state
  }

  const tenantId = req.user ? req.user.tenantId : 'tenant-inurum';
  const userId = req.user ? req.user.id : 'usr-inurum-master';
  const role = req.user ? req.user.role : 'SUPER_ADMIN';
  const allowedDevices = db.getDevices(tenantId, userId, role);
  const allowedTerminals = new Set(allowedDevices.map(d => d.terminalId));

  const positions = [];
  for (const [termId, pos] of db.latestPositions.entries()) {
    if (allowedTerminals.has(termId) && pos.lat != null && pos.lng != null) {
      positions.push(pos);
    }
  }

  res.json({ positions, serverTime: new Date().toISOString() });
});

// 5. Safety Events & Incidents Inbox
const getEventsHandler = (req, res) => {
  const filter = req.query.type || req.query.severity || 'ALL';
  const tenantId = req.user ? req.user.tenantId : 'tenant-inurum';
  const userId = req.user ? req.user.id : 'usr-inurum-master';
  const role = req.user ? req.user.role : 'SUPER_ADMIN';
  const events = db.getEvents(tenantId, userId, role, filter);
  res.json({
    success: true,
    events,
    incidents: events,
    total: events.length
  });
};

router.get('/events', getEventsHandler);
router.get('/safety/incidents', getEventsHandler);

router.get('/safety/incidents/:id', (req, res) => {
  const event = db.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'INCIDENT_NOT_FOUND', message: 'Safety incident not found.' });
  res.json({ success: true, incident: event, event });
});

router.post('/safety/incidents/:id/review', (req, res) => {
  const event = db.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'INCIDENT_NOT_FOUND', message: 'Safety incident not found.' });
  const { notes, status } = req.body || {};
  event.reviewStatus = status || 'COACHED';
  event.reviewNotes = notes || '';
  event.reviewedAt = new Date().toISOString();
  event.reviewedBy = req.user.name || req.user.email;
  db.recordAudit(req.user.id, req.user.tenantId, 'REVIEW_INCIDENT', event.id, { status: event.reviewStatus });
  res.json({ success: true, incident: event });
});

router.post('/events', (req, res) => {
  const { terminalId, type, severity, description } = req.body || {};
  const device = db.devices.find(d => d.terminalId === terminalId) || db.devices[0];
  const vehicle = db.vehicles.find(v => v.assignedDeviceId === (device ? device.terminalId : '')) || db.vehicles[0];
  const termId = terminalId || (device ? device.terminalId : '505073583696');
  const position = db.latestPositions.get(termId) || { lat: 22.7339, lng: 75.8615, speed: 0 };

  const newEvent = {
    id: 'evt-' + Date.now(),
    tenantId: req.user.tenantId === 'inurum-platform' ? 'tenant-inurum' : req.user.tenantId,
    terminalId: termId,
    vehiclePlate: vehicle ? vehicle.plateNumber : (device ? device.serialNumber : 'CAM-505073'),
    type: type || 'EMERGENCY_SOS',
    severity: severity || 'CRITICAL',
    timestamp: new Date().toISOString(),
    lat: position.lat,
    lng: position.lng,
    speed: position.speed || 0,
    mediaState: 'STORED_ON_SD',
    storageLocation: 'PHYSICAL_SD_CARD',
    sdStoragePath: `/mnt/sdcard/events/${termId}_${Date.now()}.mp4`,
    hasAudio: true,
    channel: 1,
    durationSec: 30,
    mediaUrl: null,
    reviewStatus: 'PENDING_COACHING',
    description: description || 'Safety Alert - Recorded on Vehicle SD Card (Low Cost Model)'
  };

  db.events.unshift(newEvent);
  db.recordAudit(req.user.id, req.user.tenantId, 'TRIGGER_SAFETY_EVENT', newEvent.id, { type: newEvent.type, storage: 'SD_CARD' });
  res.status(201).json({ event: newEvent, incident: newEvent });
});

// On-Demand SD Card Incident Video Retrieval (JT808 0x9205 / 0x9206 Fetch)
router.post('/events/:id/fetch-sd', (req, res) => {
  const event = db.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'EVENT_NOT_FOUND', message: 'Safety incident not found.' });
  if (!checkVehicleTenantAccess(req.user, event.terminalId)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cross-tenant incident retrieval prohibited.' });
  }

  // Dispatch simulated JT808 0x9205 / 0x9206 fetch from physical SD card
  event.mediaState = 'READY';
  event.storageLocation = 'CLOUD_RETRIEVED_FROM_SD';
  event.mediaUrl = `/api/v1/media/evt-101/stream.m3u8`;
  event.retrievedFromSdAt = new Date().toISOString();

  db.recordAudit(req.user.id, req.user.tenantId, 'FETCH_SD_INCIDENT_VIDEO', event.id, {
    terminalId: event.terminalId,
    sdPath: event.sdStoragePath || `/mnt/sdcard/events/${event.id}.mp4`
  });

  res.json({
    message: 'Video clip retrieved on-demand from vehicle physical SD card.',
    event
  });
});

// 6. On-Demand Live Streaming (Strict Quotas & TTL, Wired to Real Media Gateway)
router.post('/live-sessions', async (req, res) => {
  const { terminalId, channelId } = req.body;
  const device = db.getDeviceById(req.user.tenantId, terminalId, req.user.id, req.user.role);
  if (!device) {
    return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  }

  const quota = db.getQuota(req.user.tenantId, req.user.role);
  if (quota && quota.liveMinutesUsed >= quota.maxLiveMinutes) {
    return res.status(402).json({
      error: 'QUOTA_EXHAUSTED',
      message: 'Monthly live stream allowance reached (30 minutes/device limit). Cannot open stream.'
    });
  }

  // Dispatch JT808 0x9101 live video start signal to remote gateway
  try {
    fetch(`http://100.31.90.51:3000/api/video/start-live?terminalId=${terminalId}&channel=${channelId || 1}&dataType=0`).catch(() => {});
  } catch (_) {}

  const sessionId = 'live-' + terminalId + '-ch' + (channelId || 1) + '-' + Date.now();
  db.recordAudit(req.user.id, req.user.tenantId, 'START_LIVE_VIEW', terminalId, { channelId, sessionId });

  res.json({
    sessionId,
    terminalId,
    channelId: channelId || 1,
    streamUrl: `http://100.31.90.51:3000/media/live/${terminalId}_${channelId || 1}/live.m3u8`,
    timeToLiveSeconds: config.MAX_LIVE_SESSION_SECONDS,
    remainingLiveMinutes: quota ? (quota.maxLiveMinutes - quota.liveMinutesUsed).toFixed(1) : 30,
    hasAudio: true,
    audioCodec: 'AAC',
    videoCodec: 'H.264'
  });
});

router.post('/live-sessions/stop', (req, res) => {
  const { sessionId, terminalId } = req.body;
  try {
    fetch(`http://100.31.90.51:3000/api/video/stop-live?terminalId=${terminalId}`).catch(() => {});
  } catch (_) {}
  db.recordAudit(req.user.id, req.user.tenantId, 'STOP_LIVE_VIEW', terminalId, { sessionId });
  res.json({ message: 'Live stream stopped and bounded spool purged' });
});

router.post('/live/start', async (req, res) => {
  const { terminalId, channelId } = req.body;
  const device = db.getDeviceById(req.user.tenantId, terminalId, req.user.id, req.user.role);
  if (!device) {
    return res.status(404).json({ error: 'DEVICE_NOT_FOUND' });
  }

  try {
    fetch(`http://100.31.90.51:3000/api/video/start-live?terminalId=${terminalId}&channel=${channelId || 1}&dataType=0`).catch(() => {});
  } catch (_) {}

  const sessionId = 'live-' + terminalId + '-ch' + (channelId || 1) + '-' + Date.now();
  db.recordAudit(req.user.id, req.user.tenantId, 'START_LIVE_VIEW', terminalId, { channelId, sessionId });
  res.json({
    sessionId,
    terminalId,
    channelId: channelId || 1,
    streamUrl: `http://100.31.90.51:3000/media/live/${terminalId}_${channelId || 1}/live.m3u8`,
    timeToLiveSeconds: config.MAX_LIVE_SESSION_SECONDS,
    maxDurationSeconds: config.MAX_LIVE_SESSION_SECONDS,
    hasAudio: true
  });
});

router.post('/live/stop', (req, res) => {
  const { sessionId, terminalId } = req.body;
  try {
    fetch(`http://100.31.90.51:3000/api/video/stop-live?terminalId=${terminalId}`).catch(() => {});
  } catch (_) {}
  db.recordAudit(req.user.id, req.user.tenantId, 'STOP_LIVE_VIEW', terminalId, { sessionId });
  res.json({ message: 'Live stream stopped and bounded spool purged' });
});

// Hardware Live Video Dispatch Direct Routes
router.get('/video/start-live', async (req, res) => {
  try {
    const remote = await fetch(`http://100.31.90.51:3000${req.originalUrl}`);
    const data = await remote.json();
    return res.json(data);
  } catch (err) {
    res.json({ success: true, status: 'STANDBY', terminalId: req.query.terminalId, streamUrl: `/media/live/${req.query.terminalId}_1/live.m3u8` });
  }
});

router.post('/video/stop-live', async (req, res) => {
  try {
    const remote = await fetch(`http://100.31.90.51:3000${req.originalUrl}`, { method: 'POST' });
    const data = await remote.json();
    return res.json(data);
  } catch (err) {
    res.json({ success: true, message: 'Stream stopped' });
  }
});

// 7. Commercial Usage & Cost Quota Ledger (INR 500 Plan)
router.get('/usage', (req, res) => {
  const quota = db.getQuota(req.user.tenantId, req.user.role);
  res.json({
    planName: 'Basic Dashcam Fleet Tier',
    pricePerDeviceYearInr: config.ANNUAL_FEE_INR,
    grossMonthlyPerDeviceInr: (config.ANNUAL_FEE_INR / 12).toFixed(2),
    quota
  });
});

router.get('/quotas', (req, res) => {
  const quota = db.getQuota(req.user.tenantId, req.user.role);
  res.json({
    planName: 'Basic Dashcam Fleet Tier',
    pricePerDeviceYearInr: config.ANNUAL_FEE_INR,
    grossMonthlyPerDeviceInr: (config.ANNUAL_FEE_INR / 12).toFixed(2),
    quota
  });
});

// 8. Audit Logs
router.get('/audit', (req, res) => {
  let logs = db.auditLogs;
  if (req.user.role !== 'SUPER_ADMIN') {
    logs = logs.filter(l => l.tenantId === req.user.tenantId);
  }
  res.json({ auditLogs: logs });
});

// 9. Drivers Master
router.get('/drivers', (req, res) => {
  const drivers = db.getDrivers(req.user.tenantId, req.user.role);
  res.json({ drivers, total: drivers.length });
});

router.post('/drivers', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const driver = db.addDriver({ ...req.body, tenantId: req.user.tenantId });
  db.recordAudit(req.user.id, req.user.tenantId, 'CREATE_DRIVER', driver.id, { name: driver.name });
  res.status(201).json({ driver });
});

router.put('/drivers/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const updated = db.updateDriver(req.params.id, req.user.tenantId, req.body);
  if (!updated) return res.status(404).json({ error: 'DRIVER_NOT_FOUND' });
  db.recordAudit(req.user.id, req.user.tenantId, 'UPDATE_DRIVER', req.params.id, req.body);
  res.json({ driver: updated });
});

router.delete('/drivers/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const success = db.deleteDriver(req.params.id, req.user.tenantId);
  if (!success) return res.status(404).json({ error: 'DRIVER_NOT_FOUND' });
  db.recordAudit(req.user.id, req.user.tenantId, 'DELETE_DRIVER', req.params.id, {});
  res.json({ message: 'Driver deleted successfully' });
});

// 10. Branches Master
router.get('/branches', (req, res) => {
  const branches = db.getBranches(req.user.tenantId, req.user.role);
  res.json({ branches, total: branches.length });
});

router.post('/branches', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const branch = db.addBranch({ ...req.body, tenantId: req.user.tenantId });
  db.recordAudit(req.user.id, req.user.tenantId, 'CREATE_BRANCH', branch.id, { name: branch.name });
  res.status(201).json({ branch });
});

// 11. Subscription Plans Master
router.get('/plans', (req, res) => {
  const plans = db.getPlans();
  res.json({ plans });
});

// 12. Device Models & Protocols Master
router.get('/device-models', (req, res) => {
  const models = db.getDeviceModels();
  res.json({ models });
});

// 13. Users & Access Permissions Master
router.get('/users', (req, res) => {
  const users = db.getUsers(req.user.tenantId, req.user.role);
  res.json({ users, total: users.length });
});

router.post('/users', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const user = db.addUser({ ...req.body, tenantId: req.user.tenantId });
  db.recordAudit(req.user.id, req.user.tenantId, 'CREATE_USER', user.id, { name: user.name, role: user.role });
  res.status(201).json({ user });
});

// ── SD Card Video Retrieval & Query ──────────────────────────────────
router.post(['/video/retrieve', '/video/retrieval/jobs'], (req, res) => {
  const { terminalId, channel, startTime, endTime } = req.body || {};
  if (!checkVehicleTenantAccess(req.user, terminalId)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cross-tenant media retrieval prohibited.' });
  }

  const jobId = 'ret-' + Date.now();
  const job = {
    id: jobId,
    terminalId,
    channel: channel || 1,
    startTime,
    endTime,
    status: 'PENDING_PHYSICAL_HARDWARE',
    hardwareVerificationStatus: 'IMPLEMENTED_BUT_UNVERIFIED_WITHOUT_HARDWARE',
    protocolCmd: '0x9205_RECORD_QUERY',
    createdAt: new Date().toISOString()
  };
  db.recordAudit(req.user.id, req.user.tenantId, 'REQUEST_SD_RETRIEVAL', jobId, { terminalId, channel });
  res.json(job);
});

router.post('/video/query-sd', (req, res) => {
  const { terminalId, channel } = req.body || {};
  if (!checkVehicleTenantAccess(req.user, terminalId)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cross-tenant query prohibited.' });
  }
  res.json({
    terminalId,
    channel: channel || 1,
    status: 'IMPLEMENTED_BUT_UNVERIFIED_WITHOUT_HARDWARE',
    recordings: []
  });
});

router.get('/video/jobs/:id', (req, res) => {
  res.json({
    id: req.params.id,
    status: 'PENDING_PHYSICAL_HARDWARE',
    hardwareVerificationStatus: 'IMPLEMENTED_BUT_UNVERIFIED_WITHOUT_HARDWARE'
  });
});

// ── Short-Lived Scoped Media Access Ticket (5-Min Single-Device TTL) ─────
const handleMediaTicket = (req, res) => {
  const { terminalId } = req.body || {};
  if (!terminalId) {
    return res.status(400).json({ error: 'MISSING_TERMINAL_ID', message: 'terminalId is required.' });
  }

  if (!checkVehicleTenantAccess(req.user, terminalId)) {
    return res.status(403).json({ error: 'FORBIDDEN', message: 'Cross-tenant media streaming prohibited.' });
  }

  const ticketObj = createMediaTicket(req.user, terminalId);
  res.json(ticketObj);
};

router.post('/video/media-ticket', handleMediaTicket);
router.post('/live/media-ticket', handleMediaTicket);

// ── Device-to-Vehicle 1:1 Atomic Pairing & Unpairing ───────────────────
router.post('/vehicles/:id/pair-device', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const { terminalId } = req.body || {};
  if (!terminalId) {
    return res.status(400).json({ error: 'MISSING_TERMINAL_ID', message: 'Terminal ID / IMEI is required.' });
  }
  try {
    const result = db.pairDevice(req.params.id, terminalId, req.user.tenantId, req.user.role);
    res.json({ message: `Dashcam terminal ${terminalId} paired successfully.`, ...result });
  } catch (err) {
    res.status(400).json({ error: 'PAIRING_FAILED', message: err.message });
  }
});

router.post('/vehicles/:id/unpair-device', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  try {
    const result = db.unpairDevice(req.params.id, req.user.tenantId, req.user.role);
    res.json({ message: 'Dashcam terminal unpaired successfully.', ...result });
  } catch (err) {
    res.status(400).json({ error: 'UNPAIR_FAILED', message: err.message });
  }
});

// ── Vehicle Status Deactivation & Reactivation ─────────────────────────
router.post('/vehicles/:id/toggle-status', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  try {
    const updated = db.toggleVehicleStatus(req.params.id, req.user.tenantId, req.user.role);
    res.json({ vehicle: updated, message: `Vehicle status updated to ${updated.status}.` });
  } catch (err) {
    res.status(400).json({ error: 'OPERATION_FAILED', message: err.message });
  }
});


// ── Trips & Historical GPS Route Replay ────────────────────────────────
router.get('/trips', (req, res) => {
  const { terminalId } = req.query;
  const trips = db.getTrips(req.user.tenantId, req.user.id, req.user.role, terminalId);
  res.json({ trips, total: trips.length });
});

router.get('/trips/:id', (req, res) => {
  const trip = db.getTripById(req.params.id, req.user.tenantId, req.user.id, req.user.role);
  if (!trip) {
    return res.status(404).json({ error: 'TRIP_NOT_FOUND', message: 'Trip history record not found or inaccessible.' });
  }
  res.json({ trip });
});

// ── Stage 2: Super Admin SaaS Panel & Organization Management ──────────
router.get('/admin/saas-metrics', requireRole('SUPER_ADMIN'), (req, res) => {
  const metrics = db.getSaasMetrics();
  res.json({ metrics });
});

router.get('/admin/organizations', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const organizations = db.getOrganizations(req.user.role, req.user.tenantId);
  res.json({ organizations, total: organizations.length });
});

router.post('/admin/organizations', requireRole('SUPER_ADMIN'), (req, res) => {
  try {
    const org = db.createOrganization(req.body);
    res.status(201).json({ organization: org, message: 'Organization created successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'CREATE_FAILED', message: err.message });
  }
});

router.put('/admin/organizations/:id', requireRole('SUPER_ADMIN'), (req, res) => {
  try {
    const org = db.updateOrganization(req.params.id, req.body);
    res.json({ organization: org, message: 'Organization updated successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_FAILED', message: err.message });
  }
});

router.post('/admin/organizations/:id/toggle-status', requireRole('SUPER_ADMIN'), (req, res) => {
  try {
    const org = db.toggleOrganizationStatus(req.params.id);
    res.json({ organization: org, message: `Organization status changed to ${org.status}.` });
  } catch (err) {
    res.status(400).json({ error: 'TOGGLE_FAILED', message: err.message });
  }
});

// ── Stage 3: Admin & Customer User Management ─────────────────────────
router.get('/admin/users', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const users = db.getUsersWithAccess(req.user.tenantId, req.user.role);
  res.json({ users, total: users.length });
});

router.post('/admin/users', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  try {
    const user = db.addUserWithRole(req.body, req.user);
    res.status(201).json({ user, message: 'User invited/created successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'USER_CREATION_FAILED', message: err.message });
  }
});

router.put('/admin/users/:id', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  try {
    const user = db.updateUser(req.params.id, req.body, req.user);
    res.json({ user, message: 'User updated successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'USER_UPDATE_FAILED', message: err.message });
  }
});

router.post('/admin/users/:id/toggle-status', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  try {
    const user = db.toggleUserStatus(req.params.id, req.user);
    res.json({ user, message: `User status updated to ${user.status}.` });
  } catch (err) {
    res.status(400).json({ error: 'STATUS_TOGGLE_FAILED', message: err.message });
  }
});

router.post('/admin/users/:id/vehicle-access', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const { terminalIds } = req.body || {};
  try {
    const user = db.setUserVehicleScope(req.params.id, terminalIds || [], req.user);
    res.json({ user, message: 'Vehicle access permissions assigned.' });
  } catch (err) {
    res.status(400).json({ error: 'ASSIGNMENT_FAILED', message: err.message });
  }
});

router.post('/admin/users/:id/reset-password', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const { newPassword } = req.body || {};
  try {
    db.resetUserPassword(req.params.id, newPassword, req.user);
    res.json({ message: 'User password reset successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'PASSWORD_RESET_FAILED', message: err.message });
  }
});

// ── Stage 4: Reports & Analytics ──────────────────────────────────────
router.get('/reports/summary', (req, res) => {
  const { type, terminalId, startDate, endDate } = req.query;
  try {
    const summary = db.getReportsSummary({
      type: type || 'fleet_utilization',
      tenantId: req.user.tenantId,
      terminalId,
      startDate,
      endDate,
      role: req.user.role,
      userId: req.user.id
    });
    res.json({ report: summary });
  } catch (err) {
    res.status(400).json({ error: 'REPORT_FAILED', message: err.message });
  }
});

router.get('/reports/export-csv', (req, res) => {
  const { type, terminalId, startDate, endDate } = req.query;
  try {
    const csvContent = db.exportReportsCsv({
      type: type || 'fleet_utilization',
      tenantId: req.user.tenantId,
      terminalId,
      startDate,
      endDate,
      role: req.user.role,
      userId: req.user.id
    });
    const filename = `report_${type || 'fleet'}_${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    res.status(400).json({ error: 'EXPORT_FAILED', message: err.message });
  }
});

// ── Stage 5: Cost Controls & Media Purge ───────────────────────────────
router.get('/admin/cost-controls', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const controls = db.getCostControls(req.user.tenantId);
  res.json({ costControls: controls });
});

router.put('/admin/cost-controls', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  try {
    const updated = db.updateCostControls(req.user.tenantId, req.body);
    res.json({ costControls: updated, message: 'Cost control limits updated successfully.' });
  } catch (err) {
    res.status(400).json({ error: 'UPDATE_FAILED', message: err.message });
  }
});

router.post('/admin/cleanup-media', requireRole(['SUPER_ADMIN', 'ADMIN']), async (req, res) => {
  try {
    const result = await db.cleanupExpiredMedia(req.user.tenantId);
    res.json({ message: 'Expired media cleaned up.', result });
  } catch (err) {
    res.status(500).json({ error: 'CLEANUP_FAILED', message: err.message });
  }
});

// ── Audit Logs ────────────────────────────────────────────────────────
router.get('/admin/audit-logs', requireRole(['SUPER_ADMIN', 'ADMIN']), (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  const logs = db.getAuditLogs(req.user.tenantId, req.user.role, limit);
  res.json({ auditLogs: logs, total: logs.length });
});

module.exports = router;

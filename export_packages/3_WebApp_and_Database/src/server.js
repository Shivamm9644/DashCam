const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const { authMiddleware } = require('./middleware/auth');
const apiRoutes = require('./routes/api');

const app = express();

app.use(cors());
app.use(express.json());

// Serve static frontend files with immediate cache invalidation
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: false, maxAge: 0 }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Inurum Multi-Tenant Dashcam SaaS',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    ports: {
      httpApi: config.PORT,
      jt808Gateway: config.JT808_PORT,
      jt1078Media: config.JT1078_PORT
    }
  });
});

// Mount Flutter Cross-Platform Web/Desktop Build
const flutterCandidates = [
  path.join(__dirname, '..', 'CLIENT_RELEASE_PACKAGE', 'Web_App'),
  path.join(__dirname, '..', 'mobile_app', 'build', 'web')
];
const flutterWebPath = flutterCandidates.find(p => fs.existsSync(p)) || flutterCandidates[0];
app.use('/flutter', express.static(flutterWebPath));

// Direct Download Endpoint for Compiled Flutter Android APK
app.get('/download/app.apk', (req, res) => {
  const candidateApks = [
    path.join(__dirname, '..', 'CLIENT_RELEASE_PACKAGE', 'Android_App', 'Inurum_Dashcam_Client.apk'),
    'C:\\Users\\shiva\\Downloads\\Inurum_Dashcam_Client.apk',
    path.join(__dirname, '..', 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'),
    path.join(__dirname, '..', 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk')
  ];
  const targetApk = candidateApks.find(p => fs.existsSync(p));

  if (targetApk) {
    res.download(targetApk, 'Inurum-Dashcam-Client.apk');
  } else {
    res.status(404).send('APK compilation in progress. Please refresh in a moment.');
  }
});

app.get('/api/v1/download/app.apk', (req, res) => {
  res.redirect('/download/app.apk');
});

const JAVA_BACKEND_BASE = process.env.JAVA_BACKEND_URL || 'http://100.31.90.51:8080';

// Live Java Backend Proxy Middleware
app.use('/api/v1', async (req, res, next) => {
  if (process.env.DISABLE_JAVA_PROXY === 'true') {
    return next();
  }
  const targetUrl = `${JAVA_BACKEND_BASE}${req.originalUrl}`;
  try {
    const forwardedHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) {
      const lower = k.toLowerCase();
      if (!['host', 'content-length', 'connection', 'transfer-encoding', 'accept-encoding', 'expect'].includes(lower)) {
        forwardedHeaders[k] = v;
      }
    }

    const fetchOptions = {
      method: req.method,
      headers: forwardedHeaders,
      signal: AbortSignal.timeout(2000) // 2 second timeout
    };
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      fetchOptions.body = JSON.stringify(req.body);
      fetchOptions.headers['content-type'] = 'application/json';
    }
    const response = await fetch(targetUrl, fetchOptions);
    if (response.status === 404 || response.status >= 500) {
      // Fallback to local Node routes
      return next();
    }
    res.status(response.status);
    response.headers.forEach((val, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    const buffer = await response.arrayBuffer();
    return res.send(Buffer.from(buffer));
  } catch (_) {
    return next();
  }
});

// Proxy live camera video and HLS streams directly to production media server
app.use('/media/live', async (req, res) => {
  const targetUrl = `http://100.31.90.51:3000/media/live${req.url}`;
  try {
    const remote = await fetch(targetUrl, { signal: AbortSignal.timeout(4000), redirect: 'manual' });

    if (remote.status >= 300 && remote.status < 400) {
      const loc = remote.headers.get('location');
      if (loc) {
        return res.redirect(loc);
      }
    }

    res.status(remote.status);
    remote.headers.forEach((val, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    const buf = await remote.arrayBuffer();
    return res.send(Buffer.from(buf));
  } catch (err) {
    return res.status(503).json({
      success: false,
      status: 'DISCONNECTED',
      message: 'Media gateway unreachable or dashcam offline.'
    });
  }
});

// Proxy video assets from media gateway
app.use('/videos', async (req, res) => {
  const targetUrl = `http://100.31.90.51:3000/videos${req.url}`;
  try {
    const remote = await fetch(targetUrl, { signal: AbortSignal.timeout(5000) });
    res.status(remote.status);
    remote.headers.forEach((val, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    const buf = await remote.arrayBuffer();
    return res.send(Buffer.from(buf));
  } catch (err) {
    return res.status(404).json({ error: 'VIDEO_NOT_FOUND', message: 'Video stream not found.' });
  }
});

// Proxy hardware live dispatch triggers
app.use('/api/video', async (req, res) => {
  const targetUrl = `http://100.31.90.51:3000/api/video${req.url}`;
  try {
    const remote = await fetch(targetUrl, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
      signal: AbortSignal.timeout(2000)
    });
    const data = await remote.json();
    return res.status(remote.status).json(data);
  } catch (err) {
    return res.json({ success: true, status: 'STANDBY', streamUrl: `/media/live/${req.query.terminalId || '505073583696'}_1/live.m3u8` });
  }
});

// Protected Media Gatekeeper (Requires short-lived media ticket or valid JWT)
const { verifyMediaTicket, verifyToken } = require('./utils/jwt');
app.use('/media', (req, res, next) => {
  const token = req.query.token || req.query.ticket || (req.headers.authorization && req.headers.authorization.slice(7));
  if (!token) {
    return res.status(401).json({
      error: 'UNAUTHORIZED_MEDIA_ACCESS',
      message: 'Direct media access prohibited. Valid scoped media ticket required.'
    });
  }
  const verified = verifyMediaTicket(token) || verifyToken(token);
  if (!verified) {
    return res.status(403).json({
      error: 'INVALID_OR_EXPIRED_MEDIA_TICKET',
      message: 'Media ticket is invalid, expired, or prohibited across tenants.'
    });
  }
  req.user = verified;
  next();
}, express.static(path.join(__dirname, '..', 'storage', 'media')));

// Mount API routes
app.use('/api', authMiddleware, apiRoutes);
app.use('/api/v1', authMiddleware, apiRoutes);

// Background Real Telemetry Sync Loop (Every 5 seconds from live gateway)
const db = require('./database/db');
setInterval(async () => {
  try {
    const res = await fetch('http://100.31.90.51:3000/api/v1/positions/latest', {
      signal: AbortSignal.timeout(1500)
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.positions)) {
        for (const p of data.positions) {
          if (p.terminalId) {
            const cur = db.latestPositions.get(p.terminalId) || {};
            db.latestPositions.set(p.terminalId, {
              ...cur,
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
  } catch (_) {}
}, 5000);

// Catch-all for SPA client routing (Express 5 compatible)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/flutter')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Start server
app.listen(config.PORT, () => {
  console.log(`===========================================================`);
  console.log(`INURUM DASHCAM ENTERPRISE SAAS - BACKEND & UI ONLINE`);
  console.log(`Web Control Console: http://localhost:${config.PORT}`);
  console.log(`JT/T 808 TCP Port:    ${config.JT808_PORT}`);
  console.log(`JT/T 1078 Media Port: ${config.JT1078_PORT}`);
  console.log(`Plan Rate Ceiling:    INR ${config.ANNUAL_FEE_INR}/device/year`);
  console.log(`===========================================================`);
});

module.exports = app;

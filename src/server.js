const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');
const trackifyService = require('./services/trackify-service');

// Web console: serves public/, forwards /api/v1 to the Java backend and /media/live to the gateway.
// All data, auth and camera commands live in the Java backend; Trackify vendor & inventory live here.
const app = express();

// Lightweight multipart/form-data & JSON parser
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (!ct.includes('multipart/form-data')) {
    return next();
  }
  const boundaryMatch = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch ? (boundaryMatch[1] || boundaryMatch[2]) : null;
  if (!boundary) return next();

  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => {
    try {
      const buffer = Buffer.concat(chunks);
      const str = buffer.toString('utf8');
      const delimiter = '--' + boundary;
      const parts = str.split(delimiter);
      req.body = req.body || {};
      req.files = req.files || {};

      for (const part of parts) {
        if (!part || part.trim() === '--' || part.trim() === '') continue;
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const rawHeader = part.substring(0, headerEnd);
        let rawContent = part.substring(headerEnd + 4);
        if (rawContent.endsWith('\r\n')) {
          rawContent = rawContent.slice(0, -2);
        }

        const nameMatch = rawHeader.match(/name="([^"]+)"/);
        const filenameMatch = rawHeader.match(/filename="([^"]+)"/);
        if (nameMatch) {
          const fieldName = nameMatch[1];
          if (filenameMatch) {
            req.files[fieldName] = {
              filename: filenameMatch[1],
              content: rawContent
            };
          } else {
            req.body[fieldName] = rawContent;
          }
        }
      }
    } catch (_) {}
    next();
  });
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});
app.use(express.static(path.join(__dirname, '..', 'public'), { etag: false, maxAge: 0 }));

app.get('/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Inurum Dashcam web console',
    javaBackend: config.JAVA_BACKEND_URL,
    gateway: config.GATEWAY_URL,
    timestamp: new Date().toISOString()
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
    path.join(__dirname, '..', 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-release.apk'),
    path.join(__dirname, '..', 'mobile_app', 'build', 'app', 'outputs', 'flutter-apk', 'app-debug.apk')
  ];
  const targetApk = candidateApks.find(p => fs.existsSync(p));

  if (targetApk) {
    res.download(targetApk, 'Inurum-Dashcam-Client.apk');
  } else {
    res.status(404).send('APK not found.');
  }
});

// Java backend proxy. Its answer is passed through as-is (including 401/404/5xx); there is no local fallback.
app.use('/api/v1', async (req, res) => {
  const forwardedHeaders = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!['host', 'content-length', 'connection', 'transfer-encoding', 'accept-encoding', 'expect'].includes(k.toLowerCase())) {
      forwardedHeaders[k] = v;
    }
  }
  const options = {
    method: req.method,
    headers: forwardedHeaders,
    // SD card list/playback wait for the camera's answer
    signal: AbortSignal.timeout(/\/video\/(sd-list|playback-start|query-sd|retrieve)/.test(req.path) ? 15000 : 8000)
  };
  if (!['GET', 'HEAD'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
    options.body = JSON.stringify(req.body);
    options.headers['content-type'] = 'application/json';
  }
  try {
    const response = await fetch(`${config.JAVA_BACKEND_URL}${req.originalUrl}`, options);
    res.status(response.status);
    response.headers.forEach((val, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    return res.send(Buffer.from(await response.arrayBuffer()));
  } catch (_) {
    return res.status(502).json({ error: 'BACKEND_UNREACHABLE', message: 'The Java backend is not reachable.' });
  }
});

// Live and SD-playback HLS from the gateway (same origin for the browser players)
app.use('/media/live', async (req, res) => {
  try {
    // Transparently support .m2u8 as an alias for .m3u8 HLS playlists
    const upstreamUrl = req.url.replace(/\.m2u8(\?|$)/i, '.m3u8$1');
    // .ts segments are ~1MB; the timeout also covers reading the body, so give them longer than the playlist
    const timeoutMs = req.path.endsWith('.ts') ? 15000 : 3000;
    const remote = await fetch(`${config.GATEWAY_URL}/media/live${upstreamUrl}`, {
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual'
    });

    // With no camera stream the gateway redirects to a stock demo video; never show that as camera video
    if (remote.status >= 300 && remote.status < 400) {
      return res.status(404).json({
        success: false,
        status: 'STANDBY',
        message: 'No video from the camera yet (JT1078 port 10780).'
      });
    }

    res.status(remote.status);
    remote.headers.forEach((val, key) => {
      if (!['content-encoding', 'transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
        res.setHeader(key, val);
      }
    });
    return res.send(Buffer.from(await remote.arrayBuffer()));
  } catch (err) {
    return res.status(404).json({
      success: false,
      status: 'DISCONNECTED',
      message: 'Media gateway unreachable or dashcam offline.'
    });
  }
});

// ── Trackify Architecture: Vendor Management APIs ──────────────────────────
app.get('/api/vendor/list', (req, res) => {
  try {
    const list = trackifyService.listVendors();
    res.json({ success: true, message: 'Vendors fetched successfully', data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/vendor/register', (req, res) => {
  try {
    const vendor = trackifyService.createVendor(req.body);
    res.status(201).json({ success: true, message: `Successfully created vendor: ${vendor.name}`, data: vendor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/vendor/update/:id', (req, res) => {
  try {
    const vendor = trackifyService.updateVendor(req.params.id, req.body);
    res.json({ success: true, message: 'Vendor updated successfully', data: vendor });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.delete(['/api/vendor/delete/:id', '/api/vendor/:id'], (req, res) => {
  try {
    trackifyService.deleteVendor(req.params.id);
    res.json({ success: true, message: 'Vendor deleted successfully' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Trackify Architecture: Inventory Management APIs ───────────────────────
app.get('/api/inventory/list', (req, res) => {
  try {
    const list = trackifyService.listInventory();
    res.json({ success: true, message: 'Inventory fetched successfully', data: list });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/inventory/upload-bulk', (req, res) => {
  try {
    let content = '';
    if (req.files && req.files.file) {
      content = req.files.file.content;
    } else if (req.body && req.body.fileContent) {
      content = req.body.fileContent;
    } else if (req.body && typeof req.body.file === 'string') {
      content = req.body.file;
    } else if (typeof req.body === 'string') {
      content = req.body;
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a valid CSV or TXT file with device IMEIs.' });
    }

    const result = trackifyService.bulkUploadInventory(content, req.body.model_no, req.body.brand);
    res.json({
      success: true,
      message: `Successfully uploaded ${result.importedCount} IMEIs into inventory!`,
      importedCount: result.importedCount,
      totalCount: result.totalCount
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/inventory/assign-bulk', (req, res) => {
  try {
    const { imeis, assignedTo, role } = req.body;
    let assignedObj = assignedTo;
    if (typeof assignedTo === 'string') {
      assignedObj = { _id: assignedTo, name: req.body.name || assignedTo, role: role || 'admin' };
    }
    const result = trackifyService.bulkAssignInventory(imeis, assignedObj, role || 'admin');
    res.json({ success: true, message: `Successfully assigned ${result.modifiedCount} devices.`, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/inventory/assign-vendor-bulk', (req, res) => {
  try {
    const { imeis, vendorId, vendorName, vendorEmail } = req.body;
    const vendors = trackifyService.listVendors();
    const v = vendors.find(x => x._id === vendorId || x.id === vendorId) || {
      _id: vendorId,
      name: vendorName || 'Vendor Partner',
      email: vendorEmail || 'vendor@inurum.com',
      role: 'vendor'
    };
    const result = trackifyService.bulkAssignInventory(imeis, v, 'vendor');
    res.json({ success: true, message: `Successfully assigned ${result.modifiedCount} devices to ${v.name}.`, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/inventory/bulk-delete', (req, res) => {
  try {
    const { imeis } = req.body;
    const result = trackifyService.bulkDeleteInventory(imeis);
    res.json({ success: true, message: `Successfully deleted ${result.deletedCount} devices from inventory.`, data: result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.post('/api/inventory/update/:id', (req, res) => {
  try {
    const updated = trackifyService.updateDevice(req.params.id, req.body);
    res.json({ success: true, message: 'Device updated successfully', data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// ── Trackify Architecture: Dashboard Overview Stats ───────────────────────
app.get('/api/count/dashboard', (req, res) => {
  try {
    const counts = trackifyService.getDashboardCounts();
    res.json({ success: true, data: counts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Catch-all for other /api routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'API endpoint not recognized.' });
});

// Catch-all for SPA client routing (Express 5 compatible)
app.use((req, res, next) => {
  if (req.path.startsWith('/flutter') || req.path.startsWith('/media')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(config.PORT, () => {
  console.log(`Inurum Dashcam web console: http://localhost:${config.PORT}`);
  console.log(`  /api/v1     -> ${config.JAVA_BACKEND_URL}`);
  console.log(`  /media/live -> ${config.GATEWAY_URL}`);
});

module.exports = app;

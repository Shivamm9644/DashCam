const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config');

// Web console: serves public/, forwards /api/v1 to the Java backend and /media/live to the gateway.
// All data, auth and camera commands live in the Java backend; nothing is answered locally.
const app = express();

app.use(express.json());

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

// Any other /api path no longer exists
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'NOT_FOUND', message: 'Use /api/v1 (Java backend).' });
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

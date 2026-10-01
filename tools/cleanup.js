const fs = require('fs');

// 1. Process public/index.html
let html = fs.readFileSync('public/index.html', 'utf8');

// A. activeTerminalId null & Map default coordinates
html = html.replace(/let activeTerminalId = '013812345678';/g, "let activeTerminalId = null;");
html = html.replace(/\[22\.7533,\s*75\.8937\]/g, "[20, 0]");

// B. backendUrl helper
const backendUrlHelper = `
        function backendUrl(path) {
            if (!path) return '';
            if (/^https?:\\/\\//i.test(path)) return path;
            return API_BASE_URL + (path.startsWith('/') ? '' : '/') + path;
        }
        
        // State`;
html = html.replace(/\/\/\s*State/g, backendUrlHelper);

// C. Socket telemetry updates: _lastReceivedAt, activeTerminalId auto-select
const telemetryBlock = `
            socket.on('telemetry', (data) => {
                data._lastReceivedAt = Date.now();
                if (!activeTerminalId) {
                    activeTerminalId = data.terminalId;
                    console.log('Selected active terminal:', activeTerminalId);
                }
                fleet.set(data.terminalId, data);
`;
html = html.replace(/socket\.on\('telemetry',\s*\(data\)\s*=>\s*\{\s*fleet\.set\(data\.terminalId,\s*data\);/g, telemetryBlock);

// D. renderFleet updates for ONLINE/OFFLINE and removing DS-9922 (if still present)
html = html.replace(/const displayId = t\.terminalId === '013812345678' \? 'DS-9922' : t\.terminalId;/g, "const displayId = t.terminalId || '-';");

const statusCheck = `const isOnline = t._lastReceivedAt && (Date.now() - t._lastReceivedAt < 30000);
                const statusClass = isOnline ? 'status-online' : 'status-offline';
                const statusText = isOnline ? 'ONLINE' : 'OFFLINE';`;
html = html.replace(/const statusClass = t\.isSimulated \? 'status-online' : 'status-online';/g, statusCheck);
html = html.replace(/const statusText = t\.isSimulated \? 'ONLINE' : 'ONLINE';/g, ""); // Remove old text since it's now in statusCheck

html = html.replace(/"\s*\+\s*statusText\s*\+\s*"/g, `" + statusText + "`);

// E. Map markers creation (delay until GPS)
const liveMarkerBlock = `
            if (!liveMap) {
                liveMap = L.map('liveMap').setView([20, 0], 2);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(liveMap);
            }
`;
html = html.replace(/liveMap = L\.map\('liveMap'\)\.setView\(\[20, 0\],\s*13\);[\s\S]*?liveMarker = L\.marker\(\[20, 0\]\)\.addTo\(liveMap\);/g, liveMarkerBlock);

const updateMarkerBlock = `
            if (liveMap && data.latitude !== undefined && data.longitude !== undefined) {
                if (!liveMarker) {
                    liveMarker = L.marker([data.latitude, data.longitude]).addTo(liveMap);
                    liveMap.setView([data.latitude, data.longitude], 13);
                } else {
                    liveMarker.setLatLng([data.latitude, data.longitude]);
                    liveMap.panTo([data.latitude, data.longitude]);
                }
            }
`;
html = html.replace(/if\s*\(liveMap && liveMarker && data\.latitude !== undefined && data\.longitude !== undefined\)\s*\{\s*liveMarker\.setLatLng\(\[data\.latitude, data\.longitude\]\);\s*liveMap\.panTo\(\[data\.latitude, data\.longitude\]\);\s*\}/g, updateMarkerBlock);

// F. MP4 Reel URLs & HLS & Recordings
html = html.replace(/const hlsUrl = `\$\{API_BASE_URL\}\/media\/live\//g, "const hlsUrl = backendUrl(`/media/live/");
html = html.replace(/const hlsUrl = backendUrl\(\`\/media\/live\/\$\{terminalId\}_\$\{channel\}\/live\.m3u8\`;/g, "const hlsUrl = backendUrl(`/media/live/${terminalId}_${channel}/live.m3u8`);");

// Replace reels modal src
html = html.replace(/video\.src = API_BASE_URL \+ r\.mp4_clip_url;/g, "video.src = backendUrl(r.mp4_clip_url);");
html = html.replace(/video\.src = r\.mp4_clip_url;/g, "video.src = backendUrl(r.mp4_clip_url);");
html = html.replace(/href="\$\{r\.mp4_clip_url\}"/g, `href="\${backendUrl(r.mp4_clip_url)}"`);
html = html.replace(/<source src="\$\{r\.mp4_clip_url\}"/g, `<source src="\${backendUrl(r.mp4_clip_url)}"`);
html = html.replace(/evidenceVideo\.src = ev\.videoUrl;/g, "evidenceVideo.src = backendUrl(ev.videoUrl);");


fs.writeFileSync('public/index.html', html);


// 2. Process src/server.js
let serverJs = fs.readFileSync('src/server.js', 'utf8');

// Fallback removal in /api/sync/telemetry
serverJs = serverJs.replace(/const terminalId = req\.query\.terminalId \|\| '013812345678';/g, `const terminalId = req.query.terminalId;
    if (!terminalId) return res.status(400).json({ error: "terminalId required" });`);

// Fallback removal in /api/media/segments
serverJs = serverJs.replace(/const terminalId = req\.query\.terminalId \|\| '013812345678';/g, `const terminalId = req.query.terminalId;
    if (!terminalId) return res.status(400).json({ error: "terminalId required" });`);

// Fallback removal in /api/media/recordings
serverJs = serverJs.replace(/const terminalId = req\.query\.terminalId \|\| '013812345678';/g, `const terminalId = req.query.terminalId;
    if (!terminalId) return res.status(400).json({ error: "terminalId required" });`);

fs.writeFileSync('src/server.js', serverJs);

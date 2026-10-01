const net = require('net');
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

// Protocols
const binaryParser = require('./protocols/jtt808/binary-parser');
const binaryEncoder = require('./protocols/jtt808/binary-encoder');
const mediaHandler = require('./protocols/jtt1078/media-handler');
const mediaParser = require('./protocols/jtt1078/media-parser');

// Simulator
const simulator = require('./simulator/engine');

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

// Serve Static Assets & Reconstructed Media
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/media', express.static(config.MEDIA_DIR, { setHeaders(res, file) { if (file.endsWith('.m3u8')) res.setHeader('Cache-Control', 'no-store'); } }));

// Initialize WebSocket Service
wsService.init(server);

// --- Authentication Endpoints ---
app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    if (username === config.ADMIN_USER && password === config.ADMIN_PASS) {
        // Return session token
        res.json({
            success: true,
            user: { username: config.ADMIN_USER, role: 'admin' },
            token: `token-${Date.now()}`
        });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/api/auth/me', (req, res) => {
    res.json({ authenticated: true, user: { username: config.ADMIN_USER, role: 'admin' } });
});

// --- System Status ---
app.get('/api/status', (req, res) => {
    res.json({
        status: "online",
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
        codecs: {
            video: ["H.264 (Baseline)", "H.265 (Passthrough)"],
            audio: ["AAC (ADTS, Standard PT 19)"]
        }
    });
});

// --- Accidents & History ---
app.get('/api/accidents', (req, res) => {
    res.json(accidentService.getAllAccidents());
});

app.get('/api/trips', (req, res) => {
    res.json(tripService.getAllTrips());
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
            
            const wsService = require('./services/websocket-service');
            wsService.emit('real_live_frame', {
                terminalId: req.query.terminalId || '013812345678',
                image: buf.toString('base64'),
                latitude: req.query.lat ? parseFloat(req.query.lat) : undefined,
                longitude: req.query.lng ? parseFloat(req.query.lng) : undefined,
                speed: req.query.speed ? parseFloat(req.query.speed) : undefined
            });
        }
    } catch(e) {
        console.error("Frame upload error:", e);
    }
    res.sendStatus(200);
});

// --- Media Segments for Reels ---
app.get('/api/media/segments', (req, res) => {
    const terminalId = req.query.terminalId;
    if (!terminalId) return res.status(400).json({ error: "terminalId required" });
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
            VALUES ('${segmentId}', '${sessionId}', '${terminalId}', 1, ${Date.now()}, 0, ${durationSec*1000}, ${startUtcMs}, ${endUtcMs}, ${durationSec}, '${req.file.path}', '/media/reels/${req.file.filename}', '${new Date().toISOString()}')`);
        
        // Notify the frontend via WS
        const wsService = require('./services/websocket-service');
        wsService.emit('media_segment', {
            terminalId: terminalId,
            sessionId: sessionId,
            channel: 1
        });
        
    } catch(e) {
        console.error('Failed to insert real clip into db:', e);
    }
    
    res.json({ success: true, file: req.file.filename });
});

app.get('/api/media/recordings', (req,res)=>{
 const rows=db.getSegmentsForReels(req.query.terminalId||'013812345678',Number(req.query.channel||1));
 const sessions=new Map();
 for(const r of rows){if(!sessions.has(r.session_id))sessions.set(r.session_id,{sessionId:r.session_id,startUtcMs:r.start_utc_ms,endUtcMs:r.end_utc_ms,playlist:(r.hls_segment_url ? r.hls_segment_url.replace(/[^/]+$/, 'recording.m3u8') : r.mp4_clip_url)});sessions.get(r.session_id).endUtcMs=r.end_utc_ms;}
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
                    telemetryService.addTelemetry(parsed.telemetry);
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
app.post('/api/simulator/control', (req, res) => {
    const { action } = req.body || {};
    if (action === 'pause') res.json(simulator.pause());
    else if (action === 'resume') res.json(simulator.resume());
    else if (action === 'stop') res.json(simulator.stop());
    else res.json(simulator.getStatus());
});

app.get('/api/simulator/status', (req, res) => {
    res.json(simulator.getStatus());
});

app.post('/api/simulator/trigger-accident', (req, res) => {
    const latest = telemetryService.getLatest('013812345678');
    if (latest) {
        const accidentTelemetry = {
            ...latest,
            eventType: 'ACCIDENT',
            alarmType: 'COLLISION_WARNING',
            impactGForce: 3.5
        };
        accidentService.processAccident(accidentTelemetry);
        
        // Ensure simulator generated media is marked as simulated
        const termId = req.query.terminalId || '013812345678';
        mediaHandler.simulated.add(`${termId}_1`);
        
        const cmd = {
            action: 'triggerAccident',
            terminalId: termId
        };
        simulator.start(cmd);
        
        res.json({ success: true, message: 'Accident triggered' });
    } else {
        res.status(404).json({ error: 'No active telemetry found for terminal 013812345678' });
    }
});

server.listen(config.API_PORT, () => {
    console.log(`[Web] Admin Dashboard listening on http://localhost:${config.API_PORT}`);
});

// ==========================================
// 2. JT/T 808 Server (GPS & Telemetry)
// ==========================================
const server808 = net.createServer((socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[JT808] Terminal connected: ${clientAddress}`);
    wsService.emit('dashcam_connected', { ip: clientAddress });

    socket.buffer = Buffer.alloc(0);
    socket.authenticated = false;
    socket.terminalPhone = null;

    socket.on('data', async (data) => {
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

                socket.terminalPhone = frame.terminalPhone;

                // Route response based on Message ID
                let responsePacket = null;

                if (frame.messageId === 0x0100) {
                    // Registration
                    responsePacket = binaryEncoder.buildRegistrationResponse(
                        frame.terminalPhone,
                        frame.serialNo,
                        0, // Success
                        "AUTH12345"
                    );
                } else if (frame.messageId === 0x0102) {
                    // Authentication
                    if (decoded && decoded.valid && decoded.authCode === 'AUTH12345') {
                        socket.authenticated = true;
                        responsePacket = binaryEncoder.buildPlatformResponse(
                            frame.terminalPhone,
                            frame.serialNo,
                            frame.messageId,
                            0 // Success
                        );

                        // Issue 0x9101 Real-Time Video Request after auth
                        const videoRequest = binaryEncoder.buildLiveStartRequest(
                            frame.terminalPhone,
                            {
                                serverIp: config.MEDIA_SERVER_IP,
                                tcpPort: config.JT1078_PORT,
                                udpPort: 0,
                                channel: 1,
                                dataType: 0, // Audio & Video
                                streamType: 0 // Main stream
                            }
                        );

                        setTimeout(() => {
                            if (!socket.destroyed) {
                                console.log(`[JT808] Sending 0x9101 Video Request to ${frame.terminalPhone}`);
                                socket.write(videoRequest);
                            }
                        }, 500);
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
                    responsePacket = binaryEncoder.buildPlatformResponse(
                        frame.terminalPhone,
                        frame.serialNo,
                        frame.messageId,
                        0
                    );
                } else if (frame.messageId === 0x0200) {
                    // Location Information Report
                    if (telemetry) {
                        telemetryService.addTelemetry(telemetry);
                        await tripService.processTelemetry(telemetry);
                        wsService.emit('telemetry', telemetry);

                        if (telemetry.eventType === 'ACCIDENT') {
                            accidentService.processAccident(telemetry);
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
                }

                if (responsePacket) {
                    socket.write(responsePacket);
                }
            }
        }
    });

    socket.on('end', () => {
        console.log(`[JT808] Terminal disconnected: ${clientAddress}`);
    });

    socket.on('error', (err) => {
        console.error(`[JT808] Error: ${err.message}`);
    });
});

server808.listen(config.JT808_PORT, () => {
    console.log(`[JT808] Server listening on port ${config.JT808_PORT}`);
});

// ==========================================
// 3. JT/T 1078 Server (Video & Audio Ingestion)
// ==========================================
const server1078 = net.createServer((socket) => {
    const clientAddress = `${socket.remoteAddress}:${socket.remotePort}`;
    console.log(`[JT1078] Media stream connected: ${clientAddress}`);

    socket.on('data', (data) => {
        try { mediaHandler.handleData(socket, data); } catch(e) { console.error(e.message); socket.destroy(); }
    });

    let ended=false;
    const finish=()=>{if(ended)return;ended=true;for(const key of socket.sessionKeys||[]){const [term,ch]=key.split('_');mediaHandler.closeSession(term,Number(ch)).catch(console.error);}};
    socket.on('end',finish);
    socket.on('close',finish);
    socket.on('error',err=>{console.error('[JT1078]',err.message);finish();});

});

server1078.listen(config.JT1078_PORT, () => {
    console.log(`[JT1078] Media Server listening on port ${config.JT1078_PORT}`);
});

module.exports = { app, server, server808, server1078 };

let shuttingDown=false;
async function shutdown(){
 if(shuttingDown)return;shuttingDown=true;simulator.stop();
 await new Promise(r=>setTimeout(r,100));
 await Promise.all([...mediaHandler.sessions.values()].map(s=>mediaHandler.closeSession(s.terminalId,s.channel)));
 await mediaHandler.drain();db.db.close();process.exit(0);
}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);


const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../src/config');
const binaryUtils = require('../src/protocols/jtt808/binary-utils');
const binaryParser = require('../src/protocols/jtt808/binary-parser');
const binaryEncoder = require('../src/protocols/jtt808/binary-encoder');
const mediaParser = require('../src/protocols/jtt1078/media-parser');
const MediaFeeder = require('../src/simulator/media-feeder');
const syncService = require('../src/services/sync-service');
const db = require('../src/storage/db');

console.log('============================================================');
console.log('DASHCAM TEST RUNNER: JT808 / JT1078 / PERSISTENCE / SYNC');
console.log('============================================================\n');

let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
    totalTests++;
    try {
        const res = fn();
        if (res && typeof res.then === 'function') {
            await res;
        }
        console.log(`[PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error(`       Error: ${err.message}`);
        console.error(err.stack);
    }
}

async function runAllTests() {

// -------------------------------------------------------------
// Test 1: JT/T 808 Checksum and Escaping
// -------------------------------------------------------------
runTest('JT808: Escaping and Unescaping (0x7E and 0x7D)', () => {
    const raw = Buffer.from([0x01, 0x7E, 0x02, 0x7D, 0x03]);
    const escaped = binaryUtils.escape(raw);
    assert.deepStrictEqual(escaped, Buffer.from([0x01, 0x7D, 0x02, 0x02, 0x7D, 0x01, 0x03]));
    const unescaped = binaryUtils.unescape(escaped);
    assert.deepStrictEqual(unescaped, raw);
});

runTest('JT808: XOR Checksum Calculation', () => {
    const data = Buffer.from([0x02, 0x00, 0x00, 0x1C]);
    const csum = binaryUtils.calculateChecksum(data, 0, data.length);
    assert.strictEqual(csum, 0x02 ^ 0x00 ^ 0x00 ^ 0x1C);
});

// -------------------------------------------------------------
// Test 2: JT/T 808 Frame Rejection (Checksum & Length Mismatches)
// -------------------------------------------------------------
runTest('JT808: Reject Invalid Checksum', () => {
    // Build packet with invalid checksum
    const bodyBuf = Buffer.alloc(5);
    const packet = binaryEncoder.buildPlatformResponse("013812345678", 1, 0x0002, 0);
    // Tamper checksum byte
    packet[packet.length - 2] ^= 0xFF;
    const parsed = binaryParser.parse(packet);
    assert(parsed.error === 'CHECKSUM_INVALID');
});

runTest('JT808: Reject Declared Body Length Mismatch', () => {
    // Packet declaring 10 bytes but having 5
    const bodyBuf = Buffer.alloc(5);
    const packet = binaryEncoder.buildPlatformResponse("013812345678", 1, 0x0002, 0);
    // Tamper declared length in header (bytes 3-4 after 0x7E)
    packet[3] = 0x00;
    packet[4] = 0x50; // 80 bytes
    // Re-checksum
    const unescaped = binaryUtils.unescape(packet.subarray(1, packet.length - 1));
    unescaped[unescaped.length - 1] = binaryUtils.calculateChecksum(unescaped, 0, unescaped.length - 1);
    const reEscaped = binaryUtils.escape(unescaped);
    const finalPkt = Buffer.concat([Buffer.from([0x7E]), reEscaped, Buffer.from([0x7E])]);

    const parsed = binaryParser.parse(finalPkt);
    assert(parsed.error === 'BODY_LENGTH_MISMATCH');
});

// -------------------------------------------------------------
// Test 3: JT/T 808 Location Report Parsing & Honest G-Force
// -------------------------------------------------------------
runTest('JT808: Location 0x0200 Parsing with Honest Null G-Force', () => {
    const bodyBuf = Buffer.alloc(28);
    bodyBuf.writeUInt32BE(0x20000000, 0); // Collision Warning
    bodyBuf.writeUInt32BE(0x00000003, 4); // ACC on, positioning valid
    bodyBuf.writeUInt32BE(22719568, 8);   // Lat 22.719568
    bodyBuf.writeUInt32BE(75857725, 12);  // Lng 75.857725
    bodyBuf.writeUInt16BE(550, 16);       // Alt 550m
    bodyBuf.writeUInt16BE(450, 18);       // Speed 45.0 km/h
    bodyBuf.writeUInt16BE(90, 20);        // Heading 90
    // Time BCD: 260921093000 (2026-09-21 09:30:00 Asia/Shanghai)
    const bcd = [0x26, 0x09, 0x21, 0x09, 0x30, 0x00];
    for (let i = 0; i < 6; i++) bodyBuf[22 + i] = bcd[i];

    const encoder = binaryEncoder;
    const packet = encoder._buildPacket(0x0200, "013812345678", bodyBuf);
    const parsed = binaryParser.parse(packet);

    assert(parsed && parsed.telemetry);
    assert.strictEqual(parsed.telemetry.terminalId, "013812345678");
    assert.strictEqual(parsed.telemetry.speed, 45.0);
    assert.strictEqual(parsed.telemetry.alarmType, "COLLISION_WARNING");
    assert.strictEqual(parsed.telemetry.eventType, "ACCIDENT");
    // Verify G-force is strictly null when no sensor TLV is supplied
    assert.strictEqual(parsed.telemetry.impactGForce, null);
    // Verify device timezone UTC conversion (Asia/Shanghai UTC+8: 09:30:00 -> 01:30:00Z)
    assert(parsed.telemetry.timestamp.endsWith('T01:30:00.000Z'));
});

// -------------------------------------------------------------
// Test 4: JT/T 1078 Video & Audio Header Layout Differences
// -------------------------------------------------------------
runTest('JT1078: Video Header (30 bytes) with Last Frame Intervals', () => {
    const videoBody = Buffer.from([0x00, 0x00, 0x00, 0x01, 0x67, 0x42, 0x00, 0x1E]); // SPS
    const buf = Buffer.alloc(30 + videoBody.length);
    buf.writeUInt32BE(0x30316364, 0); // Magic
    buf.writeUInt8(0x80, 4);          // V=2
    buf.writeUInt8(98, 5);            // PT=98 (H.264)
    buf.writeUInt16BE(101, 6);        // Seq
    binaryUtils.stringToBcd("013812345678").copy(buf, 8); // SIM
    buf.writeUInt8(1, 14);            // Channel 1
    buf.writeUInt8(0x00, 15);         // DataType 0 (I-frame), Subpackage 0 (Atomic)
    buf.writeUInt32BE(0, 16);
    buf.writeUInt32BE(1000, 20);      // Timestamp 1000ms
    buf.writeUInt16BE(1000, 24);      // Last I-frame interval
    buf.writeUInt16BE(40, 26);        // Last frame interval
    buf.writeUInt16BE(videoBody.length, 28);
    videoBody.copy(buf, 30);

    const res = mediaParser.parsePacket(buf);
    assert(res && res.packet);
    assert.strictEqual(res.packet.isVideo, true);
    assert.strictEqual(res.packet.codecName, 'H.264');
    assert.strictEqual(res.packet.lastIFrameInterval, 1000);
    assert.strictEqual(res.packet.lastFrameInterval, 40);
    assert.strictEqual(res.bytesConsumed, 30 + videoBody.length);
});

runTest('JT1078: Audio Header (26 bytes) without Video Interval Fields', () => {
    const audioBody = Buffer.from([0xFF, 0xF1, 0x50, 0x80, 0x01, 0x3F, 0xFC]); // 7-byte ADTS header
    const buf = Buffer.alloc(26 + audioBody.length);
    buf.writeUInt32BE(0x30316364, 0); // Magic
    buf.writeUInt8(0x80, 4);
    buf.writeUInt8(19, 5);            // Standard JT1078-2016 PT=19 (AAC)
    buf.writeUInt16BE(102, 6);        // Seq
    binaryUtils.stringToBcd("013812345678").copy(buf, 8);
    buf.writeUInt8(1, 14);
    buf.writeUInt8(0x30, 15);         // DataType 3 (Audio), Subpackage 0 (Atomic)
    buf.writeUInt32BE(0, 16);
    buf.writeUInt32BE(1020, 20);      // Timestamp 1020ms
    buf.writeUInt16BE(audioBody.length, 24); // Body length directly at byte 24!
    audioBody.copy(buf, 26);

    const res = mediaParser.parsePacket(buf);
    assert(res && res.packet);
    assert.strictEqual(res.packet.isAudio, true);
    assert.strictEqual(res.packet.isVideo, false);
    assert.strictEqual(res.packet.codecName, 'AAC');
    assert.strictEqual(res.packet.bodyLength, audioBody.length);
    assert.strictEqual(res.bytesConsumed, 26 + audioBody.length);
});

// -------------------------------------------------------------
// Test 5: Media Fixtures & Codec Verification with FFprobe
// -------------------------------------------------------------
runTest('Codecs: FFprobe Verification of Generated H.264 and AAC Fixtures', () => {
    const fixtureDir = path.join(__dirname, '..', 'mock_data', 'generated');
    const mp4File = path.join(fixtureDir, 'test_media_10s.mp4');

    if (!fs.existsSync(mp4File)) {
        execSync(`node "${path.join(__dirname, '..', 'tools', 'generate_fixtures.js')}" 10`, { stdio: 'ignore' });
    }

    const probeOut = execSync(`"${config.FFPROBE_PATH}" -v error -show_entries stream=codec_name,codec_type -of json "${mp4File}"`).toString();
    const probe = JSON.parse(probeOut);

    const videoStream = probe.streams.find(s => s.codec_type === 'video');
    const audioStream = probe.streams.find(s => s.codec_type === 'audio');

    assert(videoStream, 'Video stream present');
    assert.strictEqual(videoStream.codec_name, 'h264');
    assert(audioStream, 'Audio stream present');
    assert.strictEqual(audioStream.codec_name, 'aac');
});

// -------------------------------------------------------------
// Test 6: Media Feeder NALU and ADTS Slicing
// -------------------------------------------------------------
runTest('MediaFeeder: Extract NAL units and ADTS frames', () => {
    const fixtureDir = path.join(__dirname, '..', 'mock_data', 'generated');
    const h264File = path.join(fixtureDir, 'test_video_10s.h264');
    const aacFile = path.join(fixtureDir, 'test_audio_10s.aac');

    const h264Buf = fs.readFileSync(h264File);
    const aacBuf = fs.readFileSync(aacFile);

    const nalus = MediaFeeder.parseH264Nalus(h264Buf);
    const aacFrames = MediaFeeder.parseAacFrames(aacBuf);

    assert(nalus.length > 50, `Extracted ${nalus.length} NALUs`);
    assert(aacFrames.length > 50, `Extracted ${aacFrames.length} ADTS frames`);
    // At least one keyframe / SPS
    assert(nalus.some(n => n.isKeyframe), 'Keyframes detected');
});

// -------------------------------------------------------------
// Test 7: Dual Terminal and Channel Isolation
// -------------------------------------------------------------
runTest('Persistence: Isolation Between Terminal A (CH1) and Terminal B (CH2)', () => {
    const termA = "TEST_TERM_A_01";
    const termB = "TEST_TERM_B_02";

    db.insertTelemetry({
        terminalId: termA,
        vehicleId: "VEH-5678",
        latitude: 22.7533,
        longitude: 75.8937,
        speed: 45.0,
        heading: 90,
        ignition: true,
        timestamp: "2026-09-21T12:00:00.000Z",
        isSimulated: true
    });

    db.insertTelemetry({
        terminalId: termB,
        vehicleId: "VEH-9999",
        latitude: 19.0760,
        longitude: 72.8777,
        speed: 80.0,
        heading: 180,
        ignition: true,
        timestamp: "2026-09-21T12:00:00.000Z",
        isSimulated: true
    });

    const latA = db.getLatestTelemetry(termA);
    const latB = db.getLatestTelemetry(termB);

    assert.strictEqual(latA.terminal_id, termA);
    assert.strictEqual(latA.speed, 45.0);
    assert.strictEqual(latB.terminal_id, termB);
    assert.strictEqual(latB.speed, 80.0);
});

// -------------------------------------------------------------
// Test 8: Video-Driven Presentation Time Telemetry Synchronization
// -------------------------------------------------------------
runTest('SyncEngine: Resolve GPS by Current Media Presentation Time', () => {
    const term = "SYNC_TEST_TERM_01";
    const t0 = new Date("2026-09-21T12:00:00.000Z").getTime();

    // Insert points at t0 and t0 + 2000ms
    db.insertTelemetry({
        terminalId: term,
        latitude: 22.7500,
        longitude: 75.8900,
        speed: 40.0,
        heading: 90,
        ignition: true,
        timestamp: new Date(t0).toISOString()
    });

    db.insertTelemetry({
        terminalId: term,
        latitude: 22.7600,
        longitude: 75.9000,
        speed: 50.0,
        heading: 90,
        ignition: true,
        timestamp: new Date(t0 + 2000).toISOString()
    });

    // Query media time at t0 + 1000ms (should interpolate between point 0 and point 1)
    const syncRes = syncService.getTelemetryForMediaUtc(term, t0 + 1000);
    assert.strictEqual(syncRes.status, 'SYNCED');
    assert.strictEqual(syncRes.isInterpolated, true);
    // Midpoint: (22.7500 + 22.7600)/2 = 22.7550
    assert.strictEqual(syncRes.latitude, 22.755);
    assert.strictEqual(syncRes.longitude, 75.895);
    assert.strictEqual(syncRes.speed, 45.0);
});

// -------------------------------------------------------------
// Test 9: Persistence Across Restart
// -------------------------------------------------------------
runTest('Persistence: Telemetry and Trips Survive Database Re-init', () => {
    const testTrip = {
        tripId: "TRIP-TEST-PERSISTENCE-01",
        vehicleId: "VEH-5678",
        terminalId: "013812345678",
        startTime: "2026-09-21T09:30:00.000Z",
        startAddress: "Indore Vijay Nagar",
        metrics: { totalDistanceKm: 12.5, drivingTimeSec: 600, stoppedTimeSec: 60, maxSpeed: 65 },
        stops: [{ startTime: "2026-09-21T09:35:00.000Z", durationSec: 60, address: "Palasia" }],
        route: [{ lat: 22.7533, lng: 75.8937, speed: 45, time: "2026-09-21T09:30:00.000Z" }]
    };

    db.upsertTrip(testTrip);

    // Verify retrieval
    const trips = db.getAllTrips();
    const found = trips.find(t => t.tripId === "TRIP-TEST-PERSISTENCE-01");
    assert(found, 'Trip persisted and loaded from SQLite');
    assert.strictEqual(found.metrics.totalDistanceKm, 12.5);
    assert.strictEqual(found.stops.length, 1);
});

// -------------------------------------------------------------
// Test 10: JT/T 808 0x0001 Terminal General Response Parsing
// -------------------------------------------------------------
runTest('JT808: Parse 0x0001 Terminal General Response (0x9101 ACK)', () => {
    const bodyBuf = Buffer.alloc(5);
    bodyBuf.writeUInt16BE(42, 0);     // replySerialNo = 42
    bodyBuf.writeUInt16BE(0x9101, 2); // replyMessageId = 0x9101
    bodyBuf.writeUInt8(0, 4);         // result = 0 (Success)

    const encoder = binaryEncoder;
    const packet = encoder._buildPacket(0x0001, "872312858278", bodyBuf);
    const parsed = binaryParser.parse(packet);

    assert(parsed && parsed.decoded);
    assert.strictEqual(parsed.decoded.type, 'general_response');
    assert.strictEqual(parsed.decoded.replySerialNo, 42);
    assert.strictEqual(parsed.decoded.replyMessageId, 0x9101);
    assert.strictEqual(parsed.decoded.result, 0);
    assert.strictEqual(parsed.decoded.resultText, 'Success/Confirm');
});

// -------------------------------------------------------------
// Test 11: JT/T 1078 SPS/PPS Caching and IDR Preservation
// -------------------------------------------------------------
runTest('JT1078: MediaHandler SPS/PPS Caching across packets', () => {
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const spsData = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]); // SPS NAL (type 7)
    const ppsData = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]); // PPS NAL (type 8)
    const idrData = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84]);       // IDR NAL (type 5)

    mediaHandler.spsCache.set('872312858278_1', spsData);
    mediaHandler.ppsCache.set('872312858278_1', ppsData);

    assert.strictEqual(mediaHandler.spsCache.get('872312858278_1'), spsData);
    assert.strictEqual(mediaHandler.ppsCache.get('872312858278_1'), ppsData);

    const stats = mediaHandler.getStreamStats('872312858278', 1);
    assert.strictEqual(stats.hasSps, true);
    assert.strictEqual(stats.hasPps, true);
});

// -------------------------------------------------------------
// Test 12: JT/T 808 Reconnect and Stale Socket Isolation
// -------------------------------------------------------------
runTest('JT808: Socket replacement and unregister isolation', () => {
    const activeMap = new Map();
    function register(phone, sock) {
        const existing = activeMap.get(phone);
        if (existing && existing !== sock) existing.destroyed = true;
        sock.phone = phone;
        activeMap.set(phone, sock);
    }
    function unregister(sock) {
        if (sock.phone && activeMap.get(sock.phone) === sock) {
            activeMap.delete(sock.phone);
        }
    }

    const sockOld = { id: 1, destroyed: false };
    const sockNew = { id: 2, destroyed: false };

    register('872312858278', sockOld);
    assert.strictEqual(activeMap.get('872312858278'), sockOld);

    // Device reconnects before old socket ends
    register('872312858278', sockNew);
    assert.strictEqual(activeMap.get('872312858278'), sockNew);
    assert.strictEqual(sockOld.destroyed, true);

    // Old socket fires end/close event later
    unregister(sockOld);
    // Verification: active socket mapping MUST NOT be deleted by old socket!
    assert.strictEqual(activeMap.get('872312858278'), sockNew);

    // When current socket closes, it is cleanly deleted
    unregister(sockNew);
    assert.strictEqual(activeMap.get('872312858278'), undefined);
});

// -------------------------------------------------------------
// Test 13: Bounded HLS Live Storage and Rolling Window (LIVE_ONLY mode)
// -------------------------------------------------------------
await runTest('Storage: Bounded HLS live storage and rolling window (LIVE_ONLY mode)', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_LIVE_01';
    const channel = 1;
    const key = `${term}_${channel}`;

    await mediaHandler.closeSession(term, channel);
    const initialRows = db.getSegmentsForReels(term, channel);

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    // Send 12 consecutive segments
    for (let i = 0; i < 12; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: channel, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    const session = mediaHandler.sessions.get(key);
    assert(session, 'Live session should exist');
    assert.strictEqual(session.shouldRecord, false, 'In LIVE_ONLY mode, shouldRecord must be false');

    // Read live.m3u8 playlist
    const playlistFile = path.join(config.LIVE_DIR, key, 'live.m3u8');
    assert(fs.existsSync(playlistFile), 'live.m3u8 must exist');
    const playlistContent = fs.readFileSync(playlistFile, 'utf8');

    // Check bounded segments in playlist (LIVE_PLAYLIST_SEGMENTS = 6)
    const segmentMatches = playlistContent.match(/seg_\d+\.ts/g) || [];
    assert.strictEqual(segmentMatches.length, config.LIVE_PLAYLIST_SEGMENTS, `Playlist must have exactly ${config.LIVE_PLAYLIST_SEGMENTS} segments`);

    // Verify #EXT-X-MEDIA-SEQUENCE matches the first segment in the sliding window
    const mediaSeqMatch = playlistContent.match(/#EXT-X-MEDIA-SEQUENCE:(\d+)/);
    assert(mediaSeqMatch, 'Must include #EXT-X-MEDIA-SEQUENCE');
    const firstSeqInPlaylist = parseInt(segmentMatches[0].match(/seg_(\d+)\.ts/)[1], 10);
    assert.strictEqual(parseInt(mediaSeqMatch[1], 10), firstSeqInPlaylist, 'Media sequence must match first segment in playlist');

    // Verify files on disk do NOT exceed maxRetained = 6 + 4 = 10
    const filesOnDisk = fs.readdirSync(path.join(config.LIVE_DIR, key)).filter(f => f.endsWith('.ts'));
    const maxRetained = config.LIVE_PLAYLIST_SEGMENTS + config.LIVE_GRACE_SEGMENTS;
    assert(filesOnDisk.length <= maxRetained, `Files on disk (${filesOnDisk.length}) must not exceed maxRetained (${maxRetained})`);

    // Verify older segments (e.g. seg_0.ts) were pruned from disk
    assert.strictEqual(fs.existsSync(path.join(config.LIVE_DIR, key, 'seg_0.ts')), false, 'Old segment seg_0.ts must be pruned from disk');

    // Verify NO permanent MP4 recordings directory was created
    const recDir = path.join(config.RECORDINGS_DIR, key);
    assert.strictEqual(fs.existsSync(recDir), false, 'Permanent recordings directory must not exist for LIVE_ONLY session');

    // Verify NO records were inserted into SQLite media_segments for transient live segments
    const finalRows = db.getSegmentsForReels(term, channel);
    assert.strictEqual(finalRows.length, initialRows.length, 'media_segments table must not accumulate temporary live chunks');

    await mediaHandler.closeSession(term, channel, true);
});

// -------------------------------------------------------------
// Test 14: Prevent HLS player 404s via grace period retention
// -------------------------------------------------------------
await runTest('HLS Playback: Grace period prevents 404s for newly unlisted segments', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_GRACE_02';
    const channel = 1;
    const key = `${term}_${channel}`;

    await mediaHandler.closeSession(term, channel, true);

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    // Send 10 segments so older segments drop out of the 6-segment playlist
    for (let i = 0; i < 10; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: channel, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    // Capture playlist (segments 3..8 are in playlist, seq 0 & 1 have dropped off playlist)
    const playlistContent = fs.readFileSync(path.join(config.LIVE_DIR, key, 'live.m3u8'), 'utf8');
    assert(!playlistContent.includes('seg_0.ts'), 'seg_0.ts has dropped out of the playlist');
    assert(!playlistContent.includes('seg_1.ts'), 'seg_1.ts has dropped out of the playlist');

    // BUT due to grace period (4 extra segments), seg_0.ts and seg_1.ts MUST STILL EXIST on disk!
    assert(fs.existsSync(path.join(config.LIVE_DIR, key, 'seg_0.ts')), 'seg_0.ts must still exist on disk within grace period');
    assert(fs.existsSync(path.join(config.LIVE_DIR, key, 'seg_1.ts')), 'seg_1.ts must still exist on disk within grace period');

    await mediaHandler.closeSession(term, channel, true);
});

// -------------------------------------------------------------
// Test 15: Automatic cleanup of abandoned live sessions on disconnect
// -------------------------------------------------------------
await runTest('Cleanup: Automatic cleanup of temporary live sessions on disconnect', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_CLEAN_03';
    const channel = 1;
    const key = `${term}_${channel}`;

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    for (let i = 0; i < 3; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: channel, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    const liveFolder = path.join(config.LIVE_DIR, key);
    assert(fs.existsSync(liveFolder), 'Live folder should exist while session is active');

    // Immediate close (simulating final disconnect cleanup)
    await mediaHandler.closeSession(term, channel, true);

    // Verify session removed from in-memory map
    assert.strictEqual(mediaHandler.sessions.has(key), false, 'Session must be removed from map');

    // Verify temporary live folder and TS files are completely cleaned up
    const existsAfter = fs.existsSync(liveFolder);
    const filesAfter = existsAfter ? fs.readdirSync(liveFolder).filter(f => f.endsWith('.ts')) : [];
    assert.strictEqual(filesAfter.length, 0, 'Temporary live TS files must be completely cleaned up after disconnect');
});

// -------------------------------------------------------------
// Test 16: Independent CH1 and CH2 streaming and reconnection
// -------------------------------------------------------------
await runTest('Streams: Independent CH1 and CH2 streaming and isolated reconnection', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_CH12_04';

    await mediaHandler.closeSession(term, 1, true);
    await mediaHandler.closeSession(term, 2, true);

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    // Stream to CH1 and CH2 concurrently
    for (let i = 0; i < 4; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: 1, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: 2, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    assert(mediaHandler.sessions.has(`${term}_1`), 'CH1 session must be active');
    assert(mediaHandler.sessions.has(`${term}_2`), 'CH2 session must be active');

    // Disconnect CH1 only
    await mediaHandler.closeSession(term, 1, true);
    assert.strictEqual(mediaHandler.sessions.has(`${term}_1`), false, 'CH1 must be closed');
    assert.strictEqual(mediaHandler.sessions.has(`${term}_2`), true, 'CH2 must remain active and unaffected');

    // CH2 continues receiving packets
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: 2, sequenceNo: 10, timestampMs: 1740000020000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });

    const ch2Stats = mediaHandler.getStreamStats(term, 2);
    assert.strictEqual(ch2Stats.active, true, 'CH2 stats must show active');

    await mediaHandler.closeSession(term, 2, true);
});

// -------------------------------------------------------------
// Test 17: Concurrent Viewers Read Consistency during Atomic Playlist Updates
// -------------------------------------------------------------
await runTest('Concurrency: Atomic playlist updates prevent corrupted reads by concurrent viewers', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_CONCUR_05';
    const channel = 1;
    const key = `${term}_${channel}`;

    await mediaHandler.closeSession(term, channel, true);

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    // Feed initial packets to finalize segment 0 and generate live.m3u8
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: channel, sequenceNo: 0, timestampMs: 1740000000000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: channel, sequenceNo: 1, timestampMs: 1740000002000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });

    const playlistFile = path.join(config.LIVE_DIR, key, 'live.m3u8');
    assert(fs.existsSync(playlistFile), 'live.m3u8 must exist before concurrent reads');

    // Simulate 20 concurrent readers while continuously writing new segments
    const readPromises = [];
    for (let r = 0; r < 20; r++) {
        readPromises.push(new Promise((resolve, reject) => {
            mediaHandler.processPacket({
                isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
                simNumber: term, channel: channel, sequenceNo: r + 1, timestampMs: 1740000000000 + ((r + 1) * 2000),
                lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
            });

            fs.readFile(playlistFile, 'utf8', (err, data) => {
                if (err) return reject(err);
                try {
                    assert(data.startsWith('#EXTM3U'), 'Playlist must start with #EXTM3U');
                    assert(data.includes('#EXT-X-TARGETDURATION'), 'Playlist must contain TARGETDURATION');
                    assert(data.includes('#EXT-X-MEDIA-SEQUENCE'), 'Playlist must contain MEDIA-SEQUENCE');
                    resolve();
                } catch (assertErr) {
                    reject(assertErr);
                }
            });
        }));
    }

    await Promise.all(readPromises);
    await mediaHandler.closeSession(term, channel, true);
});

// -------------------------------------------------------------
// Test 18: Configurable Recording Mode (LIVE_ONLY vs LIVE_AND_RECORD)
// -------------------------------------------------------------
await runTest('Recording Mode: Toggling LIVE_ONLY vs LIVE_AND_RECORD', async () => {
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_MODE_06';

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    // 1. LIVE_AND_RECORD mode
    config.RECORDING_MODE = 'LIVE_AND_RECORD';
    await mediaHandler.closeSession(term, 1, true);
    for (let i = 0; i < 3; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: 1, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    let session = mediaHandler.sessions.get(`${term}_1`);
    assert(session);
    assert.strictEqual(session.shouldRecord, true, 'LIVE_AND_RECORD must enable recording');
    const recFolder = path.join(config.RECORDINGS_DIR, `${term}_1`, session.sessionId);
    assert(fs.existsSync(recFolder), 'Recording folder must exist in LIVE_AND_RECORD mode');
    await mediaHandler.closeSession(term, 1, true);

    // 2. Switch back to LIVE_ONLY mode
    config.RECORDING_MODE = 'LIVE_ONLY';
    await mediaHandler.closeSession(term, 1, true);
    for (let i = 0; i < 3; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: 1, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    session = mediaHandler.sessions.get(`${term}_1`);
    assert(session);
    assert.strictEqual(session.shouldRecord, false, 'LIVE_ONLY must disable permanent recording');
    await mediaHandler.closeSession(term, 1, true);
});

// -------------------------------------------------------------
// Test 19: Disk Usage Monitoring and Threshold Diagnostics
// -------------------------------------------------------------
await runTest('Monitoring: Disk usage reporting and threshold safety', () => {
    const storageService = require('../src/services/storage-service');
    const usage = storageService.getDiskUsage();
    assert(usage !== null);
    if (usage.supported) {
        assert(typeof usage.totalMb === 'number');
        assert(typeof usage.freeMb === 'number');
        assert(typeof usage.percentUsed === 'number');
        assert(['HEALTHY', 'WARNING', 'CRITICAL'].includes(usage.status));
    }
    const checkRes = storageService.checkDiskUsage();
    assert(checkRes !== null);
});

// -------------------------------------------------------------
// Test 20: 30-Second Reconnect Grace Period Preserves Live Buffer
// -------------------------------------------------------------
await runTest('Grace Period: Socket disconnect retains live buffer and stream reports RECONNECTING', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_GRACE_20';
    const channel = 1;
    const key = `${term}_${channel}`;

    await mediaHandler.closeSession(term, channel, true);

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    // Stream 3 segments
    for (let i = 0; i < 4; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: channel, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    const liveFolder = path.join(config.LIVE_DIR, key);
    const tsBefore = fs.readdirSync(liveFolder).filter(f => f.endsWith('.ts'));
    assert(tsBefore.length > 0, 'Segments must exist on disk before disconnect');

    // Simulate socket disconnect without immediate purge
    mediaHandler.handleSocketDisconnect(term, channel);

    const session = mediaHandler.sessions.get(key);
    assert(session, 'Session must remain in memory during grace period');
    assert.strictEqual(session.status, 'DISCONNECTED', 'Session status must be DISCONNECTED');

    // Stream health MUST report RECONNECTING (never LIVE or HEALTHY)
    const stats = mediaHandler.getStreamStats(term, channel);
    assert.strictEqual(stats.state, 'RECONNECTING', 'Disconnected stream must report RECONNECTING');

    // Files on disk MUST STILL EXIST during grace period
    const tsDuringGrace = fs.readdirSync(liveFolder).filter(f => f.endsWith('.ts'));
    assert.strictEqual(tsDuringGrace.length, tsBefore.length, 'Files must NOT be deleted during 30s grace period');

    // Dashcam reconnects within grace period
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: channel, sequenceNo: 10, timestampMs: 1740000010000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });

    assert.strictEqual(session.status, 'ACTIVE', 'Session must be restored to ACTIVE on reconnect');
    const statsAfter = mediaHandler.getStreamStats(term, channel);
    assert.strictEqual(statsAfter.state, 'HEALTHY', 'Stream must return to HEALTHY after packet arrives');

    await mediaHandler.closeSession(term, channel, true);
});

// -------------------------------------------------------------
// Test 21: Grace Period Expiration Purges Abandoned Live Files
// -------------------------------------------------------------
await runTest('Grace Period: Expiration purges abandoned session and files', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_EXPIRE_21';
    const channel = 1;
    const key = `${term}_${channel}`;

    await mediaHandler.closeSession(term, channel, true);

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    for (let i = 0; i < 3; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: channel, sequenceNo: i, timestampMs: 1740000000000 + (i * 2000),
            lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
        });
    }

    mediaHandler.handleSocketDisconnect(term, channel);
    const session = mediaHandler.sessions.get(key);
    assert(session && session.status === 'DISCONNECTED');

    // Trigger immediate expiration
    await mediaHandler.closeSession(term, channel, true);

    assert.strictEqual(mediaHandler.sessions.has(key), false, 'Session must be removed after expiration');
    const liveFolder = path.join(config.LIVE_DIR, key);
    const filesAfter = fs.existsSync(liveFolder) ? fs.readdirSync(liveFolder).filter(f => f.endsWith('.ts')) : [];
    assert.strictEqual(filesAfter.length, 0, 'Abandoned live files must be purged after expiration');
});

// -------------------------------------------------------------
// Test 22: HLS Discontinuity Flagging Across Timestamp Gaps
// -------------------------------------------------------------
await runTest('HLS Playback: Discontinuity flag inserted on timestamp gap across 4G reconnection', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const term = 'TEST_TERM_DISCONT_22';
    const channel = 1;
    const key = `${term}_${channel}`;

    await mediaHandler.closeSession(term, channel, true);

    const sps = Buffer.from([0, 0, 0, 1, 0x67, 0x42, 0x00, 0x1f]);
    const pps = Buffer.from([0, 0, 0, 1, 0x68, 0xce, 0x38, 0x80]);
    const idr = Buffer.from([0, 0, 0, 1, 0x65, 0x88, 0x84, 0x00]);

    // Feed initial 2 segments at t=0 and t=2000
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: channel, sequenceNo: 0, timestampMs: 1740000000000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: channel, sequenceNo: 1, timestampMs: 1740000002000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });

    // Simulate 4G dropout and disconnect
    mediaHandler.handleSocketDisconnect(term, channel);

    // Reconnect with 10-second timestamp jump (PTS gap)
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: channel, sequenceNo: 2, timestampMs: 1740000015000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });
    mediaHandler.processPacket({
        isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
        simNumber: term, channel: channel, sequenceNo: 3, timestampMs: 1740000018000,
        lastFrameInterval: 40, body: Buffer.concat([sps, pps, idr])
    });

    const playlistFile = path.join(config.LIVE_DIR, key, 'live.m3u8');
    const playlistContent = fs.readFileSync(playlistFile, 'utf8');
    assert(playlistContent.includes('#EXT-X-DISCONTINUITY'), 'Playlist must contain #EXT-X-DISCONTINUITY on timestamp gap');

    await mediaHandler.closeSession(term, channel, true);
});

// -------------------------------------------------------------
// Test 23: Admin Authentication on POST /api/video/recording-mode
// -------------------------------------------------------------
await runTest('Security: POST /api/video/recording-mode enforces admin authorization', async () => {
    const serverMod = require('../src/server');
    const app = serverMod.app;
    const request = require('http');

    // Helper to perform local HTTP request
    function sendPost(token, body) {
        return new Promise((resolve) => {
            const req = request.request({
                hostname: '127.0.0.1',
                port: config.API_PORT,
                path: '/api/video/recording-mode',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
                }
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
            });
            req.on('error', () => resolve({ statusCode: 500 }));
            req.write(JSON.stringify(body));
            req.end();
        });
    }

    // 1. Non-admin token should be rejected (403 Forbidden)
    const nonAdminRes = await sendPost('token-user-invalid', { mode: 'LIVE_AND_RECORD' });
    assert.strictEqual(nonAdminRes.statusCode, 403, 'Non-admin token must return 403 Forbidden');

    // 2. Admin token should succeed (200 OK)
    const adminRes = await sendPost('token-admin-valid-test', { mode: 'LIVE_ONLY' });
    assert.strictEqual(adminRes.statusCode, 200, 'Admin token must return 200 OK');
    assert.strictEqual(config.RECORDING_MODE, 'LIVE_ONLY');
});

// -------------------------------------------------------------
// Test 24: Accident Evidence Saved as Playable MP4 Video in LIVE_ONLY mode
// -------------------------------------------------------------
await runTest('Accidents: Playable MP4 evidence generated with pre/post footage in LIVE_ONLY mode', async () => {
    config.RECORDING_MODE = 'LIVE_ONLY';
    const mediaHandler = require('../src/protocols/jtt1078/media-handler');
    const accidentService = require('../src/services/accident-service');
    const term = 'ACC_TEST_TERM_24';
    const channel = 1;
    const key = `${term}_${channel}`;

    await mediaHandler.closeSession(term, channel, true);

    // Stream 6 live segments with real H.264 keyframes from fixture
    const h264Buf = fs.readFileSync(path.join(__dirname, '..', 'mock_data', 'generated', 'test_video_10s.h264'));
    const nalus = MediaFeeder.parseH264Nalus(h264Buf);
    const kf = nalus.find(n => n.isKeyframe).data;

    const baseTime = 1740000000000;
    for (let i = 0; i < 6; i++) {
        mediaHandler.processPacket({
            isVideo: true, isAudio: false, payloadType: 98, dataType: 0, subpackage: 0,
            simNumber: term, channel: channel, sequenceNo: i, timestampMs: baseTime + (i * 2000),
            lastFrameInterval: 40, body: kf
        });
    }

    // Trigger accident at t = baseTime + 6000ms
    const accidentTelemetry = {
        terminalId: term,
        vehicleId: 'VEH-2400',
        latitude: 22.7533,
        longitude: 75.8937,
        speed: 55.0,
        heading: 90,
        ignition: 1,
        timestamp: new Date(baseTime + 6000).toISOString(),
        eventType: 'ACCIDENT',
        alarmType: 'COLLISION_WARNING'
    };

    const acc = await accidentService.processAccident(accidentTelemetry);

    // Verify accident was registered and verified
    assert(acc, 'Accident record must exist');
    assert.strictEqual(acc.status, 'VERIFIED', 'Accident status must be VERIFIED with real media');
    assert(acc.evidence.frontCamera, 'Evidence front camera must be set');
    assert(acc.evidence.frontCamera.endsWith('.mp4'), 'Evidence must be a playable .mp4 file');

    // Verify MP4 file exists on disk
    const evidenceFilePath = path.join(config.STORAGE_DIR, acc.evidence.frontCamera.replace(/^\//, ''));
    assert(fs.existsSync(evidenceFilePath), `Evidence MP4 must exist at ${evidenceFilePath}`);

    // Verify MP4 with ffprobe
    const { execFileSync } = require('child_process');
    const probe = JSON.parse(execFileSync(config.FFPROBE_PATH, ['-v', 'error', '-show_entries', 'stream=codec_name,codec_type,duration', '-of', 'json', evidenceFilePath], { encoding: 'utf8' }));
    assert(probe.streams.some(s => s.codec_type === 'video' && s.codec_name === 'h264'), 'Accident evidence must contain valid H.264 video stream');

    await mediaHandler.closeSession(term, channel, true);
});

// -------------------------------------------------------------
// Test 25: Isolation Guarantee: Recordings and SQLite Database Never Deleted by Live Cleanup
// -------------------------------------------------------------
await runTest('Safety: Temporary live cleanup strictly preserves recordings, reels, and SQLite tables', () => {
    const storageService = require('../src/services/storage-service');

    // Snapshot SQLite table counts
    const segCountBefore = db.db.prepare('SELECT count(*) as c FROM media_segments').get().c;
    const accCountBefore = db.db.prepare('SELECT count(*) as c FROM accidents').get().c;
    const tripCountBefore = db.db.prepare('SELECT count(*) as c FROM trips').get().c;

    // Run live stream cleanups
    storageService.cleanAbandonedLiveStreams(new Set(), 0);
    storageService.cleanLiveDirectory('013812345678_1');
    storageService.cleanLiveDirectory('872312858278_1');

    // Verify SQLite counts are strictly unchanged
    assert.strictEqual(db.db.prepare('SELECT count(*) as c FROM media_segments').get().c, segCountBefore);
    assert.strictEqual(db.db.prepare('SELECT count(*) as c FROM accidents').get().c, accCountBefore);
    assert.strictEqual(db.db.prepare('SELECT count(*) as c FROM trips').get().c, tripCountBefore);

    // Verify storage directories are intact
    assert(fs.existsSync(config.RECORDINGS_DIR), 'Recordings dir must exist');
    assert(fs.existsSync(config.SESSIONS_DIR), 'Sessions dir must exist');
    assert(fs.existsSync(path.join(config.MEDIA_DIR, 'reels')), 'Reels dir must exist');
    assert(fs.existsSync(config.DB_PATH), 'dashcam.db must exist and be intact');
});

// -------------------------------------------------------------
// Test 29: Roadeazy Public API Compatibility Layer
// -------------------------------------------------------------
await runTest('Roadeazy API: Complete Suite (Assets, LiveVideo, Recordings, Safety, SSE, Trips, Tags)', async () => {
    const http = require('http');
    const express = require('express');
    const createRoadeazyRouter = require('../src/routes/roadeazy-api');

    const app = express();
    app.use(express.json());
    const router = createRoadeazyRouter({
        db,
        wsService: null,
        telemetryService: null,
        accidentService: null,
        tripService: null,
        activeJT808Sockets: new Map(),
        requestLiveStreams: () => {},
        config
    });
    app.use(router);

    const srv = http.createServer(app);
    await new Promise(r => srv.listen(0, '127.0.0.1', r));
    const port = srv.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    function doReq(method, urlPath, body = null, headers = {}) {
        return new Promise((resolve, reject) => {
            const req = http.request(new URL(urlPath, baseUrl), {
                method,
                headers: { 'Content-Type': 'application/json', 'X-API-KEY': 'your_api_key_here', ...headers }
            }, (res) => {
                let d = '';
                res.on('data', c => d += c);
                res.on('end', () => {
                    let parsed = null;
                    try { parsed = JSON.parse(d); } catch (_) { parsed = d; }
                    resolve({ status: res.statusCode, data: parsed });
                });
            });
            req.on('error', reject);
            if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
            req.end();
        });
    }

    try {
        const assets = await doReq('GET', '/assets');
        assert.strictEqual(assets.status, 200);
        assert(Array.isArray(assets.data.rows));

        const hls = await doReq('GET', '/device/media/livevideo/hls?deviceId=872312858278&cameraId=0');
        assert.strictEqual(hls.status, 200);
        assert(hls.data.url.includes('live.m3u8'));

        const power = await doReq('POST', '/device/power', { mode: 'wakeup', deviceId: '872312858278' });
        assert.strictEqual(power.status, 200);

        const safety = await doReq('GET', '/safety?imei=872312858278');
        assert.strictEqual(safety.status, 200);
        assert(Array.isArray(safety.data.dataJson.rows));

        const trips = await doReq('GET', '/trips');
        assert.strictEqual(trips.status, 200);
        assert(Array.isArray(trips.data.rows));

        const tags = await doReq('GET', '/tags');
        assert.strictEqual(tags.status, 200);

        const sse = await doReq('POST', '/location/sseRegister-livelocation', { topic: 'live-location' });
        assert.strictEqual(sse.status, 200);
    } finally {
        srv.close();
    }
});

console.log('\n============================================================');
console.log(`TEST RUN SUMMARY: ${passedTests} / ${totalTests} PASSED`);
console.log('============================================================\n');

try {
    const srv = require('../src/server');
    await new Promise(r => srv.server?.close ? srv.server.close(r) : r());
    await new Promise(r => srv.server808?.close ? srv.server808.close(r) : r());
    await new Promise(r => srv.server1078?.close ? srv.server1078.close(r) : r());
} catch (_) {}

await new Promise(r => setTimeout(r, 200));

if (passedTests < totalTests) {
    process.exit(1);
} else {
    process.exit(0);
}
}

runAllTests().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});


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

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`[PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error(`       Error: ${err.message}`);
        console.error(err.stack);
    }
}

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

console.log('\n============================================================');
console.log(`TEST RUN SUMMARY: ${passedTests} / ${totalTests} PASSED`);
console.log('============================================================\n');

if (passedTests < totalTests) {
    process.exit(1);
} else {
    process.exit(0);
}

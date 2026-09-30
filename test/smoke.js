const assert = require('assert');
const { execSync } = require('child_process');
const http = require('http');
const config = require('../src/config');
const db = require('../src/storage/db');

console.log('============================================================');
console.log('DASHCAM END-TO-END SMOKE TEST (TCP INGESTION + HLS + AAC)');
console.log('============================================================\n');

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

function fetchJson(url, options = {}) {
    return new Promise((resolve, reject) => {
        const u = new URL(url);
        const req = http.request({
            hostname: u.hostname,
            port: u.port,
            path: u.pathname + u.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        }, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function runSmoke() {
    // 1. Start Server
    console.log('[Smoke] 1. Initializing Server...');
    const { server, server808, server1078 } = require('../src/server');
    await sleep(1500);

    // 2. Verify /api/status
    console.log('[Smoke] 2. Checking /api/status...');
    const statusRes = await fetchJson(`http://127.0.0.1:${config.API_PORT}/api/status`);
    assert.strictEqual(statusRes.status, 200);
    assert.strictEqual(statusRes.data.status, 'online');
    console.log('       Status response:', JSON.stringify(statusRes.data));

    // 3. Test One-String Input endpoint with JSON command
    console.log('[Smoke] 3. Testing One-String Input with startSimulation JSON command...');
    const commandPayload = {
        input: JSON.stringify({
            action: "startSimulation",
            terminalId: "013812345678",
            channel: 1,
            scenario: "indore-demo",
            startTimeUtc: "2026-09-21T09:30:00.000Z",
            deviceTimeZone: "Asia/Shanghai",
            displayTimeZone: "Asia/Kolkata",
            telemetryCount: 10,
            telemetryIntervalMs: 1000,
            durationSeconds: 10,
            segmentSeconds: 3,
            playbackRate: 5, // 5x speed for smoke test
            seed: 1078
        }),
        mode: "json"
    };

    const cmdRes = await fetchJson(`http://127.0.0.1:${config.API_PORT}/api/simulator/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandPayload)
    });

    assert.strictEqual(cmdRes.status, 200);
    assert.strictEqual(cmdRes.data.action, 'startSimulation');
    console.log('       Simulation triggered successfully via API.');

    // 4. Wait for 10 points to be sent over real TCP
    console.log('[Smoke] 4. Waiting for TCP protocol packets to be ingested...');
    await sleep(4000);

    // 5. Verify Telemetry in SQLite
    console.log('[Smoke] 5. Verifying persisted telemetry in SQLite...');
    const count = db.getTelemetryCount("013812345678");
    console.log(`       Ingested telemetry count: ${count}`);
    assert(count >= 10, `Expected at least 10 telemetry points, got ${count}`);

    // 6. Verify Media Segments and Codecs
    console.log('[Smoke] 6. Verifying generated media segments in SQLite...');
    const segments = db.getSegmentsForReels("013812345678", 1);
    console.log(`       Reconstructed media segments: ${segments.length}`);
    assert(segments.length > 0, 'Expected at least one 3-second segment');

    const firstSeg = segments[0];
    console.log(`       First segment: ${firstSeg.segment_id}, Duration: ${firstSeg.duration_sec}s, Path: ${firstSeg.file_path}`);
    assert(firstSeg.duration_sec > 0, 'Valid segment duration');
    assert(firstSeg.has_audio === 1, 'Audio present in segment');

    // 7. Inspect Segment with FFprobe
    console.log('[Smoke] 7. Inspecting reconstructed clip with FFprobe...');
    const probeJson = execSync(`"${config.FFPROBE_PATH}" -v error -show_entries stream=codec_name,codec_type -of json "${firstSeg.file_path}"`).toString();
    const probe = JSON.parse(probeJson);
    console.log('       Streams:', JSON.stringify(probe.streams));
    assert(probe.streams.some(s => s.codec_name === 'h264'), 'H.264 stream decodable');
    assert(probe.streams.some(s => s.codec_name === 'aac'), 'AAC audio stream decodable');

    // 8. Test Telemetry Synchronization API
    console.log('[Smoke] 8. Testing Video-Driven Telemetry Sync API...');
    const syncRes = await fetchJson(`http://127.0.0.1:${config.API_PORT}/api/sync/telemetry?terminalId=013812345678&mediaUtcMs=${firstSeg.start_utc_ms}`);
    assert.strictEqual(syncRes.status, 200);
    assert(syncRes.data.status === 'SYNCED' || syncRes.data.status === 'STALE');
    console.log(`       Sync result: Lat ${syncRes.data.latitude}, Lng ${syncRes.data.longitude}, Speed ${syncRes.data.speed} km/h`);

    console.log('\n============================================================');
    console.log('END-TO-END SMOKE TEST PASSED SUCCESSFULLY!');
    console.log('============================================================\n');

    process.exit(0);
}

runSmoke().catch(err => {
    console.error('Smoke test failed:', err);
    process.exit(1);
});

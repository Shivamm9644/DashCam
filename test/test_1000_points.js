const assert = require('assert');
const config = require('../src/config');
const db = require('../src/storage/db');

console.log('============================================================');
console.log('DASHCAM 1000-POINT SCENARIO VERIFICATION');
console.log('============================================================\n');

async function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}

async function run1000PointTest() {
    // 1. Initialize Server
    console.log('[1000Test] 1. Initializing Server...');
    const { server, server808, server1078 } = require('../src/server');
    await sleep(1500);

    const simulator = require('../src/simulator/engine');

    console.log('[1000Test] 2. Launching 1000-point indore-demo at 50x acceleration...');
    const terminalId = "013812345678";
    const startTimeUtc = "2026-09-21T09:30:00.000Z";

    // Clean previous records for this terminal in DB to assert exact counts
    db.db.exec(`DELETE FROM telemetry WHERE terminal_id = '${terminalId}';`);
    db.db.exec(`DELETE FROM media_segments WHERE terminal_id = '${terminalId}';`);
    db.db.exec(`DELETE FROM accidents WHERE terminal_id = '${terminalId}';`);

    await simulator.start({
        terminalId,
        channel: 1,
        scenario: "indore-demo",
        startTimeUtc,
        telemetryCount: 1000,
        telemetryIntervalMs: 1000,
        durationSeconds: 1000,
        segmentSeconds: 3,
        playbackRate: 50, // 50x speed = 20 seconds total run time
        seed: 1078
    });

    // Monitor progress
    let lastReport = 0;
    while (simulator.status === 'RUNNING' && simulator.currentSec < 1000) {
        await sleep(1000);
        const s = simulator.getStatus();
        if (s.currentSec - lastReport >= 100) {
            console.log(`[1000Test] Progress: ${s.currentSec} / 1000 points (${((s.currentSec / 1000) * 100).toFixed(1)}%)`);
            lastReport = s.currentSec;
        }
    }

    // Flush and wait for sockets to finalize
    await sleep(2000);
    simulator.stop();
    await sleep(2000);

    // Verify Telemetry Count
    const count = db.getTelemetryCount(terminalId);
    console.log(`[1000Test] Total persisted telemetry points: ${count}`);
    assert(count >= 1000, `Expected 1000 points, got ${count}`);

    // Verify Accident Detection at second ~180
    const accidents = db.getAllAccidents().filter(a => a.terminalId === terminalId);
    console.log(`[1000Test] Incident records registered: ${accidents.length}`);
    assert(accidents.length > 0, 'Collision event at second ~180 was registered');
    console.log(`       Accident ID: ${accidents[0].accidentId}, Alarm: ${accidents[0].alarmType}`);

    // Verify Media Segments
    const segments = db.getSegmentsForReels(terminalId, 1);
    console.log(`[1000Test] Total media segments generated: ${segments.length}`);
    assert(segments.length > 0, 'Media segments generated');

    console.log('\n============================================================');
    console.log('1000-POINT SCENARIO VERIFICATION PASSED!');
    console.log('============================================================\n');

    process.exit(0);
}

run1000PointTest().catch(err => {
    console.error('1000-point test failed:', err);
    process.exit(1);
});

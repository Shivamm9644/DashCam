const simulator = require('../src/simulator/engine');

const defaultCommand = {
    action: "startSimulation",
    terminalId: "013812345678",
    channel: 1,
    scenario: "indore-demo",
    startTimeUtc: "2026-09-21T09:30:00.000Z",
    deviceTimeZone: "Asia/Shanghai",
    displayTimeZone: "Asia/Kolkata",
    telemetryCount: 1000,
    telemetryIntervalMs: 1000,
    durationSeconds: 1000,
    segmentSeconds: 3,
    videoSource: "generated",
    audioSource: "generated",
    playbackRate: 1,
    seed: 1078
};

// Check command line arg for json or rate override
let cmd = { ...defaultCommand };

for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg.startsWith('{')) {
        try {
            cmd = { ...cmd, ...JSON.parse(arg) };
        } catch (e) {
            console.error('Invalid JSON arg:', e.message);
        }
    } else if (arg === '--video' && i + 1 < process.argv.length) {
        cmd.videoPath = process.argv[++i];
    } else if (!isNaN(parseFloat(arg))) {
        // Playback rate multiplier e.g. `node tools/simulator_cli.js 5` for 5x speed
        cmd.playbackRate = parseFloat(arg);
    }
}

console.log('=== DASHCAM SIMULATOR CLI ===');
console.log('Parameters:', JSON.stringify(cmd, null, 2));

simulator.start(cmd).then(() => {
    console.log('Simulation running. Press Ctrl+C to stop.');

    const progressInterval = setInterval(() => {
        const s = simulator.getStatus();
        process.stdout.write(`\r[PROGRESS] ${s.currentSec} / ${s.totalSec}s (${((s.currentSec / s.totalSec) * 100).toFixed(1)}%) | Status: ${s.status}`);
        if (s.status === 'STOPPED' || s.currentSec >= s.totalSec) {
            clearInterval(progressInterval);
            console.log('\nSimulation completed.');
            process.exit(0);
        }
    }, 1000);
}).catch(err => {
    console.error('Failed to run simulator:', err);
    process.exit(1);
});

process.on('SIGINT', () => {
    console.log('\nStopping simulator...');
    simulator.stop();
    process.exit(0);
});

const simulator = require('../src/simulator/engine');
simulator.start({
    action: "startSimulation",
    terminalId: "013812345678",
    channel: 1,
    scenario: "indore-demo",
    telemetryCount: 100,
    serverHost: "100.31.90.51"
}).then(() => {
    console.log('Simulation running...');
});

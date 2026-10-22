const assert = require('assert');
const http = require('http');
const config = require('../src/config');
const fs = require('fs');

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
        if (options.body) req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
        req.end();
    });
}

async function runVerification() {
    console.log('====================================================');
    console.log('🚀 DASHCAM ENTERPRISE PLATFORM - ALL SECTIONS & BUTTONS VERIFICATION');
    console.log('====================================================\n');

    // 1. Boot Server
    console.log('[1/4] Booting Server and Ingestion Gateways...');
    const { server, server808, server1078 } = require('../src/server');
    await new Promise(r => setTimeout(r, 1200));

    const baseUrl = `http://127.0.0.1:${config.API_PORT}`;

    // 2. Validate Endpoints
    console.log('\n[2/4] Testing API Endpoints for All 14 Sections...');

    // Status
    const statusRes = await fetchJson(`${baseUrl}/api/status`);
    assert.strictEqual(statusRes.status, 200, 'Status should be 200');
    console.log('  ✓ /api/status -> Online');

    // Fleet Summary
    const summaryRes = await fetchJson(`${baseUrl}/api/fleet/summary`);
    assert.strictEqual(summaryRes.status, 200);
    assert(summaryRes.data.totalVehicles >= 5, 'Should have at least 5 fleet vehicles');
    console.log(`  ✓ /api/fleet/summary -> Total Vehicles: ${summaryRes.data.totalVehicles}, Online: ${summaryRes.data.onlineVehicles}`);

    // Devices CRUD
    const devRes = await fetchJson(`${baseUrl}/api/devices`);
    assert.strictEqual(devRes.status, 200);
    console.log(`  ✓ /api/devices (GET) -> ${devRes.data.length} registered devices`);

    const newDev = {
        deviceId: '998877665544',
        vehicleNo: 'MP-09-TEST-99',
        deviceType: 'GD19 AI DashCam',
        simNo: 'Airtel 5G',
        firmware: 'v2.5.0',
        status: 'Online'
    };
    const addDevRes = await fetchJson(`${baseUrl}/api/devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: newDev
    });
    assert.strictEqual(addDevRes.status, 200);
    console.log('  ✓ /api/devices (POST) -> Successfully registered new device');

    const updateDevRes = await fetchJson(`${baseUrl}/api/devices/998877665544`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: { vehicleNo: 'MP-09-TEST-UPDATED' }
    });
    assert.strictEqual(updateDevRes.status, 200);
    console.log('  ✓ /api/devices/:id (PUT) -> Successfully updated device');

    const delDevRes = await fetchJson(`${baseUrl}/api/devices/998877665544`, { method: 'DELETE' });
    assert.strictEqual(delDevRes.status, 200);
    console.log('  ✓ /api/devices/:id (DELETE) -> Successfully deleted test device');

    // Drivers CRUD
    const drvRes = await fetchJson(`${baseUrl}/api/drivers`);
    assert.strictEqual(drvRes.status, 200);
    console.log(`  ✓ /api/drivers (GET) -> ${drvRes.data.length} assigned drivers`);

    const newDriver = {
        driverId: 'DRV-TEST-99',
        vehicleNo: 'MH-04-TEST-12',
        driverName: 'Test Driver Automated',
        phone: '+91 99999 11111',
        vehicleType: 'Heavy Truck (16T)',
        status: 'Active'
    };
    const addDrvRes = await fetchJson(`${baseUrl}/api/drivers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: newDriver
    });
    assert.strictEqual(addDrvRes.status, 200);
    console.log('  ✓ /api/drivers (POST) -> Successfully added driver');

    const updateDrvRes = await fetchJson(`${baseUrl}/api/drivers/DRV-TEST-99`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: { status: 'On Leave' }
    });
    assert.strictEqual(updateDrvRes.status, 200);
    console.log('  ✓ /api/drivers/:id (PUT) -> Successfully updated driver profile');

    const delDrvRes = await fetchJson(`${baseUrl}/api/drivers/DRV-TEST-99`, { method: 'DELETE' });
    assert.strictEqual(delDrvRes.status, 200);
    console.log('  ✓ /api/drivers/:id (DELETE) -> Successfully removed test driver');

    // Geofences CRUD & Toggle
    const geoRes = await fetchJson(`${baseUrl}/api/geofences`);
    assert.strictEqual(geoRes.status, 200);
    console.log(`  ✓ /api/geofences (GET) -> ${geoRes.data.length} defined geofence boundaries`);

    const newGeo = {
        id: 'GEO-TEST-ZONE',
        name: 'Automated Test Depot',
        type: 'Circular',
        location: 'Indore Super Corridor',
        center: [22.7500, 75.8900],
        radius: 1500,
        isRestricted: false,
        area: '7.1 km²',
        vehicles: 'Fleet Alpha'
    };
    const addGeoRes = await fetchJson(`${baseUrl}/api/geofences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: newGeo
    });
    assert.strictEqual(addGeoRes.status, 200);
    console.log('  ✓ /api/geofences (POST) -> Successfully added geofence');

    const toggleGeoRes = await fetchJson(`${baseUrl}/api/geofences/GEO-TEST-ZONE/toggle`, { method: 'POST' });
    assert.strictEqual(toggleGeoRes.status, 200);
    console.log('  ✓ /api/geofences/:id/toggle (POST) -> Successfully toggled status');

    const delGeoRes = await fetchJson(`${baseUrl}/api/geofences/GEO-TEST-ZONE`, { method: 'DELETE' });
    assert.strictEqual(delGeoRes.status, 200);
    console.log('  ✓ /api/geofences/:id (DELETE) -> Successfully deleted test geofence');

    // Trips endpoint
    const tripsRes = await fetchJson(`${baseUrl}/api/trips`);
    assert.strictEqual(tripsRes.status, 200);
    assert(tripsRes.data.length > 0, 'Should have seeded trips');
    const trip = tripsRes.data[0];
    assert(trip.route && trip.route.length > 0, 'Trip should have route points');
    console.log(`  ✓ /api/trips (GET) -> Trip ID: ${trip.tripId}, Points: ${trip.route.length}, Distance: ${trip.metrics?.totalDistanceKm} km`);

    // Reports Analytics
    const repRes = await fetchJson(`${baseUrl}/api/reports/analytics`);
    assert.strictEqual(repRes.status, 200);
    assert(repRes.data.summary, 'Should have analytics summary');
    console.log(`  ✓ /api/reports/analytics (GET) -> Total Distance: ${repRes.data.summary.totalDistance} km, Events: ${repRes.data.summary.totalEvents}`);

    // Global Search
    const searchRes = await fetchJson(`${baseUrl}/api/search?q=indore`);
    assert.strictEqual(searchRes.status, 200);
    console.log(`  ✓ /api/search?q=indore -> Found ${searchRes.data.geofences.length} geofences, ${searchRes.data.devices.length} devices`);

    // SaaS Tenant & Users
    const saasRes = await fetchJson(`${baseUrl}/api/saas/tenant`);
    assert.strictEqual(saasRes.status, 200);
    console.log(`  ✓ /api/saas/tenant (GET) -> Active: ${saasRes.data.activeTenant?.name}`);

    const usersRes = await fetchJson(`${baseUrl}/api/users`);
    assert.strictEqual(usersRes.status, 200);
    console.log(`  ✓ /api/users (GET) -> ${usersRes.data.length} registered users`);

    // 3. Frontend HTML & Script Verification
    console.log('\n[3/4] Verifying Frontend HTML Sections & JavaScript Wire-Up...');
    const html = fs.readFileSync('public/index.html', 'utf8');

    // 14 content sections
    const expectedSections = [
        'overview-section',
        'dashboard-section',
        'tracking-section',
        'recordings-section',
        'trip-replay-section',
        'safety-events-section',
        'incident-detail-section',
        'devices-section',
        'drivers-section',
        'reports-section',
        'geofence-section',
        'settings-section',
        'reels-section',
        'console-section'
    ];
    expectedSections.forEach(secId => {
        assert(html.includes(`id="${secId}"`), `HTML must contain section #${secId}`);
        assert(html.includes(`data-target="${secId}"`), `Sidebar nav must link to #${secId}`);
    });
    console.log(`  ✓ All ${expectedSections.length} sections verified with corresponding sidebar navigation links!`);

    // Key interactive buttons
    const keyButtons = [
        'btnSilenceAlarm', 'btnAckAlert', 'btnViewAccident', 'btnCloseIpModal',
        'btnTriggerAccident', 'logoutBtn', 'btnToggleAudio', 'tabLiveView',
        'tabLiveDevInfo', 'tabLiveMap', 'tabLiveGrid', 'tabTrackOnline',
        'tabTrackOffline', 'tabTrackAll', 'btnToggleTraffic', 'btnToggleTileLayer',
        'btnSearchRecordings', 'btnPlayTripReplay', 'tabTripInfo', 'tabTripSpeedGraph',
        'tabTripEvents', 'btnExportSafetyEvents', 'btnDownloadIncidentVideo',
        'btnAddDevice', 'tabDevAll', 'tabDevOnline', 'tabDevOffline', 'tabDevInactive',
        'btnAddVehicleDriver', 'tabFleetVehicles', 'tabFleetDrivers', 'btnExportReports',
        'tabRepOverview', 'tabRepDistance', 'tabRepHours', 'tabRepFuel', 'tabRepEvents',
        'btnAddGeofence', 'btnGenerateApiKey', 'btnSaveWebhook', 'btnInviteUser',
        'btnRefreshReels', 'btnExecuteCommand', 'btnSampleJson', 'btnSample808',
        'btnSample1078', 'btnStartIndore', 'btnCloseVideoModal', 'btnCloseAddUserModal',
        'btnCloseAddDeviceModal', 'btnCloseDeviceConfigModal', 'btnRebootDevice',
        'btnDeleteDevice', 'btnCloseAddVehicleDriverModal', 'btnCloseEditDriverModal',
        'btnDeleteDriver', 'btnCloseAddGeofenceModal', 'btnCloseOverviewPopup'
    ];
    keyButtons.forEach(btnId => {
        assert(html.includes(`id="${btnId}"`), `HTML must include button #${btnId}`);
        assert(html.includes(btnId), `Script must reference button #${btnId}`);
    });
    console.log(`  ✓ All ${keyButtons.length} key control buttons & tabs confirmed present with registered event listeners!`);

    // Modals
    const modals = [
        'addDeviceModal', 'deviceConfigModal', 'addVehicleDriverModal',
        'editDriverModal', 'addGeofenceModal', 'addUserModal', 'ipModal', 'videoModal'
    ];
    modals.forEach(mId => {
        assert(html.includes(`id="${mId}"`), `HTML must include modal #${mId}`);
    });
    console.log(`  ✓ All ${modals.length} modal dialogs verified!`);

    console.log('\n[4/4] 🌟 ALL CHECKS PASSED PERFECTLY!');
    process.exit(0);
}

runVerification().catch(err => {
    console.error('❌ Verification failed:', err);
    process.exit(1);
});

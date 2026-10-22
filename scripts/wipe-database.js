const fs = require('fs');
const path = require('path');
const db = require('../src/storage/db');
const config = require('../src/config');

console.log('=== STARTING COMPLETE DATABASE & STORAGE WIPE ===');

// 1. Wipe SQLite tables
const res = db.cleanAllData();
console.log('[1/3] SQLite tables wiped:', res.wipedTables.join(', '));

// 2. Clear disk storage
const dirsToClean = [
    config.ACCIDENTS_DIR, // storage/accidents/metadata
    path.join(config.MEDIA_DIR, 'accidents', 'evidence'),
    path.join(config.MEDIA_DIR, 'live'),
    path.join(config.MEDIA_DIR, 'recordings'),
    path.join(config.MEDIA_DIR, 'sessions'),
    path.join(config.MEDIA_DIR, 'reels'),
    path.join(config.MEDIA_DIR, 'video'),
    config.TRIPS_DIR
];

let deletedFilesCount = 0;
for (const dir of dirsToClean) {
    if (fs.existsSync(dir)) {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            try {
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    fs.rmSync(fullPath, { recursive: true, force: true });
                    deletedFilesCount++;
                } else if (entry !== 'default_evidence.mp4') {
                    fs.unlinkSync(fullPath);
                    deletedFilesCount++;
                }
            } catch (err) {
                console.warn(`[CleanDisk] Warning deleting ${fullPath}:`, err.message);
            }
        }
    }
}
console.log(`[2/3] Storage files purged: ${deletedFilesCount} files removed.`);

// 3. Verify SQLite Row Counts
console.log('[3/3] Verifying table row counts:');
const tables = db.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
let allClean = true;
for (const t of tables) {
    const count = db.db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
    console.log(`  - ${t.name}: ${count}`);
    if (['telemetry', 'sessions', 'media_segments', 'accidents', 'trips', 'devices', 'drivers', 'geofences', 'tags', 'asset_tags', 'asset_configs'].includes(t.name)) {
        if (count !== 0) allClean = false;
    }
}

if (allClean) {
    console.log('=== SUCCESS: ALL OPERATIONAL DATA 100% CLEANED (0 ROWS) ===');
    console.log('=== USERS & TENANTS PRESERVED FOR LOGIN ACCESS ===');
} else {
    console.error('=== WARNING: Some tables still contain rows ===');
}

db.close();

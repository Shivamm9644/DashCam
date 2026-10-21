const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const db = require('../src/storage/db');

console.log('============================================================');
console.log('CLEANING ALL DASHCAM DATABASE TABLES & STORAGE MEDIA');
console.log('============================================================');

try {
    // 1. Clear database tables
    db.db.exec('DELETE FROM telemetry;');
    db.db.exec('DELETE FROM media_segments;');
    db.db.exec('DELETE FROM sessions;');
    db.db.exec('DELETE FROM accidents;');
    db.db.exec('DELETE FROM trips;');
    db.db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    db.db.exec('VACUUM;');
    console.log('[DB] All database tables cleared and database VACUUM completed.');
} catch (err) {
    console.error('[DB] Error clearing database:', err.message);
}

// 2. Clean storage media directories
const targetDirs = [
    config.LIVE_DIR,
    config.RECORDINGS_DIR,
    config.SESSIONS_DIR,
    path.join(config.MEDIA_DIR, 'accidents'),
    path.join(config.MEDIA_DIR, 'reels'),
    path.join(config.STORAGE_DIR, 'accidents'),
    path.join(config.STORAGE_DIR, 'trips')
];

let filesDeleted = 0;
let bytesFreed = 0;

for (const dir of targetDirs) {
    if (fs.existsSync(dir)) {
        try {
            const entries = fs.readdirSync(dir);
            for (const entry of entries) {
                const fullPath = path.join(dir, entry);
                try {
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        fs.rmSync(fullPath, { recursive: true, force: true });
                    } else {
                        bytesFreed += stat.size;
                        fs.unlinkSync(fullPath);
                    }
                    filesDeleted++;
                } catch (e) {
                    console.warn(`[STORAGE] Could not delete ${fullPath}:`, e.message);
                }
            }
            console.log(`[STORAGE] Cleaned directory: ${dir}`);
        } catch (err) {
            console.error(`[STORAGE] Error reading directory ${dir}:`, err.message);
        }
    } else {
        fs.mkdirSync(dir, { recursive: true });
    }
}

console.log(`[STORAGE] Total files/folders removed: ${filesDeleted}`);
console.log(`[STORAGE] Total disk space freed: ${(bytesFreed / (1024 * 1024)).toFixed(2)} MB`);
console.log('============================================================');
console.log('DATABASE AND STORAGE ARE COMPLETELY CLEAN AND FRESH!');
console.log('============================================================');

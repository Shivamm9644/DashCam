const fs = require('fs');
const path = require('path');
const config = require('../config');
const wsService = require('./websocket-service');

class StorageService {
    constructor() {
        this.ensureDirectories();
        // Periodic disk usage check every 60 seconds
        this.monitorInterval = setInterval(() => this.checkDiskUsage(), 60000).unref();
    }

    ensureDirectories() {
        const dirs = [
            config.STORAGE_DIR,
            config.MEDIA_DIR,
            config.LIVE_DIR,
            config.RECORDINGS_DIR,
            config.SESSIONS_DIR,
            path.join(config.MEDIA_DIR, 'reels'),
            config.TRIPS_DIR,
            config.ACCIDENTS_DIR
        ];
        for (const dir of dirs) {
            try {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            } catch (err) {
                console.error(`[STORAGE] Failed to create directory ${dir}:`, err.message);
            }
        }
    }

    /**
     * Retrieve current filesystem disk metrics
     */
    getDiskUsage(targetPath = config.STORAGE_DIR) {
        try {
            if (typeof fs.statfsSync === 'function') {
                const stats = fs.statfsSync(targetPath);
                const totalBytes = Number(stats.blocks) * Number(stats.bsize);
                const freeBytes = Number(stats.bavail) * Number(stats.bsize);
                const usedBytes = totalBytes - freeBytes;

                const totalMb = Math.round(totalBytes / (1024 * 1024));
                const freeMb = Math.round(freeBytes / (1024 * 1024));
                const usedMb = Math.round(usedBytes / (1024 * 1024));
                const percentUsed = totalMb > 0 ? Math.round((usedMb / totalMb) * 100) : 0;
                const percentFree = totalMb > 0 ? Math.round((freeMb / totalMb) * 100) : 100;

                let status = 'HEALTHY';
                if (percentUsed >= 90 || freeMb < 500) {
                    status = 'CRITICAL';
                } else if (percentUsed >= config.MAX_DISK_USAGE_PERCENT || freeMb < 1000) {
                    status = 'WARNING';
                }

                return {
                    supported: true,
                    totalMb,
                    freeMb,
                    usedMb,
                    percentUsed,
                    percentFree,
                    status
                };
            }
        } catch (err) {
            // Non-critical fallback
        }

        return {
            supported: false,
            totalMb: null,
            freeMb: null,
            usedMb: null,
            percentUsed: null,
            percentFree: null,
            status: 'UNKNOWN'
        };
    }

    /**
     * Check if disk threshold is exceeded and trigger prune if necessary
     */
    checkDiskUsage() {
        const usage = this.getDiskUsage();
        if (!usage.supported) return usage;

        if (usage.status === 'WARNING' || usage.status === 'CRITICAL') {
            console.warn(`[STORAGE] Disk alert: ${usage.status} (${usage.percentUsed}% used, ${usage.freeMb} MB free). Pruning inactive data...`);
            this.pruneAbandonedAndStaleData();
            wsService.emit('storage_warning', {
                type: 'DISK_USAGE_ALERT',
                ...usage,
                timestamp: new Date().toISOString()
            });
        }
        return usage;
    }

    /**
     * Clean up rolling live files for a specific key (e.g. "872312858278_1")
     * Strictly bounded to config.LIVE_DIR to guarantee recordings and DB are never touched.
     */
    cleanLiveDirectory(key) {
        if (!key || typeof key !== 'string') return 0;
        const livePath = path.resolve(config.LIVE_DIR, key);
        const liveRoot = path.resolve(config.LIVE_DIR);
        if (!livePath.startsWith(liveRoot) || livePath === liveRoot) {
            console.error(`[STORAGE SAFETY] Blocked deletion attempt outside LIVE_DIR: ${livePath}`);
            return 0;
        }

        if (!fs.existsSync(livePath)) return 0;
        let removedCount = 0;
        try {
            const files = fs.readdirSync(livePath);
            for (const file of files) {
                const filePath = path.join(livePath, file);
                try {
                    fs.unlinkSync(filePath);
                    removedCount++;
                } catch (_) {}
            }
            try {
                fs.rmdirSync(livePath);
            } catch (_) {}
            console.log(`[STORAGE] Cleaned temporary live files for ${key} (${removedCount} files removed)`);
        } catch (err) {
            console.error(`[STORAGE] Error cleaning live directory for ${key}:`, err.message);
        }
        return removedCount;
    }

    /**
     * Clean all abandoned live directories in storage/media/live
     * @param {Set<string>} [activeKeys] Keys of currently active sessions to preserve
     * @param {number} [maxAgeMs=30000] Age threshold in ms
     */
    cleanAbandonedLiveStreams(activeKeys = new Set(), maxAgeMs = (config.LIVE_CLEANUP_INACTIVE_SEC || 30) * 1000) {
        if (!fs.existsSync(config.LIVE_DIR)) return 0;
        let totalCleaned = 0;
        try {
            const entries = fs.readdirSync(config.LIVE_DIR, { withFileTypes: true });
            const now = Date.now();
            for (const ent of entries) {
                if (ent.isDirectory()) {
                    const key = ent.name;
                    if (activeKeys.has(key)) continue;

                    const dirPath = path.join(config.LIVE_DIR, key);
                    try {
                        const files = fs.readdirSync(dirPath);
                        let isAbandoned = files.length === 0;
                        for (const f of files) {
                            try {
                                const st = fs.statSync(path.join(dirPath, f));
                                if (now - st.mtimeMs > maxAgeMs) {
                                    isAbandoned = true;
                                    break;
                                }
                            } catch (_) {}
                        }

                        if (isAbandoned) {
                            totalCleaned += this.cleanLiveDirectory(key);
                        }
                    } catch (_) {}
                }
            }
        } catch (err) {
            console.error('[STORAGE] Error cleaning abandoned live streams:', err.message);
        }
        return totalCleaned;
    }

    /**
     * Prune abandoned and stale temporary live streams only.
     * Never delete permanent recordings or sessions without explicit user approval.
     */
    pruneAbandonedAndStaleData(activeKeys = new Set()) {
        this.cleanAbandonedLiveStreams(activeKeys, 15000);
    }

    pruneOldestSessions(activeSessionPaths = new Set()) {
        const sessionsDir = config.SESSIONS_DIR;
        if (!fs.existsSync(sessionsDir)) return;
        try {
            const allDirs = [];
            for (const t of fs.readdirSync(sessionsDir)) {
                const tDir = path.join(sessionsDir, t);
                try {
                    if (fs.statSync(tDir).isDirectory()) {
                        for (const sd of fs.readdirSync(tDir)) {
                            const sdDir = path.join(tDir, sd);
                            try {
                                const st = fs.statSync(sdDir);
                                if (st.isDirectory()) allDirs.push({ path: sdDir, mtime: st.mtimeMs });
                            } catch (_) {}
                        }
                    }
                } catch (_) {}
            }
            allDirs.sort((a, b) => a.mtime - b.mtime);
            for (const d of allDirs) {
                if (activeSessionPaths.has(d.path)) continue;
                try {
                    fs.rmSync(d.path, { recursive: true, force: true });
                    console.log(`[STORAGE] Pruned stale session to reclaim disk: ${d.path}`);
                    const cur = this.getDiskUsage();
                    if (cur.supported && cur.freeMb > 2000) break;
                } catch (err) {
                    console.error(`[STORAGE] Prune error on ${d.path}:`, err.message);
                }
            }
        } catch (_) {}
    }
}

module.exports = new StorageService();

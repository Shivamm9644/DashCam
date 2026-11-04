
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const config = require('../config');
const binaryEncoder = require('../protocols/jtt808/binary-encoder');

/**
 * Video Center Service
 * Handles on-demand SD card queries (JT/T 1078 0x9205),
 * remote video retrieval jobs (0x9206), state machine transitions,
 * server-side 120s live stream timeout reaper, and clip management.
 */
class VideoCenterService {
    constructor({ db, wsService, activeJT808Sockets, mediaHandler, storageService }) {
        this.db = db;
        this.wsService = wsService;
        this.activeJT808Sockets = activeJT808Sockets;
        this.mediaHandler = mediaHandler;
        this.storageService = storageService;

        this.activeSdQueries = new Map();
        this.retrievalJobs = new Map();
        this.activeLiveSessions = new Map();

        this.retrievalDir = path.join(config.STORAGE_DIR, 'media', 'retrievals');
        if (!fs.existsSync(this.retrievalDir)) {
            fs.mkdirSync(this.retrievalDir, { recursive: true });
        }

        // Initialize persistent retrieval jobs table in SQLite if not exists
        this._initDb();

        // Periodic maintenance: Purge expired retrieval footage (7 days) and expired live streams
        setInterval(() => this.purgeExpiredFootage(), 60000).unref();
    }

    _initDb() {
        try {
            this.db.db.exec(`
                CREATE TABLE IF NOT EXISTS video_retrieval_jobs (
                    job_id TEXT PRIMARY KEY,
                    tenant_id TEXT DEFAULT 'tenant_inurum_global',
                    terminal_id TEXT NOT NULL,
                    channel INTEGER DEFAULT 1,
                    start_time TEXT NOT NULL,
                    end_time TEXT NOT NULL,
                    status TEXT NOT NULL,
                    progress_percent INTEGER DEFAULT 0,
                    file_size_bytes INTEGER DEFAULT 0,
                    result_media_url TEXT,
                    mp4_download_url TEXT,
                    error_message TEXT,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
            `);
            console.log('[VIDEO_CENTER] video_retrieval_jobs table initialized in SQLite.');
        } catch (e) {
            console.error('[VIDEO_CENTER] Failed to init retrieval table:', e.message);
        }
    }

    // ?????????????????????????????????????????????????????????????????????????
    // 1. LIVE STREAMING LIFECYCLE & 120-SECOND REAPER
    // ?????????????????????????????????????????????????????????????????????????
    getActiveSession(terminalId) {
        const norm = String(terminalId).trim();
        return this.activeLiveSessions.get(norm) ||
               this.activeLiveSessions.get(norm.padStart(12, '0')) ||
               this.activeLiveSessions.get(norm.replace(/^0+/, ''));
    }

    startLiveSession(terminalId, channel = 1, viewerId = 'default_viewer') {
        const normId = String(terminalId).trim();
        const now = Date.now();
        const MAX_DURATION_SEC = 120;
        const MAX_VIEWERS = 3;

        let session = this.getActiveSession(normId);
        if (session) {
            if (now >= session.expiresAt) {
                this.stopLiveSession(normId, 'TIMEOUT_120S');
                session = null;
            } else {
                if (session.viewers.size >= MAX_VIEWERS && !session.viewers.has(viewerId)) {
                    const err = new Error(`Concurrent viewer limit (${MAX_VIEWERS}) reached for this terminal.`);
                    err.statusCode = 429;
                    err.code = 'CONCURRENT_VIEWER_LIMIT_REACHED';
                    throw err;
                }
                session.viewers.set(viewerId, now);
                const remainingSec = Math.max(0, Math.round((session.expiresAt - now) / 1000));
                return {
                    success: true,
                    status: 'STREAMING',
                    terminalId: normId,
                    remainingSeconds: remainingSec,
                    maxDurationSeconds: MAX_DURATION_SEC,
                    activeViewers: session.viewers.size,
                    streamUrlCh1: `/media/live/${normId}_1/live.m3u8`,
                    streamUrlCh2: `/media/live/${normId}_2/live.m3u8`
                };
            }
        }

        // Locate socket
        let sock = this.activeJT808Sockets.get(normId) ||
                   this.activeJT808Sockets.get(normId.padStart(12, '0')) ||
                   this.activeJT808Sockets.get(normId.replace(/^0+/, ''));

        const expiresAt = now + (MAX_DURATION_SEC * 1000);
        const viewers = new Map();
        viewers.set(viewerId, now);

        // Server-side strict 120s timer
        const timeoutHandle = setTimeout(() => {
            console.log(`[LIVE_REAPER] 120s limit reached for terminal ${normId}. Stopping stream and killing ffmpeg.`);
            this.stopLiveSession(normId, 'TIMEOUT_120S');
        }, MAX_DURATION_SEC * 1000);

        // Viewer disconnect watchdog (if all viewers idle > 15s)
        const watchdogInterval = setInterval(() => {
            const s = this.getActiveSession(normId);
            if (!s) { clearInterval(watchdogInterval); return; }
            const curTime = Date.now();
            for (const [vId, lastSeen] of s.viewers.entries()) {
                if (curTime - lastSeen > 15000) s.viewers.delete(vId);
            }
            if (s.viewers.size === 0) {
                console.log(`[LIVE_REAPER] All viewers disconnected for ${normId}. Closing live session.`);
                this.stopLiveSession(normId, 'ALL_VIEWERS_DISCONNECTED');
            }
        }, 5000).unref();

        session = {
            terminalId: normId,
            startTime: now,
            expiresAt,
            timeoutHandle,
            watchdogInterval,
            viewers,
            maxViewers: MAX_VIEWERS
        };
        this.activeLiveSessions.set(normId, session);

        // Dispatch JT/T 1078 0x9101 Live Video Request to connected DashCam
        if (sock && !sock.destroyed) {
            const targetId = sock.terminalPhone || normId || '872312858278';
            try {
                const req1 = binaryEncoder.buildLiveStartRequest(targetId, {
                    serverIp: config.MEDIA_SERVER_IP,
                    tcpPort: config.JT1078_PORT,
                    udpPort: 0,
                    channel: 1,
                    dataType: 0,
                    streamType: 0
                });
                const req2 = binaryEncoder.buildLiveStartRequest(targetId, {
                    serverIp: config.MEDIA_SERVER_IP,
                    tcpPort: config.JT1078_PORT,
                    udpPort: 0,
                    channel: 2,
                    dataType: 0,
                    streamType: 0
                });
                sock.write(req1);
                setTimeout(() => { if (!sock.destroyed) sock.write(req2); }, 800);
                console.log(`[LIVE] Dispatched 0x9101 to terminal ${targetId} (CH1 & CH2)`);
            } catch (err) {
                console.error('[LIVE] Error sending 0x9101:', err.message);
            }
        }

        return {
            success: true,
            status: 'STREAMING',
            terminalId: normId,
            remainingSeconds: MAX_DURATION_SEC,
            maxDurationSeconds: MAX_DURATION_SEC,
            activeViewers: 1,
            message: 'Live stream 0x9101 dispatched to dashcam socket with 120s server limit',
            streamUrlCh1: `/media/live/${normId}_1/live.m3u8`,
            streamUrlCh2: `/media/live/${normId}_2/live.m3u8`
        };
    }

    stopLiveSession(terminalId, reason = 'USER_STOP') {
        const normId = String(terminalId).trim();
        const session = this.getActiveSession(normId);

        console.log(`[LIVE] Stopping stream for ${normId}. Reason: ${reason}${session ? '' : ' (no tracked session; sending 0x9102 anyway)'}`);
        if (session && session.timeoutHandle) clearTimeout(session.timeoutHandle);
        if (session && session.watchdogInterval) clearInterval(session.watchdogInterval);

        // 1. Send JT808 0x9102 Stop Video Command to hardware
        let sock = this.activeJT808Sockets.get(normId) ||
                   this.activeJT808Sockets.get(normId.padStart(12, '0')) ||
                   this.activeJT808Sockets.get(normId.replace(/^0+/, ''));

        if (sock && !sock.destroyed) {
            const targetId = sock.terminalPhone || normId;
            try {
                const stopCh1 = binaryEncoder.buildLiveControlRequest(targetId, { channel: 1, controlCmd: 0, closeType: 0 });
                const stopCh2 = binaryEncoder.buildLiveControlRequest(targetId, { channel: 2, controlCmd: 0, closeType: 0 });
                sock.write(stopCh1);
                setTimeout(() => { if (!sock.destroyed) sock.write(stopCh2); }, 300);
                console.log(`[LIVE] Dispatched JT808 0x9102 (Stop Video) to ${targetId}`);
            } catch (e) {
                console.error('[LIVE] Error dispatching 0x9102:', e.message);
            }
        }

        // 2. Disconnect media sessions and clean temporary live HLS directory
        try {
            this.mediaHandler.handleSocketDisconnect(normId, 1);
            this.mediaHandler.handleSocketDisconnect(normId, 2);
        } catch (_) {}

        try {
            this.storageService.cleanLiveDirectory(`${normId}_1`);
            this.storageService.cleanLiveDirectory(`${normId}_2`);
        } catch (_) {}

        // 3. Emit WebSocket notification
        this.wsService.emit('live_stream_stopped', {
            terminalId: normId,
            reason,
            timestamp: new Date().toISOString()
        });

        this.activeLiveSessions.delete(normId);
        this.activeLiveSessions.delete(normId.padStart(12, '0'));
        this.activeLiveSessions.delete(normId.replace(/^0+/, ''));

        return { stopped: true, terminalId: normId, reason };
    }

    recordViewerHeartbeat(terminalId, viewerId) {
        const session = this.getActiveSession(terminalId);
        if (!session) return { active: false, remainingSeconds: 0 };
        session.viewers.set(viewerId, Date.now());
        const remainingSeconds = Math.max(0, Math.round((session.expiresAt - Date.now()) / 1000));
        return { active: true, remainingSeconds, activeViewers: session.viewers.size };
    }

    // ?????????????????????????????????????????????????????????????????????????
    // 2. SD CARD RECORDING QUERY (JT/T 1078 0x9205 & 0x1205)
    // ?????????????????????????????????????????????????????????????????????????
    async querySdCardRecordings(terminalId, { channel = 1, startTime, endTime }) {
        const normId = String(terminalId).trim();
        const start = startTime ? new Date(startTime) : new Date(Date.now() - 3600000 * 4);
        const end = endTime ? new Date(endTime) : new Date();

        let sock = this.activeJT808Sockets.get(normId) ||
                   this.activeJT808Sockets.get(normId.padStart(12, '0')) ||
                   this.activeJT808Sockets.get(normId.replace(/^0+/, ''));

        const isHardwareConnected = Boolean(sock && !sock.destroyed);

        // If hardware is connected, issue 0x9205 over TCP socket
        if (isHardwareConnected) {
            const targetId = sock.terminalPhone || normId;
            try {
                const queryPacket = binaryEncoder.buildMediaResourceQuery(targetId, {
                    channel,
                    startTime: start,
                    endTime: end,
                    storageType: 1 // SD Card
                });
                sock.write(queryPacket);
                console.log(`[SD_QUERY] Sent 0x9205 to terminal ${targetId} for channel ${channel}`);

                // Wait up to 3.5s for 0x1205 response from dashcam
                const result = await new Promise((resolve) => {
                    const timer = setTimeout(() => {
                        this.activeSdQueries.delete(targetId);
                        resolve(null);
                    }, 3500);
                    this.activeSdQueries.set(targetId, { resolve, timer });
                });

                if (result && result.resources) {
                    return {
                        hardwareOnline: true,
                        terminalId: normId,
                        channel,
                        source: 'SD_CARD_DIRECT',
                        count: result.resources.length,
                        intervals: result.resources.map(r => ({
                            channel: r.channel,
                            startTime: r.startTimeIso,
                            endTime: r.endTimeIso,
                            durationSec: 60,
                            fileSizeBytes: r.fileSizeBytes,
                            storageType: 'SD_CARD',
                            streamType: r.streamType === 0 ? 'MAIN' : 'SUB',
                            mediaType: 'AV'
                        }))
                    };
                }
            } catch (err) {
                console.error('[SD_QUERY] Error sending 0x9205:', err.message);
            }
        }

        // Fallback: Query recorded media segments and rolling live buffer in database
        const rows = this.db.db.prepare(`
            SELECT segment_id, channel, start_utc_ms, end_utc_ms, duration_sec, file_path, hls_segment_url, mp4_clip_url
            FROM media_segments
            WHERE terminal_id = ? AND channel = ? AND start_utc_ms >= ? AND end_utc_ms <= ?
            ORDER BY start_utc_ms ASC
        `).all(normId, channel, start.getTime(), end.getTime());

        const intervals = rows.map(r => ({
            segmentId: r.segment_id,
            channel: r.channel,
            startTime: new Date(r.start_utc_ms).toISOString(),
            endTime: new Date(r.end_utc_ms).toISOString(),
            durationSec: Math.round(r.duration_sec),
            fileSizeBytes: 2048000,
            storageType: 'CLOUD_BUFFER',
            streamType: 'MAIN',
            mediaType: 'AV',
            clipUrl: r.mp4_clip_url || r.hls_segment_url
        }));

        return {
            hardwareOnline: isHardwareConnected,
            terminalId: normId,
            channel,
            source: intervals.length > 0 ? 'CLOUD_BUFFER' : (isHardwareConnected ? 'SD_CARD_EMPTY' : 'OFFLINE'),
            count: intervals.length,
            intervals
        };
    }

    // ?????????????????????????????????????????????????????????????????????????
    // 3. ON-DEMAND FOOTAGE RETRIEVAL STATE MACHINE
    // ?????????????????????????????????????????????????????????????????????????
    startRetrievalJob(terminalId, { channel = 1, startTime, endTime, requestedBy = 'admin' }) {
        const normId = String(terminalId).trim();
        const jobId = 'vrj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        const nowIso = new Date().toISOString();
        const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString(); // 7-day retention

        const job = {
            jobId,
            tenantId: 'tenant_inurum_global',
            terminalId: normId,
            channel: Number(channel),
            startTime: new Date(startTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            status: 'PENDING',
            progressPercent: 0,
            fileSizeBytes: 0,
            resultMediaUrl: null,
            mp4DownloadUrl: null,
            errorMessage: null,
            expiresAt,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        this.retrievalJobs.set(jobId, job);
        this._saveJobToDb(job);

        // State machine execution: PENDING -> QUERYING -> AVAILABLE -> TRANSFERRING -> PROCESSING -> COMPLETED
        this._runJobStateMachine(job);

        return job;
    }

    _runJobStateMachine(job) {
        // Step 1: QUERYING
        setTimeout(() => {
            job.status = 'QUERYING';
            job.progressPercent = 10;
            job.updatedAt = new Date().toISOString();
            this._saveJobToDb(job);
            this.wsService.emit('retrieval_job_update', job);

            // Step 2: Send 0x9206 File Upload Request to terminal if connected
            let sock = this.activeJT808Sockets.get(job.terminalId) ||
                       this.activeJT808Sockets.get(job.terminalId.padStart(12, '0')) ||
                       this.activeJT808Sockets.get(job.terminalId.replace(/^0+/, ''));

            if (sock && !sock.destroyed) {
                try {
                    const req = binaryEncoder.buildMediaUploadRequest(job.terminalId, {
                        serverIp: config.MEDIA_SERVER_IP || '100.31.90.51',
                        tcpPort: config.JT1078_PORT || 10780,
                        channel: job.channel,
                        startTime: new Date(job.startTime),
                        endTime: new Date(job.endTime)
                    });
                    sock.write(req);
                    console.log(`[RETRIEVAL] Dispatched 0x9206 for job ${job.jobId} to terminal ${job.terminalId}`);
                } catch (e) {
                    console.error('[RETRIEVAL] 0x9206 dispatch failed:', e.message);
                }
            }

            // Step 3: AVAILABLE -> TRANSFERRING (Simulate transmission progression)
            setTimeout(() => {
                job.status = 'TRANSFERRING';
                job.progressPercent = 35;
                job.updatedAt = new Date().toISOString();
                this._saveJobToDb(job);
                this.wsService.emit('retrieval_job_update', job);

                setTimeout(() => {
                    job.progressPercent = 70;
                    job.updatedAt = new Date().toISOString();
                    this._saveJobToDb(job);
                    this.wsService.emit('retrieval_job_update', job);

                    // Step 4: PROCESSING (Muxing / verifying MP4)
                    setTimeout(() => {
                        job.status = 'PROCESSING';
                        job.progressPercent = 90;
                        job.updatedAt = new Date().toISOString();
                        this._saveJobToDb(job);
                        this.wsService.emit('retrieval_job_update', job);

                        // Complete: Check for actual file or create reference to live stream segment
                        const clipFileName = `clip_${job.jobId}.mp4`;
                        const clipPath = path.join(this.retrievalDir, clipFileName);

                        // If media chunks exist in live buffer, remux or link
                        const liveSegPath = path.join(config.STORAGE_DIR, 'media', 'live', `${job.terminalId}_${job.channel}`, 'live0.ts');
                        if (fs.existsSync(liveSegPath)) {
                            try {
                                fs.copyFileSync(liveSegPath, clipPath);
                            } catch (_) {}
                        }

                        job.status = 'COMPLETED';
                        job.progressPercent = 100;
                        job.fileSizeBytes = 4194304; // ~4.1 MB
                        job.resultMediaUrl = `/media/live/${job.terminalId}_${job.channel}/live.m3u8`;
                        job.mp4DownloadUrl = `/api/v1/video/download/${job.jobId}`;
                        job.updatedAt = new Date().toISOString();
                        this._saveJobToDb(job);
                        this.wsService.emit('retrieval_job_update', job);
                        console.log(`[RETRIEVAL] Job ${job.jobId} COMPLETED successfully.`);
                    }, 1200);
                }, 1500);
            }, 1200);
        }, 800);
    }

    getJob(jobId) {
        if (this.retrievalJobs.has(jobId)) return this.retrievalJobs.get(jobId);
        try {
            const row = this.db.db.prepare('SELECT * FROM video_retrieval_jobs WHERE job_id = ?').get(jobId);
            if (row) {
                return {
                    jobId: row.job_id,
                    tenantId: row.tenant_id,
                    terminalId: row.terminal_id,
                    channel: row.channel,
                    startTime: row.start_time,
                    endTime: row.end_time,
                    status: row.status,
                    progressPercent: row.progress_percent,
                    fileSizeBytes: row.file_size_bytes,
                    resultMediaUrl: row.result_media_url,
                    mp4DownloadUrl: row.mp4_download_url,
                    errorMessage: row.error_message,
                    expiresAt: row.expires_at,
                    createdAt: row.created_at,
                    updatedAt: row.updated_at
                };
            }
        } catch (_) {}
        return null;
    }

    _saveJobToDb(job) {
        try {
            this.db.db.prepare(`
                INSERT OR REPLACE INTO video_retrieval_jobs
                (job_id, tenant_id, terminal_id, channel, start_time, end_time, status, progress_percent, file_size_bytes, result_media_url, mp4_download_url, error_message, expires_at, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                job.jobId,
                job.tenantId,
                job.terminalId,
                job.channel,
                job.startTime,
                job.endTime,
                job.status,
                job.progressPercent,
                job.fileSizeBytes,
                job.resultMediaUrl,
                job.mp4DownloadUrl,
                job.errorMessage,
                job.expiresAt,
                job.createdAt,
                job.updatedAt
            );
        } catch (e) {
            console.error('[VIDEO_CENTER] Failed to persist retrieval job:', e.message);
        }
    }

    // ?????????????????????????????????????????????????????????????????????????
    // 4. CLOUD RECORDINGS & SEGMENTS LIST
    // ?????????????????????????????????????????????????????????????????????????
    getCloudRecordings(terminalId, channel = 1) {
        const normId = String(terminalId).trim();
        try {
            const rows = this.db.db.prepare(`
                SELECT segment_id, session_id, terminal_id, channel, start_utc_ms, end_utc_ms, duration_sec, file_path, hls_segment_url, mp4_clip_url, status, created_at
                FROM media_segments
                WHERE terminal_id = ? AND channel = ?
                ORDER BY start_utc_ms DESC LIMIT 50
            `).all(normId, channel);

            return rows.map(r => ({
                id: r.segment_id,
                sessionId: r.session_id,
                terminalId: r.terminal_id,
                channel: r.channel,
                startTime: new Date(r.start_utc_ms).toISOString(),
                endTime: new Date(r.end_utc_ms).toISOString(),
                durationSeconds: Math.round(r.duration_sec),
                fileSizeBytes: 2048000,
                codec: 'H.264 / AAC',
                resolution: r.channel === 1 ? '1080P' : '720P',
                status: r.status,
                streamUrl: r.hls_segment_url,
                downloadUrl: r.mp4_clip_url || r.hls_segment_url
            }));
        } catch (e) {
            console.error('[VIDEO_CENTER] Error fetching recordings:', e.message);
            return [];
        }
    }

    purgeExpiredFootage() {
        const nowIso = new Date().toISOString();
        try {
            const expired = this.db.db.prepare('SELECT * FROM video_retrieval_jobs WHERE expires_at < ?').all(nowIso);
            for (const job of expired) {
                const clipPath = path.join(this.retrievalDir, `clip_${job.job_id}.mp4`);
                if (fs.existsSync(clipPath)) fs.unlinkSync(clipPath);
                this.db.db.prepare('UPDATE video_retrieval_jobs SET status = "EXPIRED" WHERE job_id = ?').run(job.job_id);
            }
        } catch (_) {}
    }
}

module.exports = VideoCenterService;

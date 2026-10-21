const path = require('path');
try { if (require('fs').existsSync(path.join(__dirname,'..','.env'))) process.loadEnvFile(path.join(__dirname,'..','.env')); } catch(e) { console.warn('Could not load .env:',e.message); }
const storageRoot=process.env.STORAGE_DIR || path.join(__dirname,'..','storage');
let ffmpegPath = null;
let ffprobePath = null;

try {
    ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
} catch (e) {
    ffmpegPath = 'ffmpeg';
}

try {
    ffprobePath = require('@ffprobe-installer/ffprobe').path;
} catch (e) {
    ffprobePath = 'ffprobe';
}

const config = {
    // Server Ports
    API_PORT: parseInt(process.env.API_PORT || process.env.PORT || '3000', 10),
    JT808_PORT: parseInt(process.env.JT808_PORT || '7800', 10),
    JT1078_PORT: parseInt(process.env.JT1078_PORT || '10780', 10),
    MEDIA_SERVER_IP: process.env.MEDIA_SERVER_IP || '100.31.90.51',

    // Timezone Profiles
    DEVICE_TIMEZONE: process.env.DEVICE_TIMEZONE || 'Asia/Shanghai', // Device sends BCD in UTC+8
    DISPLAY_TIMEZONE: process.env.DISPLAY_TIMEZONE || 'Asia/Kolkata', // Dashboard displays in IST UTC+5:30

    // Storage Paths
    ROOT_DIR: path.join(__dirname, '..'),
    STORAGE_DIR: storageRoot,
    DB_PATH: path.join(storageRoot, 'dashcam.db'),
    MEDIA_DIR: path.join(storageRoot, 'media'),
    LIVE_DIR: process.env.LIVE_MEDIA_DIR || path.join(storageRoot, 'media', 'live'),
    RECORDINGS_DIR: process.env.RECORDINGS_MEDIA_DIR || path.join(storageRoot, 'media', 'recordings'),
    SESSIONS_DIR: path.join(storageRoot, 'media', 'sessions'),
    TRIPS_DIR: path.join(storageRoot, 'trips'),
    ACCIDENTS_DIR: path.join(storageRoot, 'accidents', 'metadata'),
    FIXTURES_DIR: path.join(__dirname, '..', 'mock_data'),

    // Recording Mode & Stream Architecture Config
    // Options: 'LIVE_ONLY' (default: bounded temporary HLS, no MP4, no DB bloat) | 'LIVE_AND_RECORD'
    RECORDING_MODE: process.env.RECORDING_MODE || 'LIVE_ONLY',
    LIVE_PLAYLIST_SEGMENTS: parseInt(process.env.LIVE_PLAYLIST_SEGMENTS || '6', 10), // 5-8 playable segments in live.m3u8
    LIVE_GRACE_SEGMENTS: parseInt(process.env.LIVE_GRACE_SEGMENTS || '4', 10),       // Extra older segments retained on disk to prevent player 404s
    LIVE_RECONNECT_GRACE_SEC: parseInt(process.env.LIVE_RECONNECT_GRACE_SEC || '30', 10), // Grace period before purging disconnected session
    LIVE_CLEANUP_INACTIVE_SEC: parseInt(process.env.LIVE_CLEANUP_INACTIVE_SEC || '30', 10),
    MAX_DISK_USAGE_PERCENT: parseInt(process.env.MAX_DISK_USAGE_PERCENT || '85', 10),

    // Media & Segmentation Config
    DEFAULT_SEGMENT_DURATION_SEC: parseInt(process.env.SEGMENT_DURATION_SEC || '3', 10),
    FFMPEG_PATH: process.env.FFMPEG_PATH || ffmpegPath,
    FFPROBE_PATH: process.env.FFPROBE_PATH || ffprobePath,

    // Auth & Access Control
    ADMIN_USER: process.env.ADMIN_USER || 'admin',
    ADMIN_PASS: process.env.ADMIN_PASS || 'password',
    AUTH_SECRET: process.env.AUTH_SECRET || 'dashcam-enterprise-secret-2026',

    // Telemetry Matching Tolerance
    MAX_SYNC_TOLERANCE_MS: parseInt(process.env.MAX_SYNC_TOLERANCE_MS || '2000', 10)
};

module.exports = config;

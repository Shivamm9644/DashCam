const { execSync } = require('child_process');
const ffmpeg = require('@ffmpeg-installer/ffmpeg');
const ffprobe = require('@ffprobe-installer/ffprobe');
const { DatabaseSync } = require('node:sqlite');

console.log('=== ENVIRONMENT VERIFICATION ===');
console.log('Node Version:', process.version);
console.log('Platform    :', process.platform, process.arch);

console.log('\nFFMPEG Binary :', ffmpeg.path);
try {
    const ffVer = execSync(`"${ffmpeg.path}" -version`).toString().split('\n')[0];
    console.log('FFMPEG Version:', ffVer);
    
    // Check encoders & muxers
    const encoders = execSync(`"${ffmpeg.path}" -encoders`).toString();
    const muxers = execSync(`"${ffmpeg.path}" -muxers`).toString();
    const filters = execSync(`"${ffmpeg.path}" -filters`).toString();
    
    console.log('libx264 encoder:', encoders.includes('libx264') ? 'YES' : 'NO');
    console.log('aac encoder    :', encoders.includes('aac') ? 'YES' : 'NO');
    console.log('hls muxer      :', muxers.includes('hls') ? 'YES' : 'NO');
    console.log('mp4 muxer      :', muxers.includes('mp4') ? 'YES' : 'NO');
    console.log('drawtext filter:', filters.includes('drawtext') ? 'YES' : 'NO');
    console.log('sine filter    :', filters.includes('sine') ? 'YES' : 'NO');
} catch (e) {
    console.error('FFmpeg check failed:', e.message);
}

console.log('\nFFPROBE Binary :', ffprobe.path);
try {
    const fpVer = execSync(`"${ffprobe.path}" -version`).toString().split('\n')[0];
    console.log('FFPROBE Version:', fpVer);
} catch (e) {
    console.error('FFprobe check failed:', e.message);
}

console.log('\nSQLite Engine:');
try {
    const db = new DatabaseSync(':memory:');
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT);');
    db.prepare('INSERT INTO test (name) VALUES (?)').run('dashcam');
    const row = db.prepare('SELECT * FROM test').get();
    console.log('node:sqlite in-memory test:', row ? 'PASSED (' + JSON.stringify(row) + ')' : 'FAILED');
} catch (e) {
    console.error('SQLite check failed:', e.message);
}
console.log('================================');

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const config = require('../src/config');

const outputDir = path.join(__dirname, '..', 'mock_data', 'generated');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const durationSec = parseInt(process.argv[2] || '30', 10);
const customVideoPath = process.argv[3];
const mp4File = path.join(outputDir, `test_media_${durationSec}s.mp4`);
const h264File = path.join(outputDir, `test_video_${durationSec}s.h264`);
const aacFile = path.join(outputDir, `test_audio_${durationSec}s.aac`);

console.log(`[GenerateFixtures] Generating ${durationSec}s test media...`);

try {
    let genCmd = "";
    if (customVideoPath && fs.existsSync(customVideoPath)) {
        console.log(`[GenerateFixtures] Using custom video: ${customVideoPath}`);
        // Use custom video, scale it, and ensure we match the target bitrate and formatting.
        genCmd = `"${config.FFMPEG_PATH}" -y ` +
            `-i "${customVideoPath}" ` +
            `-vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2,fps=25" ` +
            `-c:v libx264 -pix_fmt yuv420p -profile:v baseline -g 75 -keyint_min 75 -sc_threshold 0 -bf 0 -x264-params aud=1:repeat-headers=1 -b:v 800k ` +
            `-c:a aac -b:a 64k -ar 44100 -ac 2 -t ${durationSec} ` +
            `"${mp4File}"`;
    } else {
        console.log(`[GenerateFixtures] Using fallback testsrc overlay with audio beeps...`);
        // Generate MP4 with moving testsrc, elapsed time text overlay, and audible beep markers
        // Closed GOP of 25 frames (1 second per GOP) for clean 3-second segment boundaries
        genCmd = `"${config.FFMPEG_PATH}" -y ` +
            `-f lavfi -i testsrc=duration=${durationSec}:size=640x360:rate=25 ` +
            `-f lavfi -i sine=frequency=880:beep_factor=4:duration=${durationSec} ` +
            `-vf "drawtext=text='ELAPSED %{pts\\:hms}':x=20:y=20:fontsize=24:fontcolor=white:box=1:boxcolor=black@0.6,drawtext=text='SIMULATED DASHCAM CH1':x=20:y=60:fontsize=18:fontcolor=yellow:box=1:boxcolor=black@0.6" ` +
            `-c:v libx264 -pix_fmt yuv420p -profile:v baseline -g 75 -keyint_min 75 -sc_threshold 0 -bf 0 -x264-params aud=1:repeat-headers=1 -b:v 800k ` +
            `-c:a aac -b:a 64k -ar 44100 -ac 2 ` +
            `"${mp4File}"`;
    }

    console.log(`[FFmpeg] Running video generator...`);
    execSync(genCmd, { stdio: 'inherit' });

    // Demux raw elementary streams for JT1078 simulator
    console.log(`[FFmpeg] Extracting raw Annex-B H.264...`);
    execSync(`"${config.FFMPEG_PATH}" -y -i "${mp4File}" -vcodec copy -an -bsf:v h264_mp4toannexb "${h264File}"`, { stdio: 'ignore' });

    console.log(`[FFmpeg] Extracting raw ADTS AAC...`);
    execSync(`"${config.FFMPEG_PATH}" -y -i "${mp4File}" -vn -acodec copy "${aacFile}"`, { stdio: 'ignore' });

    console.log(`[GenerateFixtures] SUCCESS! Created:`);
    console.log(` - MP4:  ${mp4File} (${fs.statSync(mp4File).size} bytes)`);
    console.log(` - H264: ${h264File} (${fs.statSync(h264File).size} bytes)`);
    console.log(` - AAC:  ${aacFile} (${fs.statSync(aacFile).size} bytes)`);

} catch (err) {
    console.error(`[GenerateFixtures] FAILED:`, err.message);
    process.exit(1);
}

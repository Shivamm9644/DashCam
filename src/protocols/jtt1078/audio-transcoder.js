// G.711 A-law (JT1078 PT 6, 8 kHz mono) -> ADTS AAC through one long-lived ffmpeg per live stream,
// because browsers cannot play G.711 in HLS. Output frames get PTS from the camera's own audio clock.
const { spawn } = require('child_process');
const config = require('../../config');

const IN_RATE = 8000;
const OUT_RATE = 16000;
const AAC_FRAME_SAMPLES = 1024;
const IN_SAMPLES_PER_FRAME = AAC_FRAME_SAMPLES * IN_RATE / OUT_RATE; // 512 A-law bytes per AAC frame

class AlawToAac {
    constructor(onFrame) {
        this.onFrame = onFrame;
        this.chunks = []; // { start: input sample index, n: samples, ts: camera ms }
        this.inSamples = 0;
        this.outFrames = 0;
        this.pending = Buffer.alloc(0);
        this.closed = false;
        this.proc = spawn(config.FFMPEG_PATH || 'ffmpeg', [
            '-hide_banner', '-loglevel', 'error',
            '-f', 'alaw', '-ar', String(IN_RATE), '-ac', '1', '-i', 'pipe:0',
            // Cabin mic is quiet (~-38 dB mean): boost, with a limiter so loud speech doesn't clip
            '-af', 'volume=10dB,alimiter=limit=0.95',
            '-c:a', 'aac', '-b:a', '32k', '-ar', String(OUT_RATE), '-ac', '1',
            '-f', 'adts', '-flush_packets', '1', 'pipe:1'
        ], { stdio: ['pipe', 'pipe', 'ignore'] });
        this.proc.stdout.on('data', d => this.onData(d));
        this.proc.stdin.on('error', () => {});
        this.proc.on('error', err => { this.closed = true; console.error('[AUDIO] ffmpeg failed:', err.message); });
        this.proc.on('exit', () => { this.closed = true; });
    }

    push(alaw, tsMs) {
        if (this.closed || !alaw.length) return;
        this.chunks.push({ start: this.inSamples, n: alaw.length, ts: Number(tsMs) });
        this.inSamples += alaw.length;
        this.proc.stdin.write(alaw);
    }

    ptsForSample(sample) {
        // Drop chunks the encoder has fully consumed
        while (this.chunks.length > 1 && this.chunks[0].start + this.chunks[0].n <= sample) this.chunks.shift();
        const c = this.chunks[0];
        if (!c) return null;
        return c.ts + Math.max(0, sample - c.start) * 1000 / IN_RATE;
    }

    onData(d) {
        this.pending = this.pending.length ? Buffer.concat([this.pending, d]) : d;
        while (this.pending.length >= 7) {
            if (this.pending[0] !== 0xff || (this.pending[1] & 0xf0) !== 0xf0) {
                const next = this.pending.indexOf(0xff, 1);
                this.pending = next === -1 ? Buffer.alloc(0) : this.pending.subarray(next);
                continue;
            }
            const len = ((this.pending[3] & 3) << 11) | (this.pending[4] << 3) | (this.pending[5] >> 5);
            if (len < 7) { this.pending = this.pending.subarray(1); continue; }
            if (this.pending.length < len) break;
            const frame = Buffer.from(this.pending.subarray(0, len));
            this.pending = this.pending.subarray(len);
            // ffmpeg's AAC encoder delays output by one frame (priming), so frame k starts at input frame k-1
            const pts = this.ptsForSample(Math.max(0, this.outFrames - 1) * IN_SAMPLES_PER_FRAME);
            this.outFrames++;
            if (pts !== null) this.onFrame(frame, pts);
        }
    }

    close() {
        if (this.closed) return;
        this.closed = true;
        try { this.proc.stdin.end(); } catch (_) {}
        setTimeout(() => { try { this.proc.kill('SIGKILL'); } catch (_) {} }, 2000).unref();
    }
}

module.exports = AlawToAac;

const net = require('net');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const binaryUtils = require('../protocols/jtt808/binary-utils');
const MediaFeeder = require('./media-feeder');

// Pseudorandom generator using Mulberry32
function mulberry32(a) {
    return function () {
        let t = a += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

class SimulatorEngine {
    constructor() {
        this.status = 'IDLE'; // IDLE, RUNNING, PAUSED, STOPPED
        this.params = null;
        this.rng = mulberry32(1078);

        // Network sockets
        this.socket808 = null;
        this.socket1078 = null;

        // Timers & State
        this.timer = null;
        this.currentSec = 0;
        this.audioIndex = 0;
        this.serialNo808 = 1;
        this.seqNo1078 = 0;
        this.lastIFrameTimeMs = 0;
        this.lastFrameTimeMs = 0;

        // Route & Scenario State
        this.routePoints = [];
        this.preloadedVideoFrames = [];
        this.preloadedAudioFrames = [];
    }

    /**
     * Start simulation using the exact application command specification.
     */
    async start(params) {
        if (this.status === 'RUNNING') {
            this.stop();
        }

        if (params.telemetryIntervalMs !== undefined && params.telemetryIntervalMs !== 1000) throw new Error('This simulator profile supports telemetryIntervalMs=1000');
        if (params.segmentSeconds !== undefined && params.segmentSeconds !== config.DEFAULT_SEGMENT_DURATION_SEC) throw new Error('segmentSeconds must match server SEGMENT_DURATION_SEC');
        if (!/^\d{12}$/.test(params.terminalId || '013812345678')) throw new Error('terminalId must be 12 digits');
        if (params.telemetryCount !== undefined && (!Number.isInteger(params.telemetryCount) || params.telemetryCount < 1 || params.telemetryCount > 10000)) throw new Error('telemetryCount must be 1..10000');
        this.params = {
            terminalId: params.terminalId || '013812345678',
            channel: params.channel !== undefined ? params.channel : 1,
            scenario: params.scenario || 'indore-demo',
            startTimeUtc: params.startTimeUtc || new Date().toISOString(),
            deviceTimeZone: params.deviceTimeZone || config.DEVICE_TIMEZONE,
            displayTimeZone: params.displayTimeZone || config.DISPLAY_TIMEZONE,
            telemetryCount: params.telemetryCount || 1000,
            telemetryIntervalMs: params.telemetryIntervalMs || 1000,
            durationSeconds: params.durationSeconds || 1000,
            segmentSeconds: params.segmentSeconds || 3,
            playbackRate: params.playbackRate || 1,
            seed: params.seed || 1078,
            videoPath: params.videoPath || null
        };

        this.rng = mulberry32(this.params.seed);
        this.currentSec = 0;
        this.audioIndex = 0;
        this.serialNo808 = 1;
        this.seqNo1078 = 0;
        this.status = 'RUNNING';

        // 1. Generate Indore route coordinates
        this.generateIndoreRoute(this.params.telemetryCount);

        // 2. Load or generate moving media test fixtures
        this.prepareMedia(this.params.durationSeconds);

        // 3. Connect JT808 TCP
        await this.connect808();

        // 4. Connect JT1078 TCP
        await this.connect1078();

        // 5. Send JT808 Registration & Authentication flow
        this.sendRegistration();
        setTimeout(() => this.sendAuthentication(), 300);

        // 6. Start synchronized telemetry & media transmission loop
        setTimeout(() => this.startTickLoop(), 600);

        console.log(`[Simulator] Started scenario '${this.params.scenario}' for terminal ${this.params.terminalId}`);
        return this.getStatus();
    }

    generateIndoreRoute(count) {
        this.routePoints = [];
        // Key landmark waypoints across Indore
        const waypoints = [
            { lat: 22.7533, lng: 75.8937 }, // Vijay Nagar Square
            { lat: 22.7420, lng: 75.8820 }, // Industry House / Palasia
            { lat: 22.7244, lng: 75.8712 }, // Regal Square / MG Road
            { lat: 22.7196, lng: 75.8577 }, // Rajwada Palace
            { lat: 22.7130, lng: 75.8450 }  // Sarafa / Jawahar Marg
        ];

        let currentLat = waypoints[0].lat;
        let currentLng = waypoints[0].lng;
        let speed = 40.0;
        let ignition = true;
        let heading = 135;

        for (let sec = 0; sec < count; sec++) {
            const progress = sec / count;
            const segmentIdx = Math.min(Math.floor(progress * (waypoints.length - 1)), waypoints.length - 2);
            const target = waypoints[segmentIdx + 1];

            let alarmSign = 0;
            let sensorGForce = null;

            // Scenario Phases:
            if (sec >= 60 && sec <= 85) {
                // Traffic Stop at Palasia Signal
                speed = 0;
                ignition = true;
            } else if (sec >= 175 && sec <= 185) {
                // Collision Event near Regal Square!
                if (sec >= 179 && sec <= 181) {
                    alarmSign = 0x20000000; // Collision Warning bit (bit 29)
                    sensorGForce = 3.8;      // Simulated G-force
                    speed = Math.max(0, speed - 25);
                } else {
                    speed = 0;
                }
            } else if (sec > 185 && sec < 220) {
                // Post-collision stopped
                speed = 0;
            } else if (sec >= 220 && sec <= 245) {
                // Driver turns ignition OFF
                speed = 0;
                ignition = false;
            } else if (sec > 245 && sec <= 260) {
                // Ignition turned back ON
                speed = 0;
                ignition = true;
            } else {
                // Moving driving phase
                ignition = true;
                const dLat = (target.lat - currentLat) * 0.05;
                const dLng = (target.lng - currentLng) * 0.05;
                currentLat += dLat;
                currentLng += dLng;

                // Speed variance (35 - 55 km/h)
                const randVariance = (this.rng() * 4 - 2);
                speed = Math.max(25, Math.min(65, 42 + randVariance));
                heading = Math.round((Math.atan2(dLng, dLat) * 180 / Math.PI + 360) % 360);
            }

            this.routePoints.push({
                offsetSec: sec,
                lat: parseFloat(currentLat.toFixed(6)),
                lng: parseFloat(currentLng.toFixed(6)),
                speed: parseFloat(speed.toFixed(1)),
                heading: heading,
                altitude: 550, // Indore elevation ~550m
                ignition: ignition,
                alarmSign: alarmSign,
                sensorGForce: sensorGForce
            });
        }
    }

    prepareMedia(durationSec) {
        const duration = this.params.videoPath ? 30 : 12;
        const genDir = path.join(__dirname, '..', '..', 'mock_data', 'generated');
        const h264File = path.join(genDir, `test_video_${duration}s.h264`);
        const aacFile = path.join(genDir, `test_audio_${duration}s.aac`);

        // Check if fixtures exist, if not generate them synchronously
        if (!fs.existsSync(h264File) || !fs.existsSync(aacFile) || this.params.videoPath) {
            const genScript = path.join(__dirname, '..', '..', 'tools', 'generate_fixtures.js');
            const { execSync } = require('child_process');
            let cmd = `node "${genScript}" ${duration}`;
            if (this.params.videoPath) {
                cmd += ` "${this.params.videoPath}"`;
            }
            execSync(cmd, { stdio: 'inherit' });
        }

        const h264Buf = fs.readFileSync(h264File);
        const aacBuf = fs.readFileSync(aacFile);

        this.preloadedVideoFrames = MediaFeeder.parseH264Nalus(h264Buf);
        this.preloadedAudioFrames = MediaFeeder.parseAacFrames(aacBuf);

        console.log(`[Simulator] Preloaded ${this.preloadedVideoFrames.length} video frames and ${this.preloadedAudioFrames.length} audio frames.`);
    }

    connect808() {
        return new Promise((resolve, reject) => {
            this.socket808 = new net.Socket();
            this.socket808.connect(config.JT808_PORT, '127.0.0.1', () => {
                console.log(`[Simulator] Connected to JT808 on 127.0.0.1:${config.JT808_PORT}`);
                resolve();
            });
            this.socket808.on('error', err => {
                console.error(`[Simulator] JT808 connection error:`, err.message);
                resolve(); // Do not crash simulation if server starts up concurrently
            });
        });
    }

    connect1078() {
        return new Promise((resolve, reject) => {
            this.socket1078 = new net.Socket();
            this.socket1078.connect(config.JT1078_PORT, '127.0.0.1', () => {
                console.log(`[Simulator] Connected to JT1078 on 127.0.0.1:${config.JT1078_PORT}`);
                resolve();
            });
            this.socket1078.on('error', err => {
                console.error(`[Simulator] JT1078 connection error:`, err.message);
                resolve();
            });
        });
    }

    sendRegistration() {
        if (!this.socket808 || this.socket808.destroyed) return;
        const regBody = Buffer.alloc(37 + 7);
        regBody.writeUInt16BE(11, 0);
        regBody.writeUInt16BE(22, 2);
        Buffer.from("12345", 'utf8').copy(regBody, 4);
        Buffer.from("MODEL-PRO           ", 'utf8').copy(regBody, 9);
        Buffer.from("CAM001 ", 'utf8').copy(regBody, 29);
        regBody.writeUInt8(1, 36);
        Buffer.from("MP09SIM1078", 'utf8').copy(regBody, 37);

        const packet = this.build808Packet(0x0100, regBody);
        this.socket808.write(packet);
    }

    sendAuthentication() {
        if (!this.socket808 || this.socket808.destroyed) return;
        const authBody = Buffer.from("AUTH12345", 'utf8');
        const packet = this.build808Packet(0x0102, authBody);
        this.socket808.write(packet);
    }

    startTickLoop() {
        if (this.timer) clearInterval(this.timer);

        const intervalMs = Math.round(this.params.telemetryIntervalMs / this.params.playbackRate);

        this.timer = setInterval(() => {
            if (this.status !== 'RUNNING') return;

            if (this.currentSec >= this.params.telemetryCount) {
                console.log(`[Simulator] Completed all ${this.params.telemetryCount} points.`);
                this.stop();
                return;
            }

            // 1. Send 0x0200 Location Packet for current second
            this.sendLocationPoint(this.currentSec);

            // 2. Send matching 1 second of JT1078 Video & Audio Frames (25 video fps + audio frames)
            this.sendMediaForSecond(this.currentSec);

            this.currentSec++;
        }, intervalMs);
    }

    sendLocationPoint(sec) {
        if (!this.socket808 || this.socket808.destroyed) return;
        const pt = this.routePoints[sec];
        if (!pt) return;

        const bodyBuf = Buffer.alloc(pt.sensorGForce ? 28 + 5 : 28);
        bodyBuf.writeUInt32BE(pt.alarmSign, 0);

        // Status
        let status = 0x00000002; // Positioning valid
        if (pt.ignition) status |= 0x00000001; // ACC ON
        bodyBuf.writeUInt32BE(status, 4);

        // Coordinates (* 10^6)
        bodyBuf.writeUInt32BE(Math.floor(pt.lat * 1000000), 8);
        bodyBuf.writeUInt32BE(Math.floor(pt.lng * 1000000), 12);

        bodyBuf.writeUInt16BE(pt.altitude, 16);
        bodyBuf.writeUInt16BE(Math.round(pt.speed * 10), 18);
        bodyBuf.writeUInt16BE(pt.heading, 20);

        // Device BCD Time in device timezone (Asia/Shanghai = UTC+8)
        const pointUtc = new Date(new Date(this.params.startTimeUtc).getTime() + sec * 1000);
        const deviceTimeMs = pointUtc.getTime() + (8 * 3600 * 1000); // UTC+8
        const devDate = new Date(deviceTimeMs);

        const yy = devDate.getUTCFullYear() % 100;
        const mm = devDate.getUTCMonth() + 1;
        const dd = devDate.getUTCDate();
        const hh = devDate.getUTCHours();
        const min = devDate.getUTCMinutes();
        const ss = devDate.getUTCSeconds();

        const bcdStr = `${String(yy).padStart(2, '0')}${String(mm).padStart(2, '0')}${String(dd).padStart(2, '0')}${String(hh).padStart(2, '0')}${String(min).padStart(2, '0')}${String(ss).padStart(2, '0')}`;
        for (let i = 0; i < 6; i++) {
            bodyBuf[22 + i] = parseInt(bcdStr.substring(i * 2, i * 2 + 2), 16);
        }

        // Optional sensor G-force TLV: ID=0xE1, Len=3, X=0, Y=0, Z=val*10
        if (pt.sensorGForce) {
            bodyBuf[28] = 0xE1;
            bodyBuf[29] = 3;
            bodyBuf[30] = 0;
            bodyBuf[31] = 0;
            bodyBuf[32] = Math.round(pt.sensorGForce * 10);
        }

        const packet = this.build808Packet(0x0200, bodyBuf);
        this.socket808.write(packet);
    }

    sendMediaForSecond(sec) {
        if (!this.socket1078 || this.socket1078.destroyed) return;
        const origin = Date.parse(this.params.startTimeUtc);
        const packets = [];
        for (let f = 0; f < 25; f++) {
            const vf = this.preloadedVideoFrames[(sec * 25 + f) % this.preloadedVideoFrames.length];
            packets.push({ payloadType: 98, dataType: vf.dataType, timestampMs: origin + sec * 1000 + f * 40, data: vf.data });
        }
        const step = this.preloadedAudioFrames[0].durationMs;
        while (this.audioIndex * step < (sec + 1) * 1000) {
            const af = this.preloadedAudioFrames[this.audioIndex % this.preloadedAudioFrames.length];
            packets.push({ payloadType: 19, dataType: 3, timestampMs: origin + Math.round(this.audioIndex * step), data: af.data });
            this.audioIndex++;
        }
        packets.sort((a, b) => a.timestampMs - b.timestampMs || a.dataType - b.dataType);
        for (const pkt of packets) this.send1078Packet(pkt);
    }

    send1078Packet({ payloadType, dataType, timestampMs, data }) {
        const isVideo = (dataType === 0 || dataType === 1 || dataType === 2);
        const MAX_BODY = 950; // MTU fragment size

        // If data fits in one packet, send Atomic (subpackage = 0)
        if (data.length <= MAX_BODY) {
            const pkt = this.build1078Packet({
                payloadType,
                dataType,
                subpackage: 0,
                timestampMs,
                body: data,
                isVideo
            });
            this.socket1078.write(pkt);
        } else {
            // Fragment large NAL units (First -> Intermediate -> Last)
            let offset = 0;
            let chunkIdx = 0;
            const totalChunks = Math.ceil(data.length / MAX_BODY);

            while (offset < data.length) {
                const chunkLen = Math.min(MAX_BODY, data.length - offset);
                const chunk = data.subarray(offset, offset + chunkLen);
                let subpackage = 3; // Intermediate
                if (chunkIdx === 0) subpackage = 1; // First
                else if (chunkIdx === totalChunks - 1) subpackage = 2; // Last

                const pkt = this.build1078Packet({
                    payloadType,
                    dataType,
                    subpackage,
                    timestampMs,
                    body: chunk,
                    isVideo
                });
                this.socket1078.write(pkt);

                offset += chunkLen;
                chunkIdx++;
            }
        }
    }

    build1078Packet({ payloadType, dataType, subpackage, timestampMs, body, isVideo }) {
        const headerLen = isVideo ? 30 : 26;
        const totalLen = headerLen + body.length;
        const buf = Buffer.alloc(totalLen);

        // Magic 0x30 0x31 0x63 0x64
        buf.writeUInt32BE(0x30316364, 0);

        // Byte 4: V=2, P=0, X=0, CC=0 (0x80)
        buf.writeUInt8(0x80, 4);

        // Byte 5: M(1), PT(7)
        const marker = (subpackage === 0 || subpackage === 2) ? 0x80 : 0x00;
        buf.writeUInt8(marker | (payloadType & 0x7F), 5);

        // Bytes 6-7: Sequence number
        buf.writeUInt16BE(this.seqNo1078, 6);
        this.seqNo1078 = (this.seqNo1078 + 1) % 65536;

        // Bytes 8-13: SIM Number (BCD)
        const simBuf = binaryUtils.stringToBcd(this.params.terminalId);
        simBuf.copy(buf, 8);

        // Byte 14: Channel
        buf.writeUInt8(this.params.channel, 14);

        // Byte 15: DataType (high 4) & Subpackage (low 4)
        buf.writeUInt8(((dataType & 0x0F) << 4) | (subpackage & 0x0F), 15);

        // Bytes 16-23: Timestamp ms (UInt64BE)
        const bigMs = BigInt(timestampMs);
        buf.writeUInt32BE(Number(bigMs >> 32n), 16);
        buf.writeUInt32BE(Number(bigMs & 0xFFFFFFFFn), 20);

        if (isVideo) {
            // Bytes 24-25: Last I-frame interval
            // Bytes 26-27: Last frame interval
            buf.writeUInt16BE(1000, 24);
            buf.writeUInt16BE(40, 26);
            buf.writeUInt16BE(body.length, 28);
            body.copy(buf, 30);
        } else {
            buf.writeUInt16BE(body.length, 24);
            body.copy(buf, 26);
        }

        return buf;
    }

    build808Packet(messageId, bodyBuf) {
        const headerBuf = Buffer.alloc(12);
        headerBuf.writeUInt16BE(messageId, 0);
        headerBuf.writeUInt16BE(bodyBuf.length, 2);

        const phoneBuf = binaryUtils.stringToBcd(this.params.terminalId);
        phoneBuf.copy(headerBuf, 4);

        headerBuf.writeUInt16BE(this.serialNo808++, 10);
        this.serialNo808 = this.serialNo808 % 65536;

        const unescapedLen = headerBuf.length + bodyBuf.length + 1;
        const unescaped = Buffer.alloc(unescapedLen);
        headerBuf.copy(unescaped, 0);
        bodyBuf.copy(unescaped, 12);

        const checksum = binaryUtils.calculateChecksum(unescaped, 0, unescapedLen - 1);
        unescaped.writeUInt8(checksum, unescapedLen - 1);

        const escaped = binaryUtils.escape(unescaped);
        const finalPacket = Buffer.alloc(escaped.length + 2);
        finalPacket[0] = 0x7E;
        escaped.copy(finalPacket, 1);
        finalPacket[finalPacket.length - 1] = 0x7E;

        return finalPacket;
    }

    pause() {
        if (this.status === 'RUNNING') {
            this.status = 'PAUSED';
            if (this.timer) clearInterval(this.timer);
            console.log(`[Simulator] Paused at second ${this.currentSec}`);
        }
        return this.getStatus();
    }

    resume() {
        if (this.status === 'PAUSED') {
            this.status = 'RUNNING';
            this.startTickLoop();
            console.log(`[Simulator] Resumed from second ${this.currentSec}`);
        }
        return this.getStatus();
    }

    stop() {
        this.status = 'STOPPED';
        if (this.timer) clearInterval(this.timer);
        if (this.socket808 && !this.socket808.destroyed) {
            this.socket808.end();
        }
        if (this.socket1078 && !this.socket1078.destroyed) {
            this.socket1078.end();
        }
        console.log(`[Simulator] Stopped at second ${this.currentSec}`);
        return this.getStatus();
    }

    getStatus() {
        return {
            status: this.status,
            currentSec: this.currentSec,
            totalSec: this.params ? this.params.telemetryCount : 0,
            terminalId: this.params ? this.params.terminalId : null,
            channel: this.params ? this.params.channel : 1,
            playbackRate: this.params ? this.params.playbackRate : 1,
            isSimulated: true
        };
    }
}

module.exports = new SimulatorEngine();

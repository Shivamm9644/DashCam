// SD card footage: list (0x9205 -> 0x1205), remote playback (0x9201) and playback control (0x9202).
// Times are the camera's local clock ("YYYY-MM-DD HH:mm:ss"); the camera stores and reports local time.
// Playback arrives on the JT1078 media port like live video, so it plays at /media/live/<id>_<ch>/live.m3u8.
const config = require('../config');
const binaryEncoder = require('../protocols/jtt808/binary-encoder');
const binaryUtils = require('../protocols/jtt808/binary-utils');

const LOCAL_TIME_RE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/;

function localToBcd(str) {
    const m = LOCAL_TIME_RE.exec(String(str || '').trim());
    if (!m) return null;
    return binaryUtils.stringToBcd(m[1].slice(2) + m[2] + m[3] + m[4] + m[5] + m[6]);
}

function channelsFrom(value) {
    return String(value || '1') === 'all' ? [1, 2] : [parseInt(value, 10) || 1];
}

function buildPlaybackRequest(terminalId, { channel, startBcd, endBcd }) {
    const ip = Buffer.from(config.MEDIA_SERVER_IP, 'utf8');
    const body = Buffer.alloc(1 + ip.length + 2 + 2 + 6 + 6 + 6);
    let o = 0;
    body.writeUInt8(ip.length, o++);
    ip.copy(body, o); o += ip.length;
    body.writeUInt16BE(config.JT1078_PORT, o); o += 2;
    body.writeUInt16BE(0, o); o += 2;          // UDP port: unused
    body.writeUInt8(channel, o++);
    body.writeUInt8(0, o++);                   // audio + video
    body.writeUInt8(0, o++);                   // main or sub stream
    body.writeUInt8(0, o++);                   // main or backup storage
    body.writeUInt8(0, o++);                   // normal playback
    body.writeUInt8(0, o++);                   // fast-forward multiple: n/a
    startBcd.copy(body, o); o += 6;
    endBcd.copy(body, o); o += 6;
    return binaryEncoder._buildPacket(0x9201, terminalId, body);
}

function buildPlaybackControl(terminalId, { channel, control }) {
    const body = Buffer.alloc(3 + 6);
    body.writeUInt8(channel, 0);
    body.writeUInt8(control, 1);               // 0 resume, 1 pause, 2 end
    body.writeUInt8(0, 2);
    return binaryEncoder._buildPacket(0x9202, terminalId, body);
}

function register(app, videoCenterService) {
    const socketFor = (terminalId) => {
        const id = String(terminalId || '').trim();
        const sock = videoCenterService.activeJT808Sockets.get(id) ||
                     videoCenterService.activeJT808Sockets.get(id.padStart(12, '0'));
        return sock && !sock.destroyed ? sock : null;
    };

    app.get('/api/video/sd-list', async (req, res) => {
        const { terminalId, channel, start, end } = req.query;
        if (!LOCAL_TIME_RE.test(start || '') || !LOCAL_TIME_RE.test(end || '')) {
            return res.status(400).json({ error: 'BAD_TIME', message: 'start/end must be "YYYY-MM-DD HH:mm:ss" (camera local time)' });
        }
        if (!socketFor(terminalId)) return res.status(409).json({ error: 'DEVICE_OFFLINE', message: 'Dashcam is not connected.' });
        // querySdCardRecordings formats Dates with UTC getters, so pass local digits as a UTC instant
        const result = await videoCenterService.querySdCardRecordings(terminalId, {
            channel: parseInt(channel || '0', 10),
            startTime: new Date(start.replace(' ', 'T') + 'Z'),
            endTime: new Date(end.replace(' ', 'T') + 'Z')
        });
        if (!result || result.source !== 'SD_CARD_DIRECT') {
            return res.status(504).json({ error: 'NO_RESPONSE', message: 'Dashcam did not answer the SD card query (0x9205).' });
        }
        return res.json({
            terminalId: result.terminalId,
            count: result.count,
            files: result.intervals.map(f => ({
                channel: f.channel,
                start: f.startTime.replace('T', ' ').replace('Z', ''),
                end: f.endTime.replace('T', ' ').replace('Z', ''),
                fileSizeBytes: f.fileSizeBytes,
                stream: f.streamType
            }))
        });
    });

    app.get('/api/video/playback-start', async (req, res) => {
        const { terminalId, channel, start, end } = req.query;
        const startBcd = localToBcd(start), endBcd = localToBcd(end);
        if (!startBcd || !endBcd) return res.status(400).json({ error: 'BAD_TIME', message: 'start/end must be "YYYY-MM-DD HH:mm:ss" (camera local time)' });
        const sock = socketFor(terminalId);
        if (!sock) return res.status(409).json({ error: 'DEVICE_OFFLINE', message: 'Dashcam is not connected.' });
        const target = sock.terminalPhone || String(terminalId);
        // Ask the SD card first so "nothing recorded then" is a clear answer, not a silent empty player
        const listed = await videoCenterService.querySdCardRecordings(terminalId, {
            channel: 0,
            startTime: new Date(start.replace(' ', 'T') + 'Z'),
            endTime: new Date(end.replace(' ', 'T') + 'Z')
        }).catch(() => null);
        if (listed && listed.source === 'SD_CARD_DIRECT' && listed.count === 0) {
            return res.status(404).json({ error: 'NO_RECORDING', message: `No recording on the SD card between ${start} and ${end}.` });
        }
        // Start every clip on a fresh media session + playlist; otherwise it is appended to the previous
        // session (kept 30s for reconnects) whose old segments are already deleted
        for (const ch of channelsFrom(channel)) {
            try { await videoCenterService.mediaHandler.closeSession(target, ch, true); } catch (_) {}
            try { videoCenterService.storageService.cleanLiveDirectory(`${target}_${ch}`); } catch (_) {}
        }
        channelsFrom(channel).forEach((ch, i) => {
            setTimeout(() => {
                if (sock.destroyed) return;
                // Close any live stream on this channel first; playback reuses the same media session key
                sock.write(binaryEncoder.buildLiveControlRequest(target, { channel: ch, controlCmd: 0, closeType: 0 }));
                sock.write(buildPlaybackRequest(target, { channel: ch, startBcd, endBcd }));
            }, i * 500);
        });
        console.log(`[PLAYBACK] 0x9201 to ${target} ch=${channel || 1} ${start} -> ${end}`);
        return res.json({
            success: true,
            terminalId: String(terminalId),
            start, end,
            streams: channelsFrom(channel).map(ch => ({ channel: ch, url: `/media/live/${terminalId}_${ch}/live.m3u8` }))
        });
    });

    app.get('/api/video/playback-stop', (req, res) => {
        const { terminalId, channel } = req.query;
        const sock = socketFor(terminalId);
        if (!sock) return res.json({ success: true, message: 'Dashcam not connected; nothing to stop.' });
        const target = sock.terminalPhone || String(terminalId);
        for (const ch of channelsFrom(channel || 'all')) sock.write(buildPlaybackControl(target, { channel: ch, control: 2 }));
        console.log(`[PLAYBACK] 0x9202 end to ${target} ch=${channel || 'all'}`);
        return res.json({ success: true });
    });
}

module.exports = { register };

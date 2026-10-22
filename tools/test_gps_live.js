const net = require('net');
const binaryUtils = require('../src/protocols/jtt808/binary-utils');

const HOST = process.argv[2] || '127.0.0.1';
const PORT = 7800;
const TERMINAL_ID = process.argv[3] || '872312858278';

// Target GPS: Indore, MP, India
const LAT = 22.719568;
const LNG = 75.857726;
const SPEED = 48.5; // km/h

function buildFrame(messageId, terminalId, serialNo, bodyHex) {
    const bodyBuf = Buffer.from(bodyHex, 'hex');
    const bodyAttr = bodyBuf.length;

    const headerBuf = Buffer.alloc(12);
    headerBuf.writeUInt16BE(messageId, 0);
    headerBuf.writeUInt16BE(bodyAttr, 2);
    
    const phoneBuf = binaryUtils.stringToBcd(terminalId);
    phoneBuf.copy(headerBuf, 4);
    headerBuf.writeUInt16BE(serialNo, 10);

    const unescapedLen = headerBuf.length + bodyBuf.length + 1;
    const unescapedBuf = Buffer.alloc(unescapedLen);
    headerBuf.copy(unescapedBuf, 0);
    bodyBuf.copy(unescapedBuf, 12);
    
    const checksum = binaryUtils.calculateChecksum(unescapedBuf, 0, unescapedLen - 1);
    unescapedBuf.writeUInt8(checksum, unescapedLen - 1);

    const escapedBody = binaryUtils.escape(unescapedBuf);
    const finalPacket = Buffer.alloc(escapedBody.length + 2);
    finalPacket[0] = 0x7E;
    escapedBody.copy(finalPacket, 1);
    finalPacket[finalPacket.length - 1] = 0x7E;

    return finalPacket;
}

function buildLocationPacket(terminalId, serialNo, lat, lng, speedKmh) {
    const buf = Buffer.alloc(28);
    buf.writeUInt32BE(0, 0); // Alarm: none
    buf.writeUInt32BE(0x00000003, 4); // Status: Bit 0=ACC ON, Bit 1=GPS 3D Fix
    buf.writeUInt32BE(Math.round(lat * 1000000), 8); // Latitude * 10^6
    buf.writeUInt32BE(Math.round(lng * 1000000), 12); // Longitude * 10^6
    buf.writeUInt16BE(540, 16); // Altitude (540m)
    buf.writeUInt16BE(Math.round(speedKmh * 10), 18); // Speed 1/10 km/h
    buf.writeUInt16BE(88, 20); // Direction (88 deg)

    // Current BCD timestamp YYMMDDHHmmss
    const now = new Date();
    const yy = String(now.getUTCFullYear()).slice(-2);
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    const hh = String(now.getUTCHours()).padStart(2, '0');
    const mi = String(now.getUTCMinutes()).padStart(2, '0');
    const ss = String(now.getUTCSeconds()).padStart(2, '0');
    Buffer.from(`${yy}${mm}${dd}${hh}${mi}${ss}`, 'hex').copy(buf, 22);

    return buildFrame(0x0200, terminalId, serialNo, buf.toString('hex'));
}

console.log(`[TEST] Connecting to JT808 Server at ${HOST}:${PORT}...`);
const client = new net.Socket();

client.connect(PORT, HOST, () => {
    console.log(`[TEST] Connected successfully to ${HOST}:${PORT}!`);
    console.log(`[TEST] Sending 0x0200 GPS Location Packet for Terminal ${TERMINAL_ID}:`);
    console.log(`       - Latitude : ${LAT}°`);
    console.log(`       - Longitude: ${LNG}°`);
    console.log(`       - Speed    : ${SPEED} km/h`);
    console.log(`       - Fix      : 3D GPS Satellite Locked`);

    const packet = buildLocationPacket(TERMINAL_ID, 101, LAT, LNG, SPEED);
    console.log(`[TEST] Packet Hex: ${packet.toString('hex').toUpperCase()}`);
    client.write(packet);
});

client.on('data', (data) => {
    console.log(`[TEST] Server Response ACK received: ${data.toString('hex').toUpperCase()}`);
    console.log(`[TEST] GPS Packet successfully accepted and processed by server!`);
    client.end();
});

client.on('close', () => {
    console.log(`[TEST] Connection closed cleanly.`);
    process.exit(0);
});

client.on('error', (err) => {
    console.error(`[TEST ERROR]: ${err.message}`);
    process.exit(1);
});

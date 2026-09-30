const binaryUtils = require('../src/protocols/jtt808/binary-utils');

function buildFrame(messageId, terminalId, serialNo, bodyHex, options = {}) {
    const bodyBuf = Buffer.from(bodyHex, 'hex');
    let bodyAttr = bodyBuf.length;
    
    if (options.encryption) {
        bodyAttr |= (options.encryption << 10);
    }
    if (options.subPackage) {
        bodyAttr |= 0x2000;
    }
    if (options.invalidBodyLength) {
        bodyAttr = 0x0001; // Intentionally wrong
    }

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
    
    let checksum = binaryUtils.calculateChecksum(unescapedBuf, 0, unescapedLen - 1);
    
    if (options.invalidChecksum) {
        checksum = (checksum + 1) % 256;
    }

    unescapedBuf.writeUInt8(checksum, unescapedLen - 1);

    const escapedBody = binaryUtils.escape(unescapedBuf);
    
    const finalPacket = Buffer.alloc(escapedBody.length + 2);
    finalPacket[0] = 0x7E;
    escapedBody.copy(finalPacket, 1);
    finalPacket[finalPacket.length - 1] = 0x7E;

    return finalPacket.toString('hex');
}

const terminalId = "013812345678";

// Body Builders
function buildRegistrationBody() {
    const buf = Buffer.alloc(37 + 7); // 37 bytes fixed + license plate
    buf.writeUInt16BE(11, 0); // Province ID
    buf.writeUInt16BE(22, 2); // City ID
    Buffer.from("12345", 'utf8').copy(buf, 4); // Manufacturer
    Buffer.from("MODEL-X             ", 'utf8').copy(buf, 9); // Terminal Model
    Buffer.from("CAM001 ", 'utf8').copy(buf, 29); // Terminal ID
    buf.writeUInt8(1, 36); // Plate Color
    Buffer.from("MP09AA1111", 'utf8').copy(buf, 37); // License Plate
    return buf.toString('hex');
}

function buildLocationBody(alarm = 0, status = 3) {
    const buf = Buffer.alloc(28);
    buf.writeUInt32BE(alarm, 0);
    buf.writeUInt32BE(status, 4);
    buf.writeUInt32BE(22719568, 8); // Lat
    buf.writeUInt32BE(75857725, 12); // Lng
    buf.writeUInt16BE(100, 16); // Alt
    buf.writeUInt16BE(685, 18); // Speed 68.5
    buf.writeUInt16BE(90, 20); // Dir
    
    const timeHex = "260919161011"; // 2026-09-19 16:10:11
    Buffer.from(timeHex, 'hex').copy(buf, 22);
    return buf.toString('hex');
}

function buildLocationWithTLV() {
    const basic = Buffer.from(buildLocationBody(), 'hex');
    const tlv = Buffer.alloc(2 + 4 + 2 + 2 + 2 + 1 + 2 + 1);
    let offset = 0;
    
    // Mileage
    tlv.writeUInt8(0x01, offset++);
    tlv.writeUInt8(4, offset++);
    tlv.writeUInt32BE(15000, offset); offset+=4;
    
    // Speed from Driving Recorder
    tlv.writeUInt8(0x03, offset++);
    tlv.writeUInt8(2, offset++);
    tlv.writeUInt16BE(685, offset); offset+=2;
    
    // Signal
    tlv.writeUInt8(0x30, offset++);
    tlv.writeUInt8(1, offset++);
    tlv.writeUInt8(5, offset++);
    
    // Satellite
    tlv.writeUInt8(0x31, offset++);
    tlv.writeUInt8(1, offset++);
    tlv.writeUInt8(12, offset++);

    return Buffer.concat([basic, tlv.subarray(0, offset)]).toString('hex');
}

// ----------------------------------------------------
// The 16 Test Cases
// ----------------------------------------------------

const packets = {
    test1_heartbeat: buildFrame(0x0002, terminalId, 1, ""),
    
    test2_registration: buildFrame(0x0100, terminalId, 2, buildRegistrationBody()),
    
    test3_authentication: buildFrame(0x0102, terminalId, 3, Buffer.from("AUTHCODE123").toString('hex')),
    
    test4_normalLocation: buildFrame(0x0200, terminalId, 4, buildLocationBody(0, 0x00000003)),
    
    test5_collisionWarning: buildFrame(0x0200, terminalId, 5, buildLocationBody(0x20000000, 0x00000003)),
    
    test6_rolloverWarning: buildFrame(0x0200, terminalId, 6, buildLocationBody(0x40000000, 0x00000003)),
    
    test7_southWestCoords: buildFrame(0x0200, terminalId, 7, buildLocationBody(0, 0x0000000F)), // Status bits 2,3 set
    
    test8_locationWithTLV: buildFrame(0x0200, terminalId, 8, buildLocationWithTLV()),
    
    test9_7e_escaping: buildFrame(0x0200, terminalId, 9, buildLocationBody().replace('00000000', '7E000000')), // Inject 7E inside body
    
    test10_7d_escaping: buildFrame(0x0200, terminalId, 10, buildLocationBody().replace('00000000', '7D000000')), // Inject 7D inside body
    
    test11_invalidChecksum: buildFrame(0x0002, terminalId, 11, "", { invalidChecksum: true }),
    
    test12_invalidBodyLength: buildFrame(0x0002, terminalId, 12, "0000", { invalidBodyLength: true }),
    
    test13_unknownMessage: buildFrame(0x0999, terminalId, 13, "FFFF"), // 0x0999 doesn't exist
    
    // We will generate raw TCP events for tests 14, 15, 16 directly in the sender script
};

module.exports = packets;

const binaryUtils = require('./binary-utils');

class BinaryEncoder {
    constructor() {
        this.serverSerial = 1;
    }

    getNextSerial() {
        const s = this.serverSerial;
        this.serverSerial = (this.serverSerial + 1) % 65536;
        return s;
    }

    /**
     * Builds the 0x8001 Platform General Response (JT/T 808-2013 Table 5)
     * @param {string} terminalId 
     * @param {number} ackSerialNo 
     * @param {number} ackMsgId 
     * @param {number} result 0: Success, 1: Failure, 2: Message Error, 3: Not Supported
     */
    buildPlatformResponse(terminalId, ackSerialNo, ackMsgId, result = 0) {
        const bodyBuf = Buffer.alloc(5);
        bodyBuf.writeUInt16BE(ackSerialNo, 0);
        bodyBuf.writeUInt16BE(ackMsgId, 2);
        bodyBuf.writeUInt8(result, 4);

        return this._buildPacket(0x8001, terminalId, bodyBuf);
    }

    /**
     * Builds the 0x8100 Terminal Registration Response (JT/T 808-2013 Table 8)
     * @param {string} terminalId 
     * @param {number} ackSerialNo 
     * @param {number} result 0: Success, 1: Vehicle already registered, 2: Vehicle not found, 3: Terminal registered, 4: Terminal not found
     * @param {string} authCode 
     */
    buildRegistrationResponse(terminalId, ackSerialNo, result = 0, authCode = '') {
        let bodyLen = 3;
        let authBuf = null;
        if (result === 0 && authCode) {
            authBuf = Buffer.from(authCode, 'utf8');
            bodyLen += authBuf.length;
        }

        const bodyBuf = Buffer.alloc(bodyLen);
        bodyBuf.writeUInt16BE(ackSerialNo, 0);
        bodyBuf.writeUInt8(result, 2);

        if (authBuf) {
            authBuf.copy(bodyBuf, 3);
        }

        return this._buildPacket(0x8100, terminalId, bodyBuf);
    }

    /**
     * Builds 0x9101 Real-time Video Transmission Request (JT/T 1078-2016 Table 5)
     */
    buildLiveStartRequest(terminalId, { serverIp = '127.0.0.1', tcpPort = 10780, udpPort = 0, channel = 1, dataType = 0, streamType = 0 }) {
        const ipBuf = Buffer.from(serverIp, 'utf8');
        const bodyLen = 1 + ipBuf.length + 2 + 2 + 1 + 1 + 1;
        const bodyBuf = Buffer.alloc(bodyLen);
        let offset = 0;

        bodyBuf.writeUInt8(ipBuf.length, offset++);
        ipBuf.copy(bodyBuf, offset);
        offset += ipBuf.length;

        bodyBuf.writeUInt16BE(tcpPort, offset); offset += 2;
        bodyBuf.writeUInt16BE(udpPort, offset); offset += 2;
        bodyBuf.writeUInt8(channel, offset++);
        bodyBuf.writeUInt8(dataType, offset++); // 0: Audio/Video, 1: Video, 2: Dual, 3: Audio
        bodyBuf.writeUInt8(streamType, offset++); // 0: Main stream, 1: Sub stream

        return this._buildPacket(0x9101, terminalId, bodyBuf);
    }

    /**
     * Builds 0x9102 Real-time Video Control (JT/T 1078-2016 Table 8)
     */
    buildLiveControlRequest(terminalId, { channel = 1, controlCmd = 0, closeType = 0, switchStream = 0 }) {
        const bodyBuf = Buffer.alloc(4);
        bodyBuf.writeUInt8(channel, 0);
        bodyBuf.writeUInt8(controlCmd, 1); // 0: Close, 1: Switch stream, 2: Pause, 3: Resume
        bodyBuf.writeUInt8(closeType, 2);  // 0: Close all, 1: Close audio, 2: Close video
        bodyBuf.writeUInt8(switchStream, 3); // 0: Main, 1: Sub

        return this._buildPacket(0x9102, terminalId, bodyBuf);
    }

    _buildPacket(messageId, terminalId, bodyBuf) {
        const headerBuf = Buffer.alloc(12);
        headerBuf.writeUInt16BE(messageId, 0);
        headerBuf.writeUInt16BE(bodyBuf.length, 2); // Body Attribute (no encryption, no sub-package)
        
        // Terminal Phone (BCD)
        const phoneBuf = binaryUtils.stringToBcd(terminalId);
        phoneBuf.copy(headerBuf, 4);

        // Server Message Serial
        headerBuf.writeUInt16BE(this.getNextSerial(), 10);

        // Unescaped packet
        const unescapedLen = headerBuf.length + bodyBuf.length + 1; // +1 for checksum
        const unescapedBuf = Buffer.alloc(unescapedLen);
        
        headerBuf.copy(unescapedBuf, 0);
        bodyBuf.copy(unescapedBuf, 12);
        
        // Calculate Checksum
        const checksum = binaryUtils.calculateChecksum(unescapedBuf, 0, unescapedLen - 1);
        unescapedBuf.writeUInt8(checksum, unescapedLen - 1);

        // Escape and add 0x7E flags
        const escapedBody = binaryUtils.escape(unescapedBuf);
        
        const finalPacket = Buffer.alloc(escapedBody.length + 2);
        finalPacket[0] = 0x7E;
        escapedBody.copy(finalPacket, 1);
        finalPacket[finalPacket.length - 1] = 0x7E;

        return finalPacket;
    }
}

module.exports = new BinaryEncoder();

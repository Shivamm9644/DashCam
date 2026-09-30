const binaryUtils = require('../jtt808/binary-utils');

/**
 * JT/T 1078-2016 RTP Media Packet Parser
 * Conforms to JT/T 1078-2016 Section 5.3 specifications:
 * - Magic identifier: 0x30 0x31 0x63 0x64
 * - Type-dependent header layout:
 *   - Video packets (DataType 0, 1, 2): 30-byte header (includes last I-frame & last frame intervals)
 *   - Audio/Transparent packets (DataType 3, 4): 26-byte header (no interval fields)
 * - Standard JT/T 1078-2016 Payload Types (Table 13):
 *   - 98: H.264 video
 *   - 99: H.265 video
 *   - 19: AAC audio (Standard JT/T 1078-2016 ADTS)
 *   - 6:  G.711A audio
 *   - 7:  G.711U audio
 *   - 8:  G.726 audio
 */
class MediaParser {
    constructor() {
        this.MAGIC = 0x30316364; // "01cd"
    }

    /**
     * Parse a single complete JT1078 packet from a buffer.
     * Returns { packet, bytesConsumed } or null if incomplete.
     * @param {Buffer} buffer 
     */
    parsePacket(buffer) {
        if (!buffer || buffer.length < 18) {
            return null; // Not enough data for even an audio header
        }

        // Verify Magic 0x30 0x31 0x63 0x64
        const magic = buffer.readUInt32BE(0);
        if (magic !== this.MAGIC) {
            // Locate magic in buffer to recover from stream misalignment
            const magicIndex = this.findMagic(buffer);
            if (magicIndex === -1) {
                return { error: 'NO_MAGIC', discardBytes: Math.max(1, buffer.length - 3) };
            }
            return { error: 'RESYNC', discardBytes: magicIndex };
        }

        // Byte 4: V(2), P(1), X(1), CC(4)
        const b4 = buffer.readUInt8(4);
        const version = (b4 >> 6) & 0x03;
        const padding = (b4 >> 5) & 0x01;
        const extension = (b4 >> 4) & 0x01;
        const csrcCount = b4 & 0x0F;

        // Byte 5: M(1), PT(7)
        const b5 = buffer.readUInt8(5);
        const marker = (b5 >> 7) & 0x01;
        const payloadType = b5 & 0x7F;

        // Bytes 6-7: Sequence number
        const sequenceNo = buffer.readUInt16BE(6);

        // Bytes 8-13: SIM/Terminal Phone BCD[6]
        const simBuf = buffer.subarray(8, 14);
        const simNumber = binaryUtils.bcdToString(simBuf);

        // Byte 14: Channel number
        const channel = buffer.readUInt8(14);

        // Byte 15: DataType (high 4) & Subpackage (low 4)
        const b15 = buffer.readUInt8(15);
        const dataType = (b15 >> 4) & 0x0F; // 0=I, 1=P, 2=B, 3=Audio, 4=Transparent
        const subpackage = b15 & 0x0F;      // 0=Atomic, 1=First, 2=Last, 3=Intermediate

        if (dataType !== 4 && buffer.length < 26) return null;
        // Bytes 16-23: 8-byte millisecond timestamp (BigInt to handle 64-bit ms)
        const timestampHigh = dataType === 4 ? 0 : buffer.readUInt32BE(16);
        const timestampLow = dataType === 4 ? 0 : buffer.readUInt32BE(20);
        const timestampMs = (BigInt(timestampHigh) << 32n) | BigInt(timestampLow);

        let headerLength = 26;
        let lastIFrameInterval = null;
        let lastFrameInterval = null;
        let bodyLength = 0;

        // Check data type for variable header layout
        const isVideo = (dataType === 0 || dataType === 1 || dataType === 2);

        if (isVideo) {
            headerLength = 30;
            if (buffer.length < headerLength) {
                return null; // Need more data for full video header
            }
            lastIFrameInterval = buffer.readUInt16BE(24);
            lastFrameInterval = buffer.readUInt16BE(26);
            bodyLength = buffer.readUInt16BE(28);
        } else if (dataType === 4) {
            headerLength = 18;
            bodyLength = buffer.readUInt16BE(16);
        } else {
            // Audio
            headerLength = 26;
            bodyLength = buffer.readUInt16BE(24);
        }

        const totalLength = headerLength + bodyLength;
        if (buffer.length < totalLength) {
            return null; // Incomplete packet, wait for TCP stream
        }

        const body = buffer.subarray(headerLength, totalLength);

        const packet = {
            version,
            padding,
            extension,
            csrcCount,
            marker,
            payloadType,
            codecName: this.getCodecName(payloadType),
            sequenceNo,
            simNumber,
            channel,
            dataType,
            dataTypeName: this.getDataTypeName(dataType),
            subpackage,
            subpackageName: this.getSubpackageName(subpackage),
            timestampMs: Number(timestampMs),
            isVideo,
            isAudio: dataType === 3,
            lastIFrameInterval,
            lastFrameInterval,
            bodyLength,
            body
        };

        return { packet, bytesConsumed: totalLength };
    }

    findMagic(buffer) {
        for (let i = 0; i <= buffer.length - 4; i++) {
            if (buffer[i] === 0x30 && buffer[i+1] === 0x31 && buffer[i+2] === 0x63 && buffer[i+3] === 0x64) {
                return i;
            }
        }
        return -1;
    }

    getCodecName(pt) {
        const standardMappings = {
            98: 'H.264',
            99: 'H.265',
            19: 'AAC',   // Standard JT/T 1078-2016
            1:  'G.721',
            6:  'G.711A',
            7:  'G.711U',
            8:  'G.726'
        };
        return standardMappings[pt] || `Vendor-PT-${pt}`;
    }

    getDataTypeName(dt) {
        const types = {
            0: 'I-Frame (Keyframe)',
            1: 'P-Frame',
            2: 'B-Frame',
            3: 'Audio Frame',
            4: 'Transparent Data'
        };
        return types[dt] || 'Unknown';
    }

    getSubpackageName(sp) {
        const sub = {
            0: 'Atomic (Complete)',
            1: 'First Fragment',
            2: 'Last Fragment',
            3: 'Intermediate Fragment'
        };
        return sub[sp] || 'Unknown';
    }
}

module.exports = new MediaParser();

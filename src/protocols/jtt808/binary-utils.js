/**
 * JT/T 808 Binary Utilities
 */

class BinaryUtils {
    /**
     * Calculates XOR Checksum for a buffer
     * @param {Buffer} buffer 
     * @param {number} start 
     * @param {number} end 
     * @returns {number}
     */
    calculateChecksum(buffer, start, end) {
        let checksum = 0;
        for (let i = start; i < end; i++) {
            checksum ^= buffer[i];
        }
        return checksum;
    }

    /**
     * Unescapes JT/T 808 payload (0x7D 0x02 -> 0x7E, 0x7D 0x01 -> 0x7D)
     * @param {Buffer} buffer 
     * @returns {Buffer}
     */
    unescape(buffer) {
        const result = [];
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === 0x7D) {
                if (buffer[i + 1] === 0x02) {
                    result.push(0x7E);
                    i++;
                } else if (buffer[i + 1] === 0x01) {
                    result.push(0x7D);
                    i++;
                } else {
                    result.push(buffer[i]); // Should not happen in strict 808
                }
            } else {
                result.push(buffer[i]);
            }
        }
        return Buffer.from(result);
    }

    /**
     * Escapes JT/T 808 payload (0x7E -> 0x7D 0x02, 0x7D -> 0x7D 0x01)
     * @param {Buffer} buffer 
     * @returns {Buffer}
     */
    escape(buffer) {
        const result = [];
        for (let i = 0; i < buffer.length; i++) {
            if (buffer[i] === 0x7E) {
                result.push(0x7D, 0x02);
            } else if (buffer[i] === 0x7D) {
                result.push(0x7D, 0x01);
            } else {
                result.push(buffer[i]);
            }
        }
        return Buffer.from(result);
    }

    /**
     * Converts a 12-digit string to 6-byte BCD buffer
     * @param {string} str (e.g., '013812345678')
     * @returns {Buffer}
     */
    stringToBcd(str) {
        if (str.length % 2 !== 0) str = '0' + str;
        const buf = Buffer.alloc(str.length / 2);
        for (let i = 0; i < str.length; i += 2) {
            buf[i / 2] = parseInt(str.substring(i, i + 2), 16);
        }
        return buf;
    }

    /**
     * Converts BCD buffer to string
     * @param {Buffer} buf 
     * @returns {string}
     */
    bcdToString(buf) {
        let str = '';
        for (let i = 0; i < buf.length; i++) {
            let hex = buf[i].toString(16);
            if (hex.length === 1) hex = '0' + hex;
            str += hex;
        }
        return str;
    }
}

module.exports = new BinaryUtils();

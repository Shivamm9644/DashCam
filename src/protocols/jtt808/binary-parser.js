const binaryUtils = require('./binary-utils');
const NormalizedTelemetry = require('../../models/telemetry');
const config = require('../../config');

class BinaryParser {
    /**
     * Parses a raw JT/T 808 buffer.
     * @param {Buffer} rawData 
     * @param {Object} options Optional options { deviceTimeZone }
     */
    parse(rawData, options = {}) {
        try {
            if (!rawData || rawData.length < 15) return null;
            if (rawData[0] !== 0x7E || rawData[rawData.length - 1] !== 0x7E) return null;

            const payload = rawData.subarray(1, rawData.length - 1);
            const unescaped = binaryUtils.unescape(payload);

            if (unescaped.length < 13) return null; // Minimum header (12) + checksum (1)

            const receivedChecksum = unescaped[unescaped.length - 1];
            const calculatedChecksum = binaryUtils.calculateChecksum(unescaped, 0, unescaped.length - 1);
            const checksumValid = receivedChecksum === calculatedChecksum;

            // Extract Header Fields
            const messageId = unescaped.readUInt16BE(0);
            const msgBodyAttr = unescaped.readUInt16BE(2);
            
            const declaredBodyLength = msgBodyAttr & 0x03FF; // bits 0-9
            const encryptionBits = (msgBodyAttr >> 10) & 0x07; // bits 10-12
            const subPackage = (msgBodyAttr & 0x2000) !== 0; // bit 13

            const terminalPhoneBuf = unescaped.subarray(4, 10);
            const terminalPhone = binaryUtils.bcdToString(terminalPhoneBuf);
            
            const serialNo = unescaped.readUInt16BE(10);

            let bodyOffset = 12;
            let totalPackages = 0;
            let packageNumber = 0;

            if (subPackage) {
                if (unescaped.length < 17) return null;
                totalPackages = unescaped.readUInt16BE(12);
                packageNumber = unescaped.readUInt16BE(14);
                bodyOffset = 16;
            }

            const actualBodyLength = unescaped.length - bodyOffset - 1; // -1 for checksum

            const frame = {
                rawHex: rawData.toString('hex').toUpperCase(),
                messageId,
                messageName: this.getMessageName(messageId),
                bodyAttributeRaw: msgBodyAttr,
                declaredBodyLength,
                actualBodyLength,
                encryptionType: encryptionBits,
                subPackage,
                terminalPhone,
                serialNo,
                checksumValid,
                receivedChecksum,
                calculatedChecksum,
                totalPackages,
                packageNumber
            };

            if (!checksumValid) {
                return { frame, error: 'CHECKSUM_INVALID', checksumValid: false };
            }

            if (declaredBodyLength !== actualBodyLength) {
                return { frame, error: 'BODY_LENGTH_MISMATCH', lengthValid: false };
            }

            if (encryptionBits !== 0) {
                return { frame, error: 'ENCRYPTION_UNSUPPORTED' };
            }

            if (subPackage) {
                return { frame, error: 'SUBPACKAGE_NOT_IMPLEMENTED' };
            }

            const msgBody = unescaped.subarray(bodyOffset, unescaped.length - 1);
            let decoded = null;
            let telemetry = null;
            const deviceTz = options.deviceTimeZone || config.DEVICE_TIMEZONE;

            switch (messageId) {
                case 0x0002: // Heartbeat
                    decoded = this.parseHeartbeat();
                    break;
                case 0x0100: // Registration
                    decoded = this.parseRegistration(msgBody);
                    break;
                case 0x0102: // Authentication
                    decoded = this.parseAuthentication(msgBody);
                    break;
                case 0x0200: // Location Report
                    const res = this.parseLocationReport(terminalPhone, serialNo, msgBody, deviceTz);
                    if (res) {
                        decoded = res.decoded;
                        telemetry = res.telemetry;
                    } else {
                        return { frame, error: 'LOCATION_BODY_INVALID' };
                    }
                    break;
                default:
                    decoded = { rawHex: msgBody.toString('hex') };
                    break;
            }

            return { frame, decoded, telemetry };

        } catch (err) {
            console.error(`[BinaryParser Error] ${err.message}`);
            return null;
        }
    }

    getMessageName(id) {
        const names = {
            0x0001: 'Terminal General Response',
            0x8001: 'Platform General Response',
            0x0002: 'Terminal Heartbeat',
            0x0100: 'Terminal Registration',
            0x8100: 'Terminal Registration Response',
            0x0003: 'Terminal Logout',
            0x0102: 'Terminal Authentication',
            0x0200: 'Location Information Report',
            0x0704: 'Positioning Data Batch Upload',
            0x0705: 'CAN Bus Data Upload',
            0x0800: 'Multimedia Event Upload',
            0x0801: 'Multimedia Data Upload',
            0x9101: 'Real-time Video Transmission Request',
            0x9102: 'Real-time Video Control'
        };
        return names[id] || 'Unknown Message';
    }

    parseHeartbeat() {
        return { type: 'heartbeat' };
    }

    parseAuthentication(body) {
        if (!body || body.length === 0) {
            return { type: 'authentication', valid: false, authCode: '' };
        }
        const authCode = body.toString('utf8').replace(/\0/g, '').trim();
        return { type: 'authentication', valid: authCode.length > 0, authCode };
    }

    parseRegistration(body) {
        if (!body || body.length < 37) {
            return null;
        }

        const provinceId = body.readUInt16BE(0);
        const cityId = body.readUInt16BE(2);
        const manufacturerId = body.subarray(4, 9).toString('utf8').replace(/\0/g, '').trim();
        const terminalModel = body.subarray(9, 29).toString('utf8').replace(/\0/g, '').trim();
        const terminalId = body.subarray(29, 36).toString('utf8').replace(/\0/g, '').trim();
        const plateColor = body.readUInt8(36);
        const licensePlate = body.subarray(37).toString('utf8').replace(/\0/g, '').trim();

        return {
            type: 'registration',
            provinceId,
            cityId,
            manufacturerId,
            terminalModel,
            terminalId,
            plateColor,
            licensePlate
        };
    }

    parseLocationReport(terminalPhone, serialNo, body, deviceTz) {
        if (!body || body.length < 28) {
            return null;
        }

        const alarmSign = body.readUInt32BE(0);
        const status = body.readUInt32BE(4);
        
        let latRaw = body.readUInt32BE(8);
        let lngRaw = body.readUInt32BE(12);
        
        const altitude = body.readUInt16BE(16);
        const speedRaw = body.readUInt16BE(18);
        const direction = body.readUInt16BE(20);

        const timeBuf = body.subarray(22, 28);
        const timeStr = binaryUtils.bcdToString(timeBuf);

        // Convert device clock (in device timezone profile) to UTC ISO
        const { isoUtc, rawTimeStr } = this.convertDeviceTimeToUtc(timeStr, deviceTz);

        // Status Bits (JT/T 808-2013 Table 25)
        const accOn = (status & 0x01) !== 0;        // Bit 0: ACC 0=Off, 1=On
        const positioning = (status & 0x02) !== 0;  // Bit 1: 0=Not positioning, 1=Positioning
        const isSouth = (status & 0x04) !== 0;      // Bit 2: 0=North, 1=South
        const isWest = (status & 0x08) !== 0;       // Bit 3: 0=East, 1=West

        let latitude = latRaw / 1000000;
        let longitude = lngRaw / 1000000;

        if (isSouth) latitude = -latitude;
        if (isWest) longitude = -longitude;

        const speed = speedRaw / 10;

        // Alarm Bits (JT/T 808-2013 Table 24)
        const emergencyAlarm = (alarmSign & 0x00000001) !== 0;       // Bit 0: Emergency SOS
        const overSpeedAlarm = (alarmSign & 0x00000002) !== 0;       // Bit 1: Overspeed
        const collisionWarning = (alarmSign & 0x20000000) !== 0;     // Bit 29: Collision warning
        const rolloverWarning = (alarmSign & 0x40000000) !== 0;      // Bit 30: Rollover warning

        // Additional TLVs
        let offset = 28;
        let sensorGForce = null;

        while (offset + 2 <= body.length) {
            const id = body.readUInt8(offset);
            const length = body.readUInt8(offset + 1);
            if (offset + 2 + length > body.length) break;
            
            const valueBuf = body.subarray(offset + 2, offset + 2 + length);
            // Custom or vendor TLV for G-force sensor: 0xE1 (3 bytes: X, Y, Z in 1/10 G)
            if (id === 0xE1 && length === 3) {
                const z = valueBuf.readInt8(2) / 10;
                sensorGForce = Math.abs(z);
            }
            offset += 2 + length;
        }

        let eventType = 'NORMAL';
        let alarmType = null;

        if (collisionWarning) {
            eventType = 'ACCIDENT';
            alarmType = 'COLLISION_WARNING';
        } else if (rolloverWarning) {
            eventType = 'ACCIDENT';
            alarmType = 'ROLLOVER_WARNING';
        } else if (emergencyAlarm) {
            eventType = 'ACCIDENT';
            alarmType = 'EMERGENCY_SOS';
        } else if (overSpeedAlarm) {
            alarmType = 'OVERSPEED';
        }

        const decoded = {
            alarmSign, status, latitude, longitude, altitude, speed, direction,
            rawTime: rawTimeStr,
            isoUtcTime: isoUtc,
            emergencyAlarm, overSpeedAlarm, collisionWarning, rolloverWarning,
            accOn, positioning, isSouth, isWest
        };

        const telemetry = new NormalizedTelemetry({
            terminalId: terminalPhone,
            vehicleId: `VEH-${terminalPhone.slice(-4)}`,
            latitude: latitude,
            longitude: longitude,
            speed: speed,
            heading: direction,
            altitude: altitude,
            ignition: accOn,
            timestamp: isoUtc,
            alarmType: alarmType,
            eventType: eventType,
            impactGForce: sensorGForce, // Null unless actual sensor measurement is provided
            _sourceSerialNo: serialNo
        });

        return { decoded, telemetry };
    }

    convertDeviceTimeToUtc(bcdStr, timezone) {
        // bcdStr is YYMMDDHHmmss, e.g. "260921093000"
        if (!bcdStr || bcdStr.length !== 12) {
            const now = new Date();
            return { isoUtc: now.toISOString(), rawTimeStr: '' };
        }

        const yy = parseInt(bcdStr.substring(0, 2), 10) + 2000;
        const mm = parseInt(bcdStr.substring(2, 4), 10) - 1; // 0-indexed
        const dd = parseInt(bcdStr.substring(4, 6), 10);
        const hh = parseInt(bcdStr.substring(6, 8), 10);
        const min = parseInt(bcdStr.substring(8, 10), 10);
        const ss = parseInt(bcdStr.substring(10, 12), 10);

        const rawTimeStr = `${yy}-${String(mm + 1).padStart(2, '0')}-${String(dd).padStart(2, '0')} ${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;

        // Default: Asia/Shanghai is UTC+8
        let offsetHours = 8;
        if (timezone === 'UTC' || timezone === 'GMT') {
            offsetHours = 0;
        } else if (timezone === 'Asia/Kolkata') {
            offsetHours = 5.5;
        }

        // Compute UTC epoch milliseconds
        const localEpoch = Date.UTC(yy, mm, dd, hh, min, ss);
        const utcEpoch = localEpoch - (offsetHours * 3600 * 1000);
        const isoUtc = new Date(utcEpoch).toISOString();

        return { isoUtc, rawTimeStr };
    }
}

module.exports = new BinaryParser();

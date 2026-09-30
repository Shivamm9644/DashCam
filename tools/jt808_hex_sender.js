const net = require('net');
const testPackets = require('../test/jt808-test-packets');
const externalPackets = require('../test/jt808-external-samples');
const readline = require('readline');

const HOST = '127.0.0.1';
const PORT = 7800;

const mode = process.argv[2] || 'internal'; // 'internal', 'external', 'manual'

console.log(`============================================================`);
console.log(`JT/T 808-2013 TCP TEST SENDER (${mode.toUpperCase()} MODE)`);
console.log(`============================================================`);
console.log(`Target: ${HOST}:${PORT}\n`);

const client = new net.Socket();

client.connect(PORT, HOST, () => {
    console.log(`[CONNECTED]\n`);
    if (mode === 'manual') {
        runManualMode();
    } else if (mode === 'external') {
        runExternalTests();
    } else {
        runInternalTests();
    }
});

client.on('data', (data) => {
    console.log(`\n[RECEIVE RESPONSE]`);
    console.log(`Bytes : ${data.length}`);
    const hex = data.toString('hex').toUpperCase();
    console.log(`HEX   : ${hex}\n`);
    decodeResponse(data);
    
    if (mode === 'manual') {
        runManualMode(); // Ask for next input
    }
});

client.on('close', () => {
    console.log('[CONNECTION CLOSED]');
    process.exit(0);
});

client.on('error', (err) => {
    console.log(`[ERROR] ${err.message}`);
    process.exit(1);
});

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sendHex(hexStr, desc) {
    const cleanHex = hexStr.replace(/\s+/g, '');
    const buffer = Buffer.from(cleanHex, 'hex');
    console.log(`\n============================================================`);
    console.log(`TEST: ${desc}`);
    console.log(`============================================================`);
    console.log(`Input HEX : ${cleanHex}`);
    console.log(`Bytes Sent: ${buffer.length}`);
    client.write(buffer);
}

function decodeResponse(data) {
    try {
        if (data.length < 15 || data[0] !== 0x7E) return;
        const payload = data.subarray(1, data.length - 1); // Not unescaping for simple validation since response body is usually short and doesn't contain 7e/7d
        const messageId = payload.readUInt16BE(0);
        
        console.log(`Response Message ID : 0x${messageId.toString(16).padStart(4, '0').toUpperCase()}`);
        
        if (messageId === 0x8001) {
            const responseSerial = payload.readUInt16BE(12);
            const responseTo = payload.readUInt16BE(14);
            const result = payload.readUInt8(16);
            console.log(`Response Serial     : ${responseSerial}`);
            console.log(`Response To         : 0x${responseTo.toString(16).padStart(4, '0').toUpperCase()}`);
            console.log(`Result              : ${result} / ${result === 0 ? 'SUCCESS' : 'FAILED'}`);
        } else if (messageId === 0x8100) {
            const responseSerial = payload.readUInt16BE(12);
            const result = payload.readUInt8(14);
            console.log(`Response Serial     : ${responseSerial}`);
            console.log(`Result              : ${result} / ${result === 0 ? 'SUCCESS' : 'FAILED'}`);
            if (result === 0 && payload.length > 15) {
                const authCode = payload.subarray(15, payload.length - 1).toString('utf8');
                console.log(`Authentication Code : ${authCode}`);
            }
        }
    } catch (e) {
        console.log(`Failed to decode response: ${e.message}`);
    }
}

function runManualMode() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    rl.question('Paste JT/T 808 HEX:\n> ', (answer) => {
        rl.close();
        const cleanHex = answer.replace(/\s+/g, '').replace(/\r?\n|\r/g, '');
        
        if (!/^[0-9A-Fa-f]+$/.test(cleanHex)) {
            console.log(`HEX Validation: INVALID CHARACTERS`);
            return runManualMode();
        }
        if (cleanHex.length % 2 !== 0) {
            console.log(`HEX Validation: INVALID LENGTH (ODD)`);
            return runManualMode();
        }
        
        console.log(`HEX Validation:\nVALID`);
        const buffer = Buffer.from(cleanHex, 'hex');
        console.log(`Binary Length:\n${buffer.length} bytes\n`);
        console.log(`Sending...\n`);
        client.write(buffer);
    });
}

async function runExternalTests() {
    for (let i = 0; i < externalPackets.length; i++) {
        const sample = externalPackets[i];
        console.log(`\n============================================================`);
        console.log(`EXTERNAL JT/T 808 TEST #${i + 1}`);
        console.log(`============================================================`);
        console.log(`Source:\n${sample.source}\n`);
        console.log(`Input HEX:\n${sample.hex}\n`);
        console.log(`Sending to:\n${HOST}:${PORT}\n`);
        
        const cleanHex = sample.hex.replace(/\s+/g, '');
        const buffer = Buffer.from(cleanHex, 'hex');
        console.log(`Bytes Sent:\n${buffer.length}\n`);
        
        client.write(buffer);
        await sleep(1500); // Wait for response and logging
    }
    
    console.log(`\n============================================================`);
    console.log(`EXTERNAL TESTS COMPLETED`);
    console.log(`Check the server terminal to verify output tables.`);
    console.log(`============================================================\n`);
    client.destroy();
}

async function runInternalTests() {
    // Basic Tests
    sendHex(testPackets.test1_heartbeat, "1. 0x0002 Heartbeat");
    await sleep(500);

    sendHex(testPackets.test2_registration, "2. 0x0100 Registration");
    await sleep(500);

    sendHex(testPackets.test3_authentication, "3. 0x0102 Authentication");
    await sleep(500);

    sendHex(testPackets.test4_normalLocation, "4. 0x0200 Normal Location");
    await sleep(500);

    sendHex(testPackets.test5_collisionWarning, "5. 0x0200 Collision Warning");
    await sleep(500);

    sendHex(testPackets.test6_rolloverWarning, "6. 0x0200 Rollover Warning");
    await sleep(500);

    sendHex(testPackets.test7_southWestCoords, "7. 0x0200 South/West Coordinates");
    await sleep(500);

    sendHex(testPackets.test8_locationWithTLV, "8. 0x0200 With Additional TLVs");
    await sleep(500);

    sendHex(testPackets.test9_7e_escaping, "9. 0x7E Escaping Test");
    await sleep(500);

    sendHex(testPackets.test10_7d_escaping, "10. 0x7D Escaping Test");
    await sleep(500);

    sendHex(testPackets.test11_invalidChecksum, "11. Invalid Checksum");
    await sleep(500);

    sendHex(testPackets.test12_invalidBodyLength, "12. Invalid Body Length");
    await sleep(500);

    sendHex(testPackets.test13_unknownMessage, "13. Unknown/Unsupported Message ID");
    await sleep(1000);

    // Advanced TCP Chunking Tests
    console.log(`\n============================================================`);
    console.log(`TEST: 14. Split TCP Packet`);
    console.log(`============================================================`);
    const splitPacket = Buffer.from(testPackets.test1_heartbeat, 'hex');
    const chunk1 = splitPacket.subarray(0, 5);
    const chunk2 = splitPacket.subarray(5);
    console.log(`Sending Chunk 1: ${chunk1.toString('hex')}`);
    client.write(chunk1);
    await sleep(500); // Server shouldn't process yet
    console.log(`Sending Chunk 2: ${chunk2.toString('hex')}`);
    client.write(chunk2);
    await sleep(1000);

    console.log(`\n============================================================`);
    console.log(`TEST: 15. Multiple Packets in One Chunk`);
    console.log(`============================================================`);
    const multiPacketBuf = Buffer.concat([
        Buffer.from(testPackets.test1_heartbeat, 'hex'),
        Buffer.from(testPackets.test4_normalLocation, 'hex')
    ]);
    console.log(`Sending combined HEX: ${multiPacketBuf.toString('hex')}`);
    client.write(multiPacketBuf);
    await sleep(1000);

    console.log(`\n============================================================`);
    console.log(`TEST: 16. Complete + Partial Packet with trailing garbage and consecutive 7E7E`);
    console.log(`============================================================`);
    const authBuf = Buffer.from(testPackets.test3_authentication, 'hex');
    const halfAuth = authBuf.subarray(0, Math.floor(authBuf.length / 2));
    const crazyBuf = Buffer.concat([
        Buffer.from('7e7e', 'hex'), 
        Buffer.from(testPackets.test1_heartbeat, 'hex'),
        halfAuth
    ]);
    console.log(`Sending crazy HEX: ${crazyBuf.toString('hex')}`);
    client.write(crazyBuf);
    await sleep(1000);

    console.log(`Sending remaining half of Auth: ${authBuf.subarray(Math.floor(authBuf.length / 2)).toString('hex')}`);
    client.write(authBuf.subarray(Math.floor(authBuf.length / 2)));
    await sleep(1000);

    console.log(`\n============================================================`);
    console.log(`ALL TESTS COMPLETED SUCCESSFULLY`);
    console.log(`============================================================\n`);
    
    client.destroy();
}

module.exports = [
    {
        name: "External Sample 1: Real Location Report 0x0200",
        source: "Internet Example (JT/T 808-2013)",
        hex: "7E0200002401391234567800010000000000000002016C08300858630000640000181015101010010400000064357E",
        expected: {
            messageId: "0x0200",
            terminal: "013912345678",
            latitude: 23.856944,  // roughly 0x016c0830 / 1M
            longitude: 140.010368, // roughly 0x08586300 / 1M
            speed: 0
        }
    },
    {
        name: "External Sample 2: Registration 0x0100",
        source: "Vendor Manual",
        hex: "7E010000210138123456780001000C001531323334354D4F44454C31202020202020202020202020202043414D31200130303030303030E57E",
        expected: {
            messageId: "0x0100",
            terminal: "013812345678"
        }
    },
    {
        name: "External Sample 3: Heartbeat 0x0002",
        source: "Vendor Manual",
        hex: "7E000200000138123456780001327E",
        expected: {
            messageId: "0x0002",
            terminal: "013812345678"
        }
    },
    {
        name: "External Sample 4: Invalid Checksum",
        source: "Constructed Corrupted Packet",
        hex: "7E000200000138123456780001FF7E",
        expected: null
    },
    {
        name: "External Sample 5: JT/T 808-2019 Format Header (Expected Unsupported/Mismatch)",
        source: "JT/T 808-2019 Internet Example",
        hex: "7E0200401C010000000001381234567800000000000000000000000000000000000000000000000000000000000000257E",
        expected: null // 2019 header has extra version flags, will likely fail our 2013 checks or misalign body
    }
];

const path = require('path');
const fs = require('fs');

// Load .env file natively if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (_) {}
}

const config = {
  // Network Ports
  PORT: parseInt(process.env.PORT || '3001', 10),
  JT808_PORT: parseInt(process.env.JT808_PORT || '7800', 10),
  JT1078_PORT: parseInt(process.env.JT1078_PORT || '10780', 10),
  GATEWAY_HOST: process.env.GATEWAY_HOST || '127.0.0.1',
  
  // Security (Rotated RFC 7519 HMAC-SHA256 Secret)
  JWT_SECRET: process.env.JWT_SECRET || 'c7e46f91d0834ba701a938c645b2069bf17b8f0426189ea5a9e701dc8a24bc19',
  TOKEN_EXPIRY: process.env.TOKEN_EXPIRY || '24h',
  MEDIA_TOKEN_EXPIRY_SECONDS: parseInt(process.env.MEDIA_TOKEN_EXPIRY_SECONDS || '300', 10), // 5 minutes max
  
  // Timezone Handling
  DEVICE_TIMEZONE: 'Asia/Shanghai', // Devices transmit BCD in UTC+8
  DISPLAY_TIMEZONE: 'Asia/Kolkata',  // Dashboard displays in IST UTC+5:30
  
  // Commercial Plan Defaults (INR 500/year tier - SD-Card-First Architecture)
  ANNUAL_FEE_INR: 500,
  STORAGE_STRATEGY: 'SD_CARD_FIRST', // Continuous & incident video saved to physical MicroSD card
  SD_AUTO_UPLOAD_EVENTS: false,      // Alarm telemetry sent to server; video clips fetched strictly on demand
  MONTHLY_STORED_BYTES_CAP: 250 * 1024 * 1024, // 250 MB temporary incident cache
  MONTHLY_UPLOAD_BYTES_CAP: 1024 * 1024 * 1024, // 1 GB
  MONTHLY_LIVE_MINUTES_CAP: 30, // 30 minutes live video / month
  MAX_LIVE_SESSION_SECONDS: 120, // 2 minutes max per session (enforces low cellular data)
  MEDIA_RETENTION_DAYS: 7, // 7 days rolling retention on server; permanent retention stays on SD card
  
  // Storage & MySQL Database
  STORAGE_DIR: path.join(__dirname, '..', 'storage'),
  DB_PATH: path.join(__dirname, '..', 'storage', 'dashcam_saas.db'),
  MYSQL_HOST: process.env.MYSQL_HOST || 'localhost',
  MYSQL_PORT: parseInt(process.env.MYSQL_PORT || '3306', 10),
  MYSQL_USER: process.env.MYSQL_USER || 'root',
  MYSQL_PASSWORD: process.env.MYSQL_PASSWORD || 'root',
  MYSQL_DATABASE: process.env.MYSQL_DATABASE || 'dashcam_db'
};

module.exports = config;

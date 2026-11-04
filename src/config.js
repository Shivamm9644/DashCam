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
  // This web console
  PORT: parseInt(process.env.PORT || '3001', 10),
  // Java backend: every /api/v1 call is answered there
  JAVA_BACKEND_URL: (process.env.JAVA_BACKEND_URL || 'http://100.31.90.51:8021').replace(/\/+$/, ''),
  // JT808/JT1078 gateway: live and SD playback HLS segments are fetched from here
  GATEWAY_URL: (process.env.GATEWAY_URL || 'http://100.31.90.51:3000').replace(/\/+$/, '')
};

module.exports = config;

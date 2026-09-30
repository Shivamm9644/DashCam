const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('[CreateZip] Packing clean source archive...');

const root = path.join(__dirname, '..');
const stageDir = path.join(root, 'clean_source_staging');
const zipFile = path.join(root, 'dashcam_clean_source.zip');

if (fs.existsSync(stageDir)) {
    fs.rmSync(stageDir, { recursive: true, force: true });
}
if (fs.existsSync(zipFile)) {
    fs.unlinkSync(zipFile);
}

fs.mkdirSync(stageDir, { recursive: true });

// Copy source directories & files
const itemsToCopy = [
    'src',
    'public',
    'test',
    'tools',
    'package.json',
    'package-lock.json',
    '.env.example',
    'server.js',
    'README.md'
];

for (const item of itemsToCopy) {
    const srcPath = path.join(root, item);
    const destPath = path.join(stageDir, item);
    if (fs.existsSync(srcPath)) {
        fs.cpSync(srcPath, destPath, { recursive: true });
    }
}

// Compress using PowerShell Compress-Archive from clean staging directory
try {
    const psCmd = `powershell -Command "Compress-Archive -Path '${stageDir}\\*' -DestinationPath '${zipFile}' -Force"`;
    execSync(psCmd, { stdio: 'inherit' });
    console.log(`[CreateZip] SUCCESS: Created ${zipFile} (${(fs.statSync(zipFile).size / 1024).toFixed(1)} KB)`);
} finally {
    fs.rmSync(stageDir, { recursive: true, force: true });
}

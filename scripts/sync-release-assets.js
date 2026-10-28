#!/usr/bin/env node
/**
 * Attendly — Sync All Installer Assets from GitHub Release
 * Downloads all compiled .exe, .dmg, .AppImage, .deb, and install scripts
 * directly into the local ./release directory so the Docker proxy can host them.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const REPO = 'Gheorghe-dev/Attendly';
const TAG = 'v1.1.2';
const TARGET_DIR = path.resolve(__dirname, '..', 'release');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Attendly-Sync' } }, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Attendly-Sync' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve).catch(reject);
      }
      const stream = fs.createWriteStream(dest);
      let downloaded = 0;
      const total = parseInt(res.headers['content-length'] || '0', 10);
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total) {
          process.stdout.write(`\rProgress: ${(downloaded / total * 100).toFixed(1)}% (${(downloaded / 1048576).toFixed(1)} MB)`);
        }
      });
      res.pipe(stream);
      stream.on('finish', () => {
        console.log('');
        resolve();
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log(`========================================================`);
  console.log(`  SYNCING ATTENDLY ${TAG} INSTALLERS FOR DOCKER HOSTING `);
  console.log(`========================================================\n`);

  console.log(`Fetching release metadata for ${TAG}...`);
  const release = await getJson(`https://api.github.com/repos/${REPO}/releases/tags/${TAG}`);
  if (!release.assets || release.assets.length === 0) {
    console.error('No assets found on release', TAG);
    return;
  }

  console.log(`Found ${release.assets.length} assets on GitHub Release.\n`);

  for (const asset of release.assets) {
    if (asset.name.endsWith('.blockmap') || asset.name.endsWith('.yml')) {
      continue;
    }
    const dest = path.join(TARGET_DIR, asset.name);
    if (fs.existsSync(dest)) {
      const stat = fs.statSync(dest);
      if (stat.size === asset.size) {
        console.log(`✓ ${asset.name} already exists (${(asset.size / 1048576).toFixed(1)} MB)`);
        continue;
      }
    }
    console.log(`Downloading ${asset.name} (${(asset.size / 1048576).toFixed(1)} MB)...`);
    await downloadFile(asset.browser_download_url, dest);
    console.log(`✓ Successfully downloaded ${asset.name}`);
  }

  console.log(`\n🎉 All installer assets synced to: ${TARGET_DIR}`);
  console.log(`Docker Nginx proxy is ready to host these files at /downloads/`);
}

main().catch(console.error);

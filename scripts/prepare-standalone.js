const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const STANDALONE_DIR = path.join(ROOT_DIR, '.next', 'standalone');

if (!fs.existsSync(STANDALONE_DIR)) {
  console.error('[prepare-standalone] Error: .next/standalone does not exist. Run "next build" first.');
  process.exit(1);
}

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, item), path.join(dest, item));
    }
  } else {
    const parentDir = path.dirname(dest);
    if (!fs.existsSync(parentDir)) fs.mkdirSync(parentDir, { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

console.log('[prepare-standalone] Copying public and static assets to standalone...');

// 1. Copy public
const publicSrc = path.join(ROOT_DIR, 'public');
const publicDest = path.join(STANDALONE_DIR, 'public');
copyRecursiveSync(publicSrc, publicDest);

// 2. Copy .next/static
const staticSrc = path.join(ROOT_DIR, '.next', 'static');
const staticDest = path.join(STANDALONE_DIR, '.next', 'static');
copyRecursiveSync(staticSrc, staticDest);

// 3. Copy prisma files
const prismaSrc = path.join(ROOT_DIR, 'prisma');
const prismaDest = path.join(STANDALONE_DIR, 'prisma');
copyRecursiveSync(prismaSrc, prismaDest);

console.log('[prepare-standalone] Standalone build prepared successfully!');

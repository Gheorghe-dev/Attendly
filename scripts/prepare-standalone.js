const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

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

// 3. Generate a clean database template for first launch.
const prismaSrc = path.join(ROOT_DIR, 'prisma');
const prismaDest = path.join(STANDALONE_DIR, 'prisma');
const templateName = `attendly-build-template-${process.pid}-${crypto.randomUUID()}.db`;
const templateDb = path.join(prismaSrc, templateName);
const prismaCli = path.join(ROOT_DIR, 'node_modules', 'prisma', 'build', 'index.js');

if (!fs.existsSync(prismaCli)) {
  console.error('[prepare-standalone] Error: Prisma CLI is missing. Run "npm ci" first.');
  process.exit(1);
}

try {
  execFileSync(process.execPath, [
    prismaCli,
    'db',
    'push',
    '--schema',
    path.join(prismaSrc, 'schema.prisma'),
  ], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATABASE_URL: `file:./${templateName}`,
    },
    stdio: 'inherit',
  });

  fs.rmSync(prismaDest, { recursive: true, force: true });
  fs.mkdirSync(prismaDest, { recursive: true });
  fs.copyFileSync(templateDb, path.join(prismaDest, 'template.db'));
} catch (error) {
  console.error('[prepare-standalone] Error: Could not generate a clean database template.', error.message);
  process.exitCode = 1;
} finally {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const tempFile = `${templateDb}${suffix}`;
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  }
}

if (process.exitCode !== 1) {
  console.log('[prepare-standalone] Standalone build prepared successfully!');
}

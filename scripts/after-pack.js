const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack hook
 * 1. Copies the standalone node_modules into the packaged app resources
 * 2. Removes Prisma query-engine binaries for OTHER platforms to save ~35 MB
 * 3. Generates a safe default .env inside the standalone directory
 */
exports.default = async function (context) {
  console.log('[after-pack] Running afterPack hook...');
  const appOutDir = context.appOutDir;
  const projectDir = context.packager.projectDir;
  const platform = context.packager.platform.name; // "windows", "mac", "linux"

  // ── 1. Copy standalone node_modules ──────────────────────────────
  const standaloneModulesSrc = path.join(projectDir, '.next', 'standalone', 'node_modules');
  const standaloneModulesDest = path.join(appOutDir, 'resources', 'standalone', 'node_modules');

  if (fs.existsSync(standaloneModulesSrc)) {
    console.log('[after-pack] Copying standalone node_modules into packaged app...');
    if (!fs.existsSync(standaloneModulesDest)) {
      fs.mkdirSync(standaloneModulesDest, { recursive: true });
    }
    fs.cpSync(standaloneModulesSrc, standaloneModulesDest, { recursive: true });
    console.log('[after-pack] Standalone node_modules successfully copied!');
  } else {
    console.warn('[after-pack] Warning: .next/standalone/node_modules not found!');
  }

  // ── 2. Prune Prisma engines for wrong platforms ──────────────────
  const keepSuffix = {
    windows: 'windows.dll.node',
    mac:     'darwin',             // covers both darwin and darwin-arm64
    linux:   'linux',
  }[platform] || '';

  const pruneDirs = [
    path.join(appOutDir, 'resources', 'standalone', 'node_modules', '.prisma', 'client'),
    path.join(appOutDir, 'resources', 'standalone', 'node_modules', '@prisma', 'engines'),
    path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', 'prisma'),
    path.join(appOutDir, 'resources', 'app.asar.unpacked', 'node_modules', '@prisma', 'engines'),
  ];

  let totalPruned = 0;
  for (const dir of pruneDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const isEngine = file.includes('query_engine') || file.includes('libquery_engine') || file.includes('schema_engine');
      if (!isEngine) continue;
      if (keepSuffix && file.includes(keepSuffix)) continue; // keep this platform's engine
      const fullPath = path.join(dir, file);
      try {
        const stat = fs.statSync(fullPath);
        fs.unlinkSync(fullPath);
        totalPruned += stat.size;
        console.log(`[after-pack] Pruned foreign engine: ${file} (${(stat.size / 1048576).toFixed(1)} MB)`);
      } catch (e) {
        console.warn(`[after-pack] Could not prune ${file}:`, e.message);
      }
    }
  }
  if (totalPruned > 0) {
    console.log(`[after-pack] Total pruned: ${(totalPruned / 1048576).toFixed(1)} MB`);
  }

  // ── 3. Write safe default .env into standalone ───────────────────
  const envDest = path.join(appOutDir, 'resources', 'standalone', '.env');
  const envContent = [
    '# Attendly – auto-generated .env for packaged build',
    'DATABASE_URL="file:./prisma/dev.db"',
    `NEXTAUTH_SECRET="${require('crypto').randomBytes(32).toString('base64url')}"`,
    'NEXTAUTH_URL="http://localhost:3000"',
    'AUTH_TRUST_HOST="true"',
    'APP_URL="http://localhost:3000"',
    'DEV_MODE_EMAIL="1"',
    '',
  ].join('\n');
  fs.writeFileSync(envDest, envContent, 'utf-8');
  console.log('[after-pack] Default .env written to standalone.');
  console.log('[after-pack] Done!');
};

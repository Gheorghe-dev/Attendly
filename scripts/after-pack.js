const fs = require('fs');
const path = require('path');

/**
 * electron-builder afterPack hook
 * 1. Copies the standalone node_modules into the packaged app resources (cross-platform)
 * 2. Removes Prisma query-engine binaries for OTHER platforms to save space
 * 3. Generates a safe default .env inside the standalone directory
 * 4. Ensures executable permissions on bundled helper binaries on macOS/Linux
 */
exports.default = async function (context) {
  console.log('[after-pack] Running cross-platform afterPack hook...');
  const appOutDir = context.appOutDir;
  const projectDir = context.packager.projectDir;
  const platform = context.packager.platform.name; // "windows", "mac", "linux"

  // ── Locate exact resources directory for the platform ───────────
  let resourcesDir = path.join(appOutDir, 'resources');
  if (context.packager && typeof context.packager.getResourcesDir === 'function') {
    try {
      resourcesDir = context.packager.getResourcesDir(appOutDir);
    } catch {}
  }

  // Robust fallback for macOS bundle structure (Contents/Resources)
  if (platform === 'mac' && !fs.existsSync(resourcesDir)) {
    const macCandidates = [
      path.join(appOutDir, 'Attendly.app', 'Contents', 'Resources'),
      path.join(appOutDir, `${context.packager.appInfo?.productFilename || 'Attendly'}.app`, 'Contents', 'Resources'),
    ];
    for (const c of macCandidates) {
      if (fs.existsSync(c)) {
        resourcesDir = c;
        break;
      }
    }
  }

  console.log(`[after-pack] Target resources directory: ${resourcesDir} (Platform: ${platform})`);

  // ── 1. Copy standalone node_modules ──────────────────────────────
  const standaloneModulesSrc = path.join(projectDir, '.next', 'standalone', 'node_modules');
  const standaloneModulesDest = path.join(resourcesDir, 'standalone', 'node_modules');

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

  // ── 2. Prune Prisma engines for foreign platforms ────────────────
  function isForeignEngine(file, targetPlatform) {
    const isEngine =
      file.includes('query_engine') ||
      file.includes('libquery_engine') ||
      file.includes('schema_engine');
    if (!isEngine) return false;

    if (targetPlatform === 'windows') {
      return !file.includes('windows');
    }
    if (targetPlatform === 'mac') {
      return !file.includes('darwin');
    }
    if (targetPlatform === 'linux') {
      return (
        !file.includes('debian-openssl') &&
        !file.includes('rhel-openssl') &&
        !file.includes('linux')
      );
    }
    return false;
  }

  const pruneDirs = [
    path.join(resourcesDir, 'standalone', 'node_modules', '.prisma', 'client'),
    path.join(resourcesDir, 'standalone', 'node_modules', '@prisma', 'engines'),
    path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', 'prisma'),
    path.join(resourcesDir, 'app.asar.unpacked', 'node_modules', '@prisma', 'engines'),
  ];

  let totalPruned = 0;
  for (const dir of pruneDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (!isForeignEngine(file, platform)) continue;
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
    } catch (e) {
      console.warn(`[after-pack] Could not read directory ${dir}:`, e.message);
    }
  }
  if (totalPruned > 0) {
    console.log(`[after-pack] Total pruned: ${(totalPruned / 1048576).toFixed(1)} MB`);
  }

  // ── 3. Write safe default .env into standalone ───────────────────
  const envDest = path.join(resourcesDir, 'standalone', '.env');
  const envContent = [
    '# Attendly – auto-generated .env for packaged build',
    'DATABASE_URL="file:./prisma/dev.db"',
    `NEXTAUTH_SECRET="${require('crypto').randomBytes(32).toString('base64url')}"`,
    'AUTH_TRUST_HOST="true"',
    'DEV_MODE_EMAIL="1"',
    '',
  ].join('\n');
  try {
    const standaloneDir = path.join(resourcesDir, 'standalone');
    if (!fs.existsSync(standaloneDir)) fs.mkdirSync(standaloneDir, { recursive: true });
    fs.writeFileSync(envDest, envContent, 'utf-8');
    console.log('[after-pack] Default .env written to:', envDest);
  } catch (err) {
    console.warn('[after-pack] Warning: Could not write default .env:', err.message);
  }

  // ── 4. Ensure executable permissions on helper binaries (macOS / Linux) ───
  if (platform !== 'windows') {
    const binCandidates = [
      path.join(resourcesDir, 'bin', 'cloudflared'),
      path.join(appOutDir, 'bin', 'cloudflared'),
    ];
    for (const binPath of binCandidates) {
      if (fs.existsSync(binPath)) {
        try {
          fs.chmodSync(binPath, 0o755);
          console.log('[after-pack] Set executable mode (0755) on:', binPath);
        } catch (e) {
          console.warn('[after-pack] Could not chmod:', binPath, e.message);
        }
      }
    }
  }

  console.log('[after-pack] Packaging preparation completed successfully!');
};

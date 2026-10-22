const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TUNNEL_FILE = path.join(process.cwd(), '.tunnel_url');

// Auto-bootstrap environment & database if missing
function ensurePrerequisites() {
  const envPath = path.join(process.cwd(), '.env');
  const envExamplePath = path.join(process.cwd(), '.env.example');
  if (!fs.existsSync(envPath) && fs.existsSync(envExamplePath)) {
    console.log('  [Setup] Initializing .env configuration...');
    let envContent = fs.readFileSync(envExamplePath, 'utf-8');
    const secret = require('crypto').randomBytes(32).toString('base64');
    envContent = envContent.replace('change-this-to-a-secure-random-32-byte-string', secret);
    fs.writeFileSync(envPath, envContent, 'utf-8');
  }

  const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
  if (!fs.existsSync(dbPath)) {
    console.log('  [Setup] Initializing local database schema...');
    try {
      execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    } catch {
      console.warn('  [Setup] Database initialization will proceed on next step.');
    }
  }
}
ensurePrerequisites();

// Clean up stale tunnel file on start
try { if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE); } catch {}

function checkServerReady(port = 3000) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

function freePort(port = 3000) {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      exec(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
        () => resolve()
      );
    } else {
      exec(`fuser -k ${port}/tcp >/dev/null 2>&1`, () => resolve());
    }
  });
}

async function startServer() {
  const isRunning = await checkServerReady(3000);
  if (isRunning) {
    console.log('  ✓ Next.js server already running on port 3000.');
    return null;
  }

  await freePort(3000);
  console.log('  Starting Next.js server on port 3000...');
  const isProd = fs.existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'));
  const cmd = isProd ? 'npm' : 'npm';
  const args = isProd ? ['start'] : ['run', 'dev'];

  const serverProc = spawn(cmd, args, {
    shell: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, PORT: '3000' },
  });

  let browserOpened = false;

  function openLocalBrowser() {
    if (browserOpened) return;
    browserOpened = true;
    const localUrl = 'http://localhost:3000';
    let openCmd;
    if (process.platform === 'win32') {
      openCmd = `start "" "${localUrl}"`;
    } else if (process.platform === 'darwin') {
      openCmd = `open "${localUrl}"`;
    } else {
      openCmd = `xdg-open "${localUrl}" >/dev/null 2>&1 || sensible-browser "${localUrl}" >/dev/null 2>&1 || true`;
    }
    exec(openCmd, () => {});
  }

  // Wait for server to respond
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await checkServerReady(3000);
    if (ready) break;
  }

  if (ready) {
    console.log('  ✓ Next.js server is ready!');
    openLocalBrowser();
  } else {
    console.log('  ⚠ Server taking longer to start, proceeding to tunnel...');
  }

  return serverProc;
}

async function startCloudflareTunnel(serverProc) {
  console.log('  Connecting secure Cloudflare Worldwide Tunnel...');
  console.log('  (Works on ALL phones, cellular 4G/5G, and any Wi-Fi network)\n');

  const tunnel = spawn('npx', ['--yes', 'cloudflared', 'tunnel', '--url', 'http://localhost:3000'], {
    shell: true,
  });

  let tunnelUrl = null;

  function handleData(data) {
    const str = data.toString();
    const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      fs.writeFileSync(TUNNEL_FILE, tunnelUrl, 'utf-8');

      console.log('\n  ╔══════════════════════════════════════════════════════════════════════╗');
      console.log('  ║                   ATTENDLY — SMART ATTENDANCE ACTIVE                 ║');
      console.log('  ╚══════════════════════════════════════════════════════════════════════╝');
      console.log(`\n    🌍 PUBLIC INTERNET URL (Student Mobile Scans):\n       ${tunnelUrl}\n`);
      console.log(`    💻 DASHBOARD (PC Browser):\n       http://localhost:3000\n`);
      console.log('  ════════════════════════════════════════════════════════════════════════');
      console.log('    ✓ Phones on 4G, 5G, or ANY other Wi-Fi can scan the QR code!');
      console.log('    ✓ Works seamlessly across different IPs and different networks.');
      console.log('    ✓ Keep this window open while taking attendance.');
      console.log('  ════════════════════════════════════════════════════════════════════════\n');

      openLocalBrowser();
    }
  }

  tunnel.stdout.on('data', handleData);
  tunnel.stderr.on('data', handleData);

  function cleanup() {
    console.log('\n  Stopping server and tunnel...');
    try { if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE); } catch {}
    try {
      if (process.platform === 'win32') {
        exec('taskkill /F /IM cloudflared.exe >nul 2>&1');
      } else {
        exec('killall cloudflared >/dev/null 2>&1 || true');
      }
      tunnel.kill();
    } catch {}
    if (serverProc) {
      try { serverProc.kill(); } catch {}
      freePort(3000).then(() => process.exit(0));
    } else {
      process.exit(0);
    }
  }

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    try { if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE); } catch {}
  });
}

(async () => {
  const server = await startServer();
  await startCloudflareTunnel(server);
})();

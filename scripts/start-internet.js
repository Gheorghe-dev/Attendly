const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const TUNNEL_FILE = path.join(process.cwd(), '.tunnel_url');

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
    exec(`for /f "tokens=5" %P in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING 2^>nul') do taskkill /F /PID %P >nul 2>&1`, () => {
      resolve();
    });
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

  // Wait for server to respond
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await checkServerReady(3000);
    if (ready) break;
  }

  if (ready) {
    console.log('  ✓ Next.js server is ready!');
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
  let browserOpened = false;

  function handleData(data) {
    const str = data.toString();
    const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
    if (match && !tunnelUrl) {
      tunnelUrl = match[0];
      fs.writeFileSync(TUNNEL_FILE, tunnelUrl, 'utf-8');

      console.log('\n  ╔══════════════════════════════════════════════════════════════════════╗');
      console.log('  ║              QR ATTENDANCE — WORLDWIDE INTERNET ACTIVE               ║');
      console.log('  ╚══════════════════════════════════════════════════════════════════════╝');
      console.log(`\n    🌍 PUBLIC INTERNET URL:\n       ${tunnelUrl}\n`);
      console.log(`    💻 DASHBOARD (PC):\n       http://localhost:3000\n`);
      console.log('  ════════════════════════════════════════════════════════════════════════');
      console.log('    ✓ Phones on 4G, 5G, or ANY other Wi-Fi can scan the QR code!');
      console.log('    ✓ Works seamlessly across different IPs and different networks.');
      console.log('    ✓ Keep this window open while taking attendance.');
      console.log('  ════════════════════════════════════════════════════════════════════════\n');

      if (!browserOpened) {
        browserOpened = true;
        const openCmd = process.platform === 'win32' ? `start "" "${tunnelUrl}"` : `open "${tunnelUrl}"`;
        exec(openCmd);
      }
    }
  }

  tunnel.stdout.on('data', handleData);
  tunnel.stderr.on('data', handleData);

  function cleanup() {
    console.log('\n  Stopping server and tunnel...');
    try { if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE); } catch {}
    try { tunnel.kill(); } catch {}
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

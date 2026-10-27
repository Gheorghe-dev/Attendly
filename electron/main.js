const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const { spawn, exec, execSync } = require('child_process');

// Set Application Name and Windows User Model ID early
app.setName('Attendly');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.attendly.app');
}

// Disable hardware acceleration to eliminate Windows/Linux GPU process crashes
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

// Catch unhandled errors gracefully to eliminate error dialog popups
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Electron] Unhandled Rejection at:', promise, 'reason:', reason);
});

const ROOT_DIR = path.resolve(__dirname, '..');
let PORT = Number(process.env.PORT) || 3000;
let SERVER_URL = `http://127.0.0.1:${PORT}`;
let globalServerCwd = null;

function getUserDataDir() {
  try {
    return app.getPath('userData');
  } catch {
    return ROOT_DIR;
  }
}

const TUNNEL_FILE = path.join(getUserDataDir(), '.tunnel_url');

function getDatabaseUrl() {
  const userData = getUserDataDir();
  if (!fs.existsSync(userData)) {
    try { fs.mkdirSync(userData, { recursive: true }); } catch {}
  }
  const targetDb = path.join(userData, 'attendly.db');

  // Check if database does not exist OR is empty / corrupted (less than 4KB)
  let needSeed = !fs.existsSync(targetDb);
  if (!needSeed) {
    try {
      const stat = fs.statSync(targetDb);
      if (stat.size < 4096) needSeed = true;
    } catch {
      needSeed = true;
    }
  }

  if (needSeed) {
    const candidates = [
      path.join(process.resourcesPath || '', 'prisma', 'template.db'),
      path.join(process.resourcesPath || '', 'prisma', 'dev.db'),
      path.join(process.resourcesPath || '', 'standalone', 'prisma', 'template.db'),
      path.join(process.resourcesPath || '', 'standalone', 'prisma', 'dev.db'),
      path.join(ROOT_DIR, 'prisma', 'template.db'),
      path.join(ROOT_DIR, 'prisma', 'dev.db'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          const stat = fs.statSync(c);
          if (stat.size > 4096) {
            fs.copyFileSync(c, targetDb);
            console.log('[Electron] Initialized user database from', c);
            break;
          }
        } catch (e) {
          console.warn('[Electron] Could not seed database from', c, e.message);
        }
      }
    }
  }

  // Cross-platform SQLite URL with normalized forward slashes
  const normalizedDb = targetDb.replace(/\\/g, '/');
  return `file:${normalizedDb}`;
}

let mainWindow = null;
let splashWindow = null;
let tray = null;
let serverProcess = null;
let tunnelProcess = null;
let tunnelUrl = null;
let isQuitting = false;

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createMainWindow();
    }
  });
}

function checkServerReady(portOrTimeout, timeoutMs = 1500) {
  let targetPort = PORT;
  let tMs = timeoutMs;
  if (typeof portOrTimeout === 'number') {
    if (portOrTimeout < 1000) {
      tMs = portOrTimeout;
    } else {
      targetPort = portOrTimeout;
    }
  }
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${targetPort}/api/health`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 302);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(tMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function freePort(port = PORT) {
  return new Promise((resolve) => {
    try {
      const execOpts = { cwd: getUserDataDir(), windowsHide: true };
      if (process.platform === 'win32') {
        exec(
          `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
          execOpts,
          () => resolve()
        );
      } else {
        exec(
          `lsof -ti:${port} | xargs kill -9 > /dev/null 2>&1 || fuser -k ${port}/tcp >/dev/null 2>&1 || true`,
          execOpts,
          () => resolve()
        );
      }
    } catch {
      resolve();
    }
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => {
      tester.close(() => resolve(true));
    });
    tester.listen(port, '127.0.0.1');
  });
}

async function resolveUsablePort(preferredPort = 3000) {
  // If Attendly is already responding on preferredPort, keep it
  const isRunning = await checkServerReady(preferredPort, 600);
  if (isRunning) return preferredPort;

  // Try freeing the preferred port
  await freePort(preferredPort);
  const available = await isPortAvailable(preferredPort);
  if (available) return preferredPort;

  // Search next available ports if preferred port remains blocked
  for (let p = preferredPort + 1; p <= preferredPort + 20; p++) {
    const pRunning = await checkServerReady(p, 400);
    if (pRunning) return p;
    const isAvail = await isPortAvailable(p);
    if (isAvail) {
      console.log(`[Electron] Port ${preferredPort} is busy. Switched to port ${p}`);
      return p;
    }
  }
  return preferredPort;
}

async function startServer() {
  const isRunning = await checkServerReady(PORT);
  if (isRunning) {
    console.log('[Electron] Server already running on port', PORT);
    return null;
  }

  console.log('[Electron] Starting Next.js server on port', PORT);

  const dbUrl = getDatabaseUrl();

  let serverScript;
  let serverCwd;
  let serverArgs;

  if (app.isPackaged) {
    serverScript = path.join(process.resourcesPath, 'standalone', 'server.js');
    serverCwd = path.join(process.resourcesPath, 'standalone');
    serverArgs = [serverScript];
  } else {
    const standaloneScript = path.join(ROOT_DIR, '.next', 'standalone', 'server.js');
    if (fs.existsSync(standaloneScript)) {
      serverScript = standaloneScript;
      serverCwd = path.join(ROOT_DIR, '.next', 'standalone');
      serverArgs = [serverScript];
    } else {
      const nextBin = path.join(ROOT_DIR, 'node_modules', 'next', 'dist', 'bin', 'next');
      const isProd = fs.existsSync(path.join(ROOT_DIR, '.next', 'BUILD_ID'));
      serverScript = nextBin;
      serverCwd = ROOT_DIR;
      serverArgs = isProd
        ? [nextBin, 'start', '-H', '0.0.0.0', '-p', String(PORT)]
        : [nextBin, 'dev', '-H', '0.0.0.0', '-p', String(PORT)];
    }
  }

  console.log('[Electron] Launching server with script:', serverScript);
  globalServerCwd = serverCwd;

  // Ensure NextAuth has a persistent, secure secret across app launches
  const secretFile = path.join(getUserDataDir(), '.auth_secret');
  let authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!authSecret) {
    const envFile = path.join(ROOT_DIR, '.env');
    if (fs.existsSync(envFile)) {
      try {
        const envText = fs.readFileSync(envFile, 'utf-8');
        const match = envText.match(/^(?:AUTH_SECRET|NEXTAUTH_SECRET)=["']?([^"'\r\n]+)["']?/m);
        if (match && match[1]) authSecret = match[1].trim();
      } catch {}
    }
  }
  if (!authSecret) {
    if (fs.existsSync(secretFile)) {
      try { authSecret = fs.readFileSync(secretFile, 'utf-8').trim(); } catch {}
    }
  }
  if (!authSecret || authSecret.length < 16) {
    authSecret = 'attendly-app-secure-default-encryption-secret-32-bytes';
    try { fs.writeFileSync(secretFile, authSecret, 'utf-8'); } catch {}
  }

  const proc = spawn(process.execPath, serverArgs, {
    cwd: serverCwd,
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '0.0.0.0',
      DATABASE_URL: dbUrl,
      NEXTAUTH_SECRET: authSecret,
      AUTH_SECRET: authSecret,
      AUTH_TRUST_HOST: 'true',
      ELECTRON_RUN_AS_NODE: '1', // Uses Electron's built-in Node runtime!
    },
  });

  proc.on('error', (err) => {
    console.error('[Electron] Next.js server failed to spawn:', err);
  });

  // Pipe stdout and stderr to persistent log file in userData
  try {
    const logFile = path.join(getUserDataDir(), 'server.log');
    const logStream = fs.createWriteStream(logFile, { flags: 'a' });
    proc.stdout?.pipe(logStream);
    proc.stderr?.pipe(logStream);
  } catch {}

  proc.stdout?.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('Ready') || msg.includes('Local:') || msg.includes('✓')) {
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('status-update', 'Server is ready! Loading dashboard…');
      }
    }
  });

  proc.stderr?.on('data', (d) => {
    console.error('[Next.js stderr]:', d.toString());
  });

  return proc;
}

function startCloudflareTunnel(protocol = 'http2') {
  try {
    if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE);
  } catch {}

  // Clean up any stale tunnel process synchronously before starting new one
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM cloudflared.exe >nul 2>&1', { windowsHide: true, stdio: 'ignore' });
    } else {
      execSync('killall cloudflared >/dev/null 2>&1 || true', { stdio: 'ignore' });
    }
  } catch {}

  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const candidateBins = [
    path.join(process.resourcesPath || '', 'bin', binName),
    path.join(process.resourcesPath || '', 'standalone', 'bin', binName),
    path.join(getUserDataDir(), 'bin', binName),
    path.join(ROOT_DIR, 'bin', binName),
    path.join(__dirname, '..', 'bin', binName),
  ];
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local');
    candidateBins.push(path.join(localAppData, 'Programs', 'attendly', 'resources', 'bin', binName));
    candidateBins.push(path.join(localAppData, 'Programs', 'Attendly', 'resources', 'bin', binName));
  }

  let localBin = null;
  for (const b of candidateBins) {
    if (fs.existsSync(b)) {
      localBin = b;
      break;
    }
  }

  let proc = null;
  try {
    if (localBin) {
      if (process.platform !== 'win32') {
        try { fs.chmodSync(localBin, 0o755); } catch {}
      } else {
        try {
          execSync(`powershell -NoProfile -Command "Unblock-File -LiteralPath '${localBin}' -ErrorAction SilentlyContinue"`, { windowsHide: true, stdio: 'ignore' });
        } catch {}
      }
      console.log(`[Electron] Launching bundled Cloudflare binary (${protocol}):`, localBin);
      proc = spawn(localBin, ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate', '--protocol', protocol], {
        cwd: getUserDataDir(),
        shell: false,
        windowsHide: true,
      });
    } else if (!app.isPackaged) {
      // In development only, allow falling back to npx
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      proc = spawn(cmd, ['--yes', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate', '--protocol', protocol], {
        cwd: getUserDataDir(),
        shell: true,
        windowsHide: true,
      });
    } else {
      console.warn('[Electron] Cloudflare binary not bundled; tunnel inactive.');
      return null;
    }

    if (proc) {
      proc.on('error', (err) => {
        console.warn('[Electron] Cloudflare tunnel process error:', err.message);
      });

      // Pipe tunnel output to persistent tunnel.log in userData for complete transparency
      try {
        const tunnelLog = path.join(getUserDataDir(), 'tunnel.log');
        const tunnelStream = fs.createWriteStream(tunnelLog, { flags: 'a' });
        proc.stdout?.pipe(tunnelStream);
        proc.stderr?.pipe(tunnelStream);
      } catch {}

      let outputBuffer = '';
      function handleData(data) {
        const str = data.toString();
        outputBuffer += str;
        const match = outputBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && !tunnelUrl) {
          const rawUrl = match[0];
          tunnelUrl = rawUrl;
          console.log('[Electron] Cloudflare Worldwide Tunnel active for QR scans:', tunnelUrl);

          // 1. Write to userData and common discovery paths
          const candidatePaths = [
            TUNNEL_FILE,
            path.join(path.resolve(require('os').tmpdir()), '.attendly_tunnel'),
            path.join(path.resolve(require('os').homedir()), '.attendly_tunnel'),
            path.join(ROOT_DIR, '.tunnel_url'),
          ];
          if (globalServerCwd) {
            candidatePaths.push(path.join(globalServerCwd, '.tunnel_url'));
          }
          if (process.resourcesPath) {
            candidatePaths.push(path.join(process.resourcesPath, 'standalone', '.tunnel_url'));
            candidatePaths.push(path.join(process.resourcesPath, 'bin', '.tunnel_url'));
          }

          for (const targetPath of candidatePaths) {
            try {
              fs.writeFileSync(targetPath, tunnelUrl, 'utf-8');
            } catch {}
          }

          // 2. Notify Next.js server via HTTP POST with automatic retry
          const notifyNextServer = (retries = 6) => {
            try {
              const postData = JSON.stringify({ url: tunnelUrl });
              const req = http.request(
                `http://127.0.0.1:${PORT}/api/tunnel`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                  },
                  timeout: 2000,
                },
                (res) => {
                  if (res.statusCode !== 200 && retries > 0) {
                    setTimeout(() => notifyNextServer(retries - 1), 1000);
                  }
                }
              );
              req.on('error', () => {
                if (retries > 0) setTimeout(() => notifyNextServer(retries - 1), 1000);
              });
              req.write(postData);
              req.end();
            } catch {}
          };
          notifyNextServer();

          updateTrayMenu();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setTitle(`Attendly — 🌍 Accessible on any Wi-Fi & 4G/5G`);
          }
        }
      }

      proc.stdout?.on('data', handleData);
      proc.stderr?.on('data', handleData);

      proc.on('close', (code) => {
        console.warn(`[Electron] Cloudflare tunnel process exited with code ${code}`);
        tunnelUrl = null;
        try { if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE); } catch {}
        try {
          const postData = JSON.stringify({ url: null });
          const req = http.request(`http://127.0.0.1:${PORT}/api/tunnel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData),
            },
            timeout: 1000,
          });
          req.on('error', () => {});
          req.write(postData);
          req.end();
        } catch {}
        updateTrayMenu();

        // Auto-reconnect if app is still running
        if (!isQuitting) {
          if (protocol === 'http2') {
            console.log('[Electron] Re-attempting tunnel with auto protocol in 1.5s...');
            setTimeout(() => {
              if (!isQuitting && !tunnelUrl) {
                tunnelProcess = startCloudflareTunnel('auto');
              }
            }, 1500);
          } else {
            console.log('[Electron] Reconnecting tunnel in 2.5s...');
            setTimeout(() => {
              if (!isQuitting && !tunnelUrl) {
                tunnelProcess = startCloudflareTunnel('http2');
              }
            }, 2500);
          }
        }
      });
    }
  } catch (err) {
    console.warn('[Electron] Could not launch tunnel:', err.message);
    proc = null;
  }

  return proc;
}

function getAppIcon() {
  const possiblePaths = [
    path.join(ROOT_DIR, 'attendly.ico'),
    path.join(ROOT_DIR, 'public', 'emblem.png'),
    path.join(ROOT_DIR, 'src', 'app', 'favicon.ico'),
    path.join(ROOT_DIR, 'src', 'app', 'icon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) return img;
      } catch (err) {
        console.warn('[Electron] Could not load icon from', p, err.message);
      }
    }
  }
  return undefined;
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 480,
    height: 340,
    frame: false,
    resizable: false,
    center: true,
    transparent: false,
    alwaysOnTop: true,
    title: 'Attendly',
    icon: getAppIcon(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => {
    splashWindow = null;
  });
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Attendly',
    show: false,
    backgroundColor: '#0f172a',
    icon: getAppIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  const showMainWindow = () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      try { splashWindow.close(); } catch {}
      splashWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (!mainWindow.isVisible()) {
        mainWindow.show();
      }
      mainWindow.focus();
    }
  };

  mainWindow.once('ready-to-show', showMainWindow);
  mainWindow.webContents.once('did-finish-load', showMainWindow);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.warn(`[Electron] did-fail-load: ${errorCode} ${errorDescription} on ${validatedURL}`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(SERVER_URL);
      }
    }, 1000);
  });

  // Failsafe: if neither ready-to-show nor did-finish-load fired within 3.5s, force show
  setTimeout(showMainWindow, 3500);

  const isAllowedInternal = (url) => {
    if (!url) return false;
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) return true;
    return false;
  };

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedInternal(url)) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAllowedInternal(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    cleanup();
    app.quit();
  });

  mainWindow.loadURL(SERVER_URL);
}

function buildNativeMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Dashboard Overview',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.loadURL(`${SERVER_URL}/dashboard`),
        },
        {
          label: 'Courses Roster',
          click: () => mainWindow?.loadURL(`${SERVER_URL}/dashboard/courses`),
        },
        {
          label: 'Active Sessions',
          click: () => mainWindow?.loadURL(`${SERVER_URL}/dashboard/sessions`),
        },
        { type: 'separator' },
        {
          label: 'Copy Student Attendance Link (Cloudflare)',
          click: () => {
            const url = tunnelUrl || (fs.existsSync(TUNNEL_FILE) ? fs.readFileSync(TUNNEL_FILE, 'utf-8').trim() : null);
            if (url) {
              const { clipboard } = require('electron');
              clipboard.writeText(url);
            }
          },
        },
        {
          label: 'Open Dashboard in Web Browser',
          click: () => shell.openExternal(SERVER_URL),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Tunnel & Network',
      submenu: [
        {
          label: 'Copy Public Tunnel URL',
          click: () => {
            const url = tunnelUrl || (fs.existsSync(TUNNEL_FILE) ? fs.readFileSync(TUNNEL_FILE, 'utf-8').trim() : null);
            if (url) {
              const { clipboard } = require('electron');
              clipboard.writeText(url);
            }
          },
        },
        {
          label: 'Open Tunnel in Browser',
          click: () => {
            const url = tunnelUrl || (fs.existsSync(TUNNEL_FILE) ? fs.readFileSync(TUNNEL_FILE, 'utf-8').trim() : null);
            if (url) shell.openExternal(url);
          },
        },
        { type: 'separator' },
        {
          label: 'Restart Tunnel Process',
          click: () => {
            if (tunnelProcess) {
              try { tunnelProcess.kill(); } catch {}
            }
            tunnelUrl = null;
            tunnelProcess = startCloudflareTunnel();
          },
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation (USER_GUIDE.md)',
          click: () => {
            const docsPath = path.join(ROOT_DIR, 'USER_GUIDE.md');
            if (fs.existsSync(docsPath)) shell.openPath(docsPath);
          },
        },
        {
          label: 'Open App Directory',
          click: () => shell.openPath(ROOT_DIR),
        },
        { type: 'separator' },
        {
          label: 'About Attendly',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Attendly',
              message: 'Attendly — Desktop Edition',
              detail: `Version ${app.getVersion()}\nNext.js 14 + Electron Desktop Runtime\nZero-config local server & Cloudflare tunnel.\nDesigned for university lectures & labs.`,
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function updateTrayMenu() {
  if (!tray) return;

  const currentTunnel = tunnelUrl || (fs.existsSync(TUNNEL_FILE) ? fs.readFileSync(TUNNEL_FILE, 'utf-8').trim() : null);

  const contextMenu = Menu.buildFromTemplate([
    { label: '🎓 Attendly Desktop', enabled: false },
    { label: `Status: Running on Port ${PORT}`, enabled: false },
    {
      label: currentTunnel ? `🌍 Public: ${currentTunnel}` : '🌍 Connecting Worldwide Tunnel…',
      enabled: Boolean(currentTunnel),
      click: () => {
        if (currentTunnel) shell.openExternal(currentTunnel);
      },
    },
    {
      label: 'Copy Public Access Link',
      enabled: Boolean(currentTunnel),
      click: () => {
        if (currentTunnel) {
          const { clipboard } = require('electron');
          clipboard.writeText(currentTunnel);
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Show Dashboard Window',
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createMainWindow();
        }
      },
    },
    {
      label: 'Open in Default Browser',
      click: () => {
        const url = currentTunnel || SERVER_URL;
        shell.openExternal(url);
      },
    },
    { type: 'separator' },
    {
      label: 'Quit Application',
      click: () => {
        isQuitting = true;
        cleanup();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('Attendly (Port 3000)');
}

function setupTray() {
  const icon = getAppIcon();
  if (!icon) return;

  try {
    tray = new Tray(icon);
    tray.on('double-click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createMainWindow();
      }
    });
    updateTrayMenu();
  } catch (err) {
    console.error('[Electron] Tray init error:', err);
  }
}

// IPC Handlers
ipcMain.handle('get-tunnel-url', () => {
  return tunnelUrl || (fs.existsSync(TUNNEL_FILE) ? fs.readFileSync(TUNNEL_FILE, 'utf-8').trim() : null);
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// App Lifecycle
app.whenReady().then(async () => {
  // Dynamically resolve an open usable port if default 3000 is occupied
  PORT = await resolveUsablePort(PORT);
  SERVER_URL = `http://127.0.0.1:${PORT}`;

  // Allow geolocation and essential web permissions on PC without blocking
  if (session && session.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
      callback(true);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
      return true;
    });
  }

  createSplashWindow();
  buildNativeMenu();
  setupTray();

  // Check if server is already responding
  const isAlreadyReady = await checkServerReady(800);
  if (!isAlreadyReady) {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status-update', 'Checking server status…');
    }
    serverProcess = await startServer();

    // Poll until Next.js is responding
    let ready = false;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 600));
      ready = await checkServerReady();
      if (ready) break;
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('status-update', `Connecting to local engine (${i + 1}s)…`);
      }
    }
  } else {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status-update', 'Local engine connected! Initializing worldwide tunnel…');
    }
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', 'Starting Cloudflare worldwide link for any Wi-Fi…');
  }
  tunnelProcess = startCloudflareTunnel();

  // Allow up to 14 seconds for Worldwide Tunnel to connect before opening main window
  for (let j = 0; j < 28; j++) {
    if (tunnelUrl) break;
    await new Promise((r) => setTimeout(r, 500));
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send(
        'status-update',
        `Connecting Cloudflare worldwide link (${Math.round((j + 1) * 0.5)}s)…`
      );
    }
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send(
      'status-update',
      tunnelUrl ? 'Cloudflare worldwide link active! Loading Attendly…' : 'Ready! Loading Attendly…'
    );
  }

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

function cleanup() {
  if (isQuitting) return;
  isQuitting = true;
  console.log('[Electron] Cleaning up child processes…');
  try {
    if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE);
  } catch {}
  if (process.platform === 'win32') {
    try {
      exec('taskkill /F /IM cloudflared.exe >nul 2>&1', { cwd: getUserDataDir(), windowsHide: true });
    } catch {}
  }
  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch {}
    tunnelProcess = null;
  }
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
    serverProcess = null;
  }
  freePort(PORT);
}

app.on('before-quit', () => {
  cleanup();
});

app.on('window-all-closed', () => {
  cleanup();
  app.quit();
});

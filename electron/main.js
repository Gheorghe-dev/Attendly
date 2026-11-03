const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const { spawn, execSync } = require('child_process');

// ── Application Identity & Stability ──────────────────────────────────────────
app.setName('Attendly');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.attendly.app');
}

// Eliminate GPU crashes and unhandled error popups
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

process.on('uncaughtException', (err) => console.error('[Electron] Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('[Electron] Unhandled Rejection:', reason));

const ROOT_DIR = path.resolve(__dirname, '..');
let PORT = Number(process.env.PORT) || 3000;
let SERVER_URL = `http://127.0.0.1:${PORT}`;

function getUserDataDir() {
  try {
    return app.getPath('userData');
  } catch {
    return ROOT_DIR;
  }
}

const TUNNEL_FILE = path.join(getUserDataDir(), '.tunnel_url');

// Single instance lock
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

// ── Database Path Resolution ──────────────────────────────────────────────────
function getDatabaseUrl() {
  const userData = getUserDataDir();
  if (!fs.existsSync(userData)) {
    try { fs.mkdirSync(userData, { recursive: true }); } catch {}
  }
  const targetDb = path.join(userData, 'attendly.db');
  const repoDb = path.join(ROOT_DIR, 'prisma', 'dev.db');

  // In development, keep repo dev.db and userData synced
  if (fs.existsSync(repoDb) && !app.isPackaged) {
    try {
      if (fs.existsSync(targetDb)) {
        const repoStat = fs.statSync(repoDb);
        const userStat = fs.statSync(targetDb);
        if (userStat.mtimeMs > repoStat.mtimeMs && userStat.size > 4096) {
          fs.copyFileSync(targetDb, repoDb);
        } else if (repoStat.size > 4096) {
          fs.copyFileSync(repoDb, targetDb);
        }
      } else {
        fs.copyFileSync(repoDb, targetDb);
      }
    } catch {}
    return `file:${repoDb.replace(/\\/g, '/')}`;
  }

  // In production, seed user database if missing or empty
  let needSeed = !fs.existsSync(targetDb);
  if (!needSeed) {
    try {
      if (fs.statSync(targetDb).size < 4096) needSeed = true;
    } catch {
      needSeed = true;
    }
  }

  if (needSeed) {
    const candidates = [
      path.join(process.resourcesPath || '', 'prisma', 'template.db'),
      path.join(process.resourcesPath || '', 'standalone', 'prisma', 'template.db'),
      path.join(ROOT_DIR, 'prisma', 'template.db'),
      path.join(ROOT_DIR, 'prisma', 'dev.db'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        try {
          if (fs.statSync(c).size > 4096) {
            fs.copyFileSync(c, targetDb);
            console.log('[Electron] Initialized database from', c);
            break;
          }
        } catch {}
      }
    }
  }

  return `file:${targetDb.replace(/\\/g, '/')}`;
}

// ── State Variables ───────────────────────────────────────────────────────────
let mainWindow = null;
let splashWindow = null;
let tray = null;
let serverProcess = null;
let tunnelProcess = null;
let tunnelUrl = null;
let isQuitting = false;
let startedDockerCompose = false;

// ── Port & Server Readiness ───────────────────────────────────────────────────
function checkServerReady(port = PORT, timeoutMs = 1200) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 302);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer();
    tester.once('error', () => resolve(false));
    tester.once('listening', () => tester.close(() => resolve(true)));
    tester.listen(port, '127.0.0.1');
  });
}

async function resolveUsablePort(preferredPort = 3000) {
  if (await checkServerReady(preferredPort, 400)) return preferredPort;
  if (await isPortAvailable(preferredPort)) return preferredPort;

  for (let p = preferredPort + 1; p <= preferredPort + 20; p++) {
    if (await checkServerReady(p, 300) || await isPortAvailable(p)) {
      console.log(`[Electron] Port ${preferredPort} busy; using port ${p}`);
      return p;
    }
  }
  return preferredPort;
}

// ── Next.js Server Process ────────────────────────────────────────────────────
async function startServer() {
  if (await checkServerReady(PORT)) return null;

  console.log('[Electron] Launching server on port', PORT);
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

  // Persistent auth secret
  const secretFile = path.join(getUserDataDir(), '.auth_secret');
  let authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!authSecret && fs.existsSync(secretFile)) {
    try { authSecret = fs.readFileSync(secretFile, 'utf-8').trim(); } catch {}
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
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  proc.on('error', (err) => console.error('[Electron] Server spawn error:', err));

  try {
    const logStream = fs.createWriteStream(path.join(getUserDataDir(), 'server.log'), { flags: 'a' });
    proc.stdout?.pipe(logStream);
    proc.stderr?.pipe(logStream);
  } catch {}

  proc.stdout?.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('Ready') || msg.includes('Local:') || msg.includes('✓')) {
      sendSplashStatus('Server is ready! Loading dashboard…');
    }
  });

  return proc;
}

// ── Cloudflare Worldwide Tunnel ───────────────────────────────────────────────
function startCloudflareTunnel() {
  try { if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE); } catch {}

  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const candidateBins = [
    path.join(process.resourcesPath || '', 'bin', binName),
    path.join(getUserDataDir(), 'bin', binName),
    path.join(ROOT_DIR, 'bin', binName),
  ];

  let localBin = candidateBins.find((b) => fs.existsSync(b));

  let proc = null;
  try {
    if (localBin) {
      if (process.platform !== 'win32') {
        try { fs.chmodSync(localBin, 0o755); } catch {}
      }
      proc = spawn(localBin, ['tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate', '--protocol', 'http2'], {
        cwd: getUserDataDir(),
        shell: false,
        windowsHide: true,
      });
    } else if (!app.isPackaged) {
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      proc = spawn(cmd, ['--yes', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${PORT}`, '--no-autoupdate'], {
        cwd: getUserDataDir(),
        shell: true,
        windowsHide: true,
      });
    }

    if (proc) {
      let outputBuffer = '';
      function handleData(data) {
        outputBuffer += data.toString();
        const match = outputBuffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && !tunnelUrl) {
          tunnelUrl = match[0];
          console.log('[Electron] Cloudflare Worldwide Tunnel active:', tunnelUrl);

          const syncPaths = [
            TUNNEL_FILE,
            path.join(os.tmpdir(), '.attendly_tunnel'),
            path.join(ROOT_DIR, '.tunnel_url'),
          ];
          for (const p of syncPaths) {
            try { fs.writeFileSync(p, tunnelUrl, 'utf-8'); } catch {}
          }

          // Notify Next.js server
          try {
            const postData = JSON.stringify({ url: tunnelUrl });
            const req = http.request(`http://127.0.0.1:${PORT}/api/tunnel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
              timeout: 2000,
            });
            req.on('error', () => {});
            req.write(postData);
            req.end();
          } catch {}

          updateTrayMenu();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setTitle('Attendly — 🌍 Accessible on any Wi-Fi & 4G/5G');
          }
        }
      }

      proc.stdout?.on('data', handleData);
      proc.stderr?.on('data', handleData);
      proc.on('close', () => {
        tunnelUrl = null;
        try { if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE); } catch {}
        updateTrayMenu();
      });
    }
  } catch (err) {
    console.warn('[Electron] Tunnel launch error:', err.message);
  }

  return proc;
}

// ── Docker Lifecycle ──────────────────────────────────────────────────────────
function isDockerEngineRunning() {
  try {
    execSync('docker info', { stdio: 'ignore', timeout: 1200, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

function ensureDockerCompose() {
  const composePath = path.join(ROOT_DIR, 'docker-compose.yml');
  if (!fs.existsSync(composePath) || !isDockerEngineRunning()) return false;

  try {
    console.log('[Electron] Docker Engine detected. Ensuring containers are running...');
    execSync('docker compose up -d', { cwd: ROOT_DIR, stdio: 'ignore', timeout: 10000, windowsHide: true });
    startedDockerCompose = true;
    return true;
  } catch {
    return false;
  }
}

function stopDockerCompose() {
  if (startedDockerCompose) {
    try {
      console.log('[Electron] Stopping Docker Compose containers on exit...');
      execSync('docker compose down', { cwd: ROOT_DIR, stdio: 'ignore', timeout: 8000, windowsHide: true });
      startedDockerCompose = false;
    } catch {}
  }
}

// ── Window Management & UI ────────────────────────────────────────────────────
function getAppIcon() {
  const iconCandidates = [
    path.join(ROOT_DIR, 'attendly.ico'),
    path.join(ROOT_DIR, 'public', 'emblem.png'),
    path.join(ROOT_DIR, 'src', 'app', 'favicon.ico'),
  ];
  for (const p of iconCandidates) {
    if (fs.existsSync(p)) {
      try {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) return img;
      } catch {}
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
    alwaysOnTop: true,
    title: 'Attendly',
    icon: getAppIcon(),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
  splashWindow.on('closed', () => { splashWindow = null; });
}

function sendSplashStatus(message) {
  if (!splashWindow || splashWindow.isDestroyed()) return;
  try {
    splashWindow.webContents.send('status-update', message);
  } catch {}
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
      if (!mainWindow.isVisible()) mainWindow.show();
      mainWindow.focus();
    }
  };

  mainWindow.once('ready-to-show', showMainWindow);
  mainWindow.webContents.once('did-finish-load', showMainWindow);
  setTimeout(showMainWindow, 3500); // Failsafe

  const isInternal = (url) => url && (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isInternal(url)) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isInternal(url)) {
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
        { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' }, { role: 'forceReload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
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
            if (tunnelUrl) {
              const { clipboard } = require('electron');
              clipboard.writeText(tunnelUrl);
            }
          },
        },
        {
          label: 'Open Tunnel in Browser',
          click: () => {
            if (tunnelUrl) shell.openExternal(tunnelUrl);
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

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function updateTrayMenu() {
  if (!tray) return;
  const currentTunnel = tunnelUrl;

  const contextMenu = Menu.buildFromTemplate([
    { label: '🎓 Attendly Desktop', enabled: false },
    { label: `Status: Running on Port ${PORT}`, enabled: false },
    {
      label: currentTunnel ? `🌍 Public: ${currentTunnel}` : '🌍 Connecting Worldwide Tunnel…',
      enabled: Boolean(currentTunnel),
      click: () => { if (currentTunnel) shell.openExternal(currentTunnel); },
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
      label: 'Quit Application',
      click: () => {
        isQuitting = true;
        cleanup();
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip(`Attendly (Port ${PORT})`);
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
  } catch {}
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('get-tunnel-url', () => tunnelUrl);
ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

// ── Lifecycle & Startup ───────────────────────────────────────────────────────
app.whenReady().then(async () => {
  createSplashWindow();
  sendSplashStatus('Starting Attendly…');

  buildNativeMenu();
  setupTray();

  if (session?.defaultSession) {
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => callback(true));
    session.defaultSession.setPermissionCheckHandler(() => true);
  }

  // Docker Compose auto-start if docker is active
  ensureDockerCompose();

  // Port resolution
  PORT = await resolveUsablePort(PORT);
  SERVER_URL = `http://127.0.0.1:${PORT}`;

  // Next.js server readiness
  const isAlreadyReady = await checkServerReady(PORT, 400);
  if (!isAlreadyReady) {
    sendSplashStatus('Initializing local engine…');
    serverProcess = await startServer();

    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 400));
      if (await checkServerReady(PORT, 600)) break;
      sendSplashStatus(`Connecting to local engine (${i + 1}s)…`);
    }
  }

  // Cloudflare Worldwide Tunnel in background
  sendSplashStatus('Starting Cloudflare worldwide link…');
  tunnelProcess = startCloudflareTunnel();

  sendSplashStatus('Loading Attendly…');
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

function cleanup() {
  stopDockerCompose();
  if (isQuitting) return;
  isQuitting = true;
  console.log('[Electron] Cleaning up processes…');

  const cleanupPaths = [
    TUNNEL_FILE,
    path.join(os.tmpdir(), '.attendly_tunnel'),
    path.join(ROOT_DIR, '.tunnel_url'),
  ];
  for (const c of cleanupPaths) {
    try { if (fs.existsSync(c)) fs.unlinkSync(c); } catch {}
  }

  if (process.platform === 'win32') {
    try { execSync('taskkill /F /IM cloudflared.exe >nul 2>&1', { windowsHide: true }); } catch {}
  }
  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch {}
    tunnelProcess = null;
  }
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
    serverProcess = null;
  }
}

app.on('before-quit', cleanup);
app.on('window-all-closed', () => {
  cleanup();
  app.quit();
});

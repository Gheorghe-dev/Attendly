const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain, session } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, exec } = require('child_process');

// Disable hardware acceleration to eliminate Windows GPU process crash (exit code -1073741819 / 0xC0000005)
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('no-sandbox');

// Catch unhandled errors gracefully to eliminate Windows error dialog popups
process.on('uncaughtException', (err) => {
  console.error('[Electron] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Electron] Unhandled Rejection at:', promise, 'reason:', reason);
});

const ROOT_DIR = path.resolve(__dirname, '..');
const PORT = process.env.PORT || 3000;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

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

  if (app.isPackaged) {
    if (!fs.existsSync(targetDb)) {
      const candidates = [
        path.join(process.resourcesPath, 'prisma', 'dev.db'),
        path.join(process.resourcesPath, 'standalone', 'prisma', 'dev.db'),
        path.join(ROOT_DIR, 'prisma', 'dev.db'),
      ];
      for (const c of candidates) {
        if (fs.existsSync(c)) {
          try {
            fs.copyFileSync(c, targetDb);
            console.log('[Electron] Initialized user database from', c);
            break;
          } catch (e) {
            console.warn('[Electron] Could not seed database:', e.message);
          }
        }
      }
    }
    return `file:${targetDb}`;
  }

  // Development mode fallback
  return process.env.DATABASE_URL || `file:${path.join(ROOT_DIR, 'prisma', 'dev.db')}`;
}

// Set Application Name and Windows User Model ID
app.setName('Attendly');
if (process.platform === 'win32') {
  app.setAppUserModelId('com.attendly.app');
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

function checkServerReady(timeoutMs = 1500) {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/api/health`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 307 || res.statusCode === 302);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(timeoutMs, () => {
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
        exec(`lsof -ti:${port} | xargs kill -9 > /dev/null 2>&1`, execOpts, () => {
          resolve();
        });
      }
    } catch {
      resolve();
    }
  });
}

async function startServer() {
  const isRunning = await checkServerReady();
  if (isRunning) {
    console.log('[Electron] Server already running on port', PORT);
    return null;
  }

  await freePort(PORT);
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

  const proc = spawn(process.execPath, serverArgs, {
    cwd: serverCwd,
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '0.0.0.0',
      DATABASE_URL: dbUrl,
      ELECTRON_RUN_AS_NODE: '1', // Uses Electron's built-in Node runtime!
    },
  });

  proc.on('error', (err) => {
    console.error('[Electron] Next.js server failed to spawn:', err);
  });

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

function startCloudflareTunnel() {
  try {
    if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE);
  } catch {}

  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const candidateBins = [
    path.join(process.resourcesPath || '', 'bin', binName),
    path.join(getUserDataDir(), 'bin', binName),
    path.join(ROOT_DIR, 'bin', binName),
  ];

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
      console.log('[Electron] Launching bundled Cloudflare binary:', localBin);
      proc = spawn(localBin, ['tunnel', '--url', `http://127.0.0.1:${PORT}`], {
        cwd: getUserDataDir(),
        shell: false,
        windowsHide: true,
      });
    } else if (!app.isPackaged) {
      // In development only, allow falling back to npx
      const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      proc = spawn(cmd, ['--yes', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${PORT}`], {
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

      function handleData(data) {
        const str = data.toString();
        const match = str.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
        if (match && !tunnelUrl) {
          tunnelUrl = match[0];
          try {
            fs.writeFileSync(TUNNEL_FILE, tunnelUrl, 'utf-8');
          } catch {}
          console.log('[Electron] Worldwide Tunnel active:', tunnelUrl);
          updateTrayMenu();
        }
      }

      proc.stdout?.on('data', handleData);
      proc.stderr?.on('data', handleData);
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

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
      return { action: 'allow' };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('http://localhost') && !url.startsWith('http://127.0.0.1')) {
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
          label: 'Open in Chrome/Browser',
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
              detail: 'Version 0.1.0\nNext.js 14 + Electron Desktop Runtime\nZero-config local server & Cloudflare tunnel.\nDesigned for university lectures & labs.',
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
      label: currentTunnel ? `Tunnel: ${currentTunnel}` : 'Tunnel: Connecting…',
      enabled: Boolean(currentTunnel),
      click: () => {
        if (currentTunnel) shell.openExternal(currentTunnel);
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
      click: () => shell.openExternal(SERVER_URL),
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

  // If server is already active, launch main window immediately
  const isAlreadyReady = await checkServerReady(800);
  if (isAlreadyReady) {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.webContents.send('status-update', 'Connected! Loading Attendly…');
    }
    tunnelProcess = startCloudflareTunnel();
    createMainWindow();
    return;
  }

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', 'Checking server status…');
  }
  serverProcess = await startServer();

  if (splashWindow && !splashWindow.isDestroyed()) {
    splashWindow.webContents.send('status-update', 'Starting Cloudflare worldwide tunnel…');
  }
  tunnelProcess = startCloudflareTunnel();

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

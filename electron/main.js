const { app, BrowserWindow, Menu, Tray, nativeImage, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, exec } = require('child_process');

const PORT = 3000;
const SERVER_URL = `http://127.0.0.1:${PORT}`;
const TUNNEL_FILE = path.join(process.cwd(), '.tunnel_url');

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
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function checkServerReady(timeoutMs = 1200) {
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
    if (process.platform === 'win32') {
      exec(`for /f "tokens=5" %P in ('netstat -aon ^| findstr :${port} ^| findstr LISTENING 2^>nul') do taskkill /F /PID %P >nul 2>&1`, () => {
        resolve();
      });
    } else {
      exec(`lsof -ti:${port} | xargs kill -9 > /dev/null 2>&1`, () => {
        resolve();
      });
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

  const isProd = fs.existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'));
  const cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = isProd ? ['start'] : ['run', 'dev'];

  const proc = spawn(cmd, args, {
    cwd: process.cwd(),
    shell: true,
    windowsHide: true,
    env: { ...process.env, PORT: String(PORT) },
  });

  proc.stdout?.on('data', (d) => {
    const msg = d.toString();
    if (msg.includes('Ready') || msg.includes('Local:')) {
      splashWindow?.webContents?.send('status-update', 'Server is ready! Loading dashboard…');
    }
  });

  return proc;
}

function startCloudflareTunnel() {
  try {
    if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE);
  } catch {}

  const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const proc = spawn(cmd, ['--yes', 'cloudflared', 'tunnel', '--url', `http://localhost:${PORT}`], {
    shell: true,
    windowsHide: true,
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
  return proc;
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

function getAppIcon() {
  const icoPath = path.join(process.cwd(), 'src', 'app', 'favicon.ico');
  if (fs.existsSync(icoPath)) {
    return nativeImage.createFromPath(icoPath);
  }
  return undefined;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'QR Attendance System',
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

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.webContents.once('did-finish-load', () => {
    if (splashWindow) {
      splashWindow.close();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });
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
            const url = tunnelUrl || (fs.existsSync(TUNNEL_FILE) ? fs.readFileSync(TUNNEL_FILE, 'utf-8') : null);
            if (url) {
              const { clipboard } = require('electron');
              clipboard.writeText(url);
            }
          },
        },
        {
          label: 'Open Tunnel in Browser',
          click: () => {
            const url = tunnelUrl || (fs.existsSync(TUNNEL_FILE) ? fs.readFileSync(TUNNEL_FILE, 'utf-8') : null);
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
          label: 'Documentation (DOCS.md)',
          click: () => {
            const docsPath = path.join(process.cwd(), 'DOCS.md');
            if (fs.existsSync(docsPath)) shell.openPath(docsPath);
          },
        },
        {
          label: 'Open App Directory',
          click: () => shell.openPath(process.cwd()),
        },
        { type: 'separator' },
        {
          label: 'About QR Attendance System',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'QR Attendance System',
              message: 'QR Attendance System — Desktop Edition',
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
    { label: '🎓 QR Attendance Desktop', enabled: false },
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
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
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
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('QR Attendance System (Port 3000)');
}

function setupTray() {
  const icon = getAppIcon();
  if (!icon) return;

  try {
    tray = new Tray(icon);
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
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
  createSplashWindow();
  buildNativeMenu();
  setupTray();

  splashWindow?.webContents?.send('status-update', 'Checking server status…');
  serverProcess = await startServer();

  splashWindow?.webContents?.send('status-update', 'Starting Cloudflare worldwide tunnel…');
  tunnelProcess = startCloudflareTunnel();

  // Poll until Next.js is responding
  let ready = false;
  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    ready = await checkServerReady();
    if (ready) break;
    splashWindow?.webContents?.send('status-update', `Connecting to local engine (${i + 1}s)…`);
  }

  if (ready) {
    createMainWindow();
  } else {
    splashWindow?.webContents?.send('status-update', 'Server start timed out. Check console logs.');
    createMainWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    else mainWindow?.show();
  });
});

function cleanup() {
  isQuitting = true;
  console.log('[Electron] Cleaning up child processes…');
  try {
    if (fs.existsSync(TUNNEL_FILE)) fs.unlinkSync(TUNNEL_FILE);
  } catch {}
  if (tunnelProcess) {
    try { tunnelProcess.kill(); } catch {}
  }
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
  freePort(PORT);
}

app.on('before-quit', () => {
  cleanup();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    cleanup();
    app.quit();
  }
});

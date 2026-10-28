const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const iconPath = path.join(rootDir, 'attendly.ico');
const targetScript = path.join(rootDir, 'Launch-Attendly.vbs');

function resolveWindowsDesktopPaths() {
  const paths = new Set();
  try {
    const psDesktop = execSync('powershell -NoProfile -Command "[Environment]::GetFolderPath(\'Desktop\')"', {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    if (psDesktop && fs.existsSync(psDesktop)) {
      paths.add(psDesktop);
    }
  } catch {}

  const standardDesktop = path.join(os.homedir(), 'Desktop');
  if (fs.existsSync(standardDesktop)) {
    paths.add(standardDesktop);
  }

  const oneDriveDesktop = path.join(os.homedir(), 'OneDrive', 'Desktop');
  if (fs.existsSync(oneDriveDesktop)) {
    paths.add(oneDriveDesktop);
  }

  return Array.from(paths);
}

function resolveWindowsStartMenuPaths() {
  const paths = new Set();
  try {
    const psPrograms = execSync('powershell -NoProfile -Command "[Environment]::GetFolderPath(\'Programs\')"', {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).toString().trim();
    if (psPrograms && fs.existsSync(psPrograms)) {
      paths.add(psPrograms);
    }
  } catch {}

  if (process.env.APPDATA) {
    const standardPrograms = path.join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs');
    if (fs.existsSync(standardPrograms)) {
      paths.add(standardPrograms);
    }
  }

  return Array.from(paths);
}

function findInstalledWindowsBinary() {
  const candidates = [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'attendly', 'Attendly.exe') : null,
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Attendly', 'Attendly.exe') : null,
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'Attendly', 'Attendly.exe') : null,
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'Attendly', 'Attendly.exe') : null,
    path.join(rootDir, 'release', 'win-unpacked', 'Attendly.exe'),
    path.join(rootDir, 'Attendly.exe'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  return null;
}

function createWindowsShortcuts() {
  const desktopDirs = resolveWindowsDesktopPaths();
  const startMenuDirs = resolveWindowsStartMenuPaths();
  const targetDirs = new Set([...desktopDirs, ...startMenuDirs, rootDir]);

  const oldShortcuts = [
    'Attendly Web.lnk',
    'Attendly_web.lnk',
    'Attendly Desktop.lnk',
    'Attendly_desktop.lnk',
    'QR Attendance System.lnk',
  ];

  for (const dir of targetDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const old of oldShortcuts) {
      const p = path.join(dir, old);
      try {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      } catch {}
    }
  }

  const installedBinary = findInstalledWindowsBinary();
  let shortcutTarget = '';
  let shortcutArgs = '';
  let workingDir = '';
  let shortcutIcon = '';

  if (installedBinary) {
    shortcutTarget = installedBinary;
    shortcutArgs = '';
    workingDir = path.dirname(installedBinary);
    shortcutIcon = `${installedBinary},0`;
    console.log(`[Shortcuts] Found installed native binary: ${installedBinary}`);
  } else {
    shortcutTarget = 'wscript.exe';
    shortcutArgs = `"${targetScript}"`;
    workingDir = rootDir;
    shortcutIcon = fs.existsSync(iconPath) ? `${iconPath},0` : 'shell32.dll,14';
    console.log(`[Shortcuts] Pointing shortcut to zero-terminal launcher: ${targetScript}`);
  }

  const shortcutLocations = [];
  for (const d of desktopDirs) {
    shortcutLocations.push(path.join(d, 'Attendly.lnk'));
  }
  for (const sm of startMenuDirs) {
    shortcutLocations.push(path.join(sm, 'Attendly.lnk'));
  }
  shortcutLocations.push(path.join(rootDir, 'Attendly.lnk'));

  const tempVbs = path.join(os.tmpdir(), `create_attendly_shortcuts_${Date.now()}.vbs`);
  const vbsLines = [
    'Set WshShell = CreateObject("WScript.Shell")',
    ...shortcutLocations.map((loc) => `CreateSc "${loc.replace(/"/g, '""')}"`),
    '',
    'Sub CreateSc(scPath)',
    '  On Error Resume Next',
    '  Set sc = WshShell.CreateShortcut(scPath)',
    `  sc.TargetPath = "${shortcutTarget.replace(/"/g, '""')}"`,
    shortcutArgs ? `  sc.Arguments = "${shortcutArgs.replace(/"/g, '""')}"` : '  sc.Arguments = ""',
    `  sc.WorkingDirectory = "${workingDir.replace(/"/g, '""')}"`,
    '  sc.Description = "Attendly - Academic Attendance Platform"',
    `  sc.IconLocation = "${shortcutIcon.replace(/"/g, '""')}"`,
    '  sc.Save',
    '  On Error GoTo 0',
    'End Sub',
  ];

  fs.writeFileSync(tempVbs, vbsLines.join('\r\n'), 'utf-8');

  try {
    execSync(`cscript //nologo "${tempVbs}"`, { stdio: 'ignore', windowsHide: true });
    for (const d of desktopDirs) {
      console.log(`✓ Created desktop shortcut on Windows Desktop: ${path.join(d, 'Attendly.lnk')}`);
    }
    for (const sm of startMenuDirs) {
      console.log(`✓ Created Start Menu shortcut: ${path.join(sm, 'Attendly.lnk')}`);
    }
    console.log(`✓ Created shortcut in project root: ${path.join(rootDir, 'Attendly.lnk')}`);
  } catch (err) {
    console.error('Failed to create Windows shortcut:', err.message);
  } finally {
    try {
      if (fs.existsSync(tempVbs)) fs.unlinkSync(tempVbs);
    } catch {}
  }
}

function createMacShortcuts() {
  const desktopDir = path.join(os.homedir(), 'Desktop');
  const appPath = '/Applications/Attendly.app';
  const targetLink = path.join(desktopDir, 'Attendly');

  if (fs.existsSync(appPath)) {
    try {
      if (fs.existsSync(targetLink)) fs.unlinkSync(targetLink);
      fs.symlinkSync(appPath, targetLink);
      console.log(`✓ Created macOS desktop shortcut linking to /Applications/Attendly.app`);
    } catch (e) {
      console.warn(`Could not create macOS symlink: ${e.message}`);
    }
  } else {
    // If not installed to /Applications yet, create an executable Desktop command script
    const launcherScript = path.join(desktopDir, 'Attendly.command');
    const content = [
      '#!/usr/bin/env bash',
      `cd "${rootDir}"`,
      'if [ -f "release/mac*/Attendly.app/Contents/MacOS/Attendly" ]; then',
      '  open release/mac*/Attendly.app',
      'elif command -v electron >/dev/null 2>&1; then',
      '  electron .',
      'else',
      '  node scripts/start-internet.js',
      'fi',
    ].join('\n');

    try {
      fs.writeFileSync(launcherScript, content, { mode: 0o755 });
      console.log(`✓ Created macOS desktop launcher script: ${launcherScript}`);
    } catch (e) {
      console.warn(`Could not create macOS launcher: ${e.message}`);
    }
  }
}

function createLinuxShortcuts() {
  const desktopDir = path.join(os.homedir(), 'Desktop');
  const appDir = path.join(os.homedir(), '.local', 'share', 'applications');
  if (!fs.existsSync(appDir)) {
    try { fs.mkdirSync(appDir, { recursive: true }); } catch {}
  }

  let execTarget = '';
  // Look for AppImage or local Attendly binary
  const candidates = [
    '/usr/local/bin/attendly',
    path.join(os.homedir(), '.local', 'bin', 'attendly'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) { execTarget = c; break; }
  }

  if (!execTarget) {
    const appImages = fs.existsSync(path.join(rootDir, 'release'))
      ? fs.readdirSync(path.join(rootDir, 'release')).filter((f) => f.endsWith('.AppImage'))
      : [];
    if (appImages.length > 0) {
      execTarget = path.join(rootDir, 'release', appImages[0]);
    } else {
      execTarget = `node "${path.join(rootDir, 'scripts', 'start-internet.js')}"`;
    }
  }

  const iconTarget = fs.existsSync(path.join(rootDir, 'public', 'icon.png'))
    ? path.join(rootDir, 'public', 'icon.png')
    : 'applications-education';

  const desktopEntry = [
    '[Desktop Entry]',
    'Type=Application',
    'Name=Attendly',
    'GenericName=Attendance Management',
    'Comment=Attendly - Academic Attendance Platform',
    `Exec=${execTarget}`,
    `Icon=${iconTarget}`,
    'Terminal=false',
    'Categories=Education;Office;',
    'StartupNotify=true',
  ].join('\n');

  try {
    const desktopFile = path.join(desktopDir, 'Attendly.desktop');
    if (fs.existsSync(desktopDir)) {
      fs.writeFileSync(desktopFile, desktopEntry, { mode: 0o755 });
      execSync(`chmod +x "${desktopFile}" >/dev/null 2>&1 || true`);
      console.log(`✓ Created Linux desktop entry: ${desktopFile}`);
    }

    const appEntry = path.join(appDir, 'attendly.desktop');
    fs.writeFileSync(appEntry, desktopEntry, { mode: 0o755 });
    execSync(`chmod +x "${appEntry}" >/dev/null 2>&1 || true`);
    console.log(`✓ Registered Linux applications menu entry: ${appEntry}`);
  } catch (e) {
    console.warn(`Could not create Linux desktop entry: ${e.message}`);
  }
}

if (process.platform === 'win32') {
  createWindowsShortcuts();
} else if (process.platform === 'darwin') {
  createMacShortcuts();
} else {
  createLinuxShortcuts();
}

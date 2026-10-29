const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(os.homedir(), 'Desktop');
const iconPath = path.join(rootDir, 'attendly.ico');
const startScript = path.join(rootDir, 'Start-Container.bat');
const stopScript = path.join(rootDir, 'Stop-Container.bat');

// Clean up any old shortcuts
const oldShortcuts = [
  'Attendly Web.lnk',
  'Attendly_web.lnk',
  'Attendly Desktop.lnk',
  'Attendly_desktop.lnk',
  'QR Attendance System.lnk',
];

for (const dir of [desktopDir, rootDir]) {
  if (!fs.existsSync(dir)) continue;
  for (const old of oldShortcuts) {
    const p = path.join(dir, old);
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }
}

// Detect native Attendly.exe executable for direct, zero-CMD launching with loading screen
const candidateExes = [
  path.join(rootDir, 'release', 'win-unpacked', 'Attendly.exe'),
  path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Attendly', 'Attendly.exe'),
];

let nativeExe = null;
let newestTime = 0;
for (const exe of candidateExes) {
  if (fs.existsSync(exe)) {
    const mtime = fs.statSync(exe).mtimeMs;
    if (mtime > newestTime) {
      newestTime = mtime;
      nativeExe = exe;
    }
  }
}

const vbsLauncher = path.join(rootDir, 'Attendly.vbs');
const launchTarget = nativeExe || vbsLauncher;
const launchArgs = '';
const launchIcon = nativeExe ? `${nativeExe},0` : `${iconPath},0`;

// Generate Attendly Desktop Shortcuts
const tempVbs = path.join(os.tmpdir(), `create_attendly_shortcut_${Date.now()}.vbs`);
const vbsLines = [
  'Set WshShell = CreateObject("WScript.Shell")',
  `CreateSc "${path.join(desktopDir, 'Attendly.lnk')}", "${launchTarget}", "${launchArgs}", "Launch Attendly", "${launchIcon}"`,
  `CreateSc "${path.join(desktopDir, 'Stop Attendly.lnk')}", "${stopScript}", "", "Stop Attendly Container Server", "${iconPath},0"`,
  `CreateSc "${path.join(rootDir, 'Attendly.lnk')}", "${launchTarget}", "${launchArgs}", "Launch Attendly", "${launchIcon}"`,
  `CreateSc "${path.join(rootDir, 'Stop Attendly.lnk')}", "${stopScript}", "", "Stop Attendly Container Server", "${iconPath},0"`,
  '',
  'Sub CreateSc(scPath, targetPath, args, desc, icon)',
  '  Set sc = WshShell.CreateShortcut(scPath)',
  '  sc.TargetPath = targetPath',
  '  sc.Arguments = args',
  `  sc.WorkingDirectory = "${rootDir}"`,
  '  sc.Description = desc',
  '  sc.IconLocation = icon',
  '  sc.Save',
  'End Sub',
];

fs.writeFileSync(tempVbs, vbsLines.join('\r\n'), 'utf-8');

try {
  execSync(`cscript //nologo "${tempVbs}"`, { stdio: 'inherit' });
  console.log(`✓ Created desktop shortcut on Windows Desktop: ${path.join(desktopDir, 'Attendly.lnk')}`);
  console.log(`✓ Created stop shortcut on Windows Desktop: ${path.join(desktopDir, 'Stop Attendly.lnk')}`);
} catch (err) {
  console.error('Failed to create shortcut:', err.message);
} finally {
  try {
    if (fs.existsSync(tempVbs)) fs.unlinkSync(tempVbs);
  } catch {}
}

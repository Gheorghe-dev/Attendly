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

// Generate Attendly Desktop Shortcuts
const tempVbs = path.join(os.tmpdir(), `create_attendly_shortcut_${Date.now()}.vbs`);
const vbsLines = [
  'Set WshShell = CreateObject("WScript.Shell")',
  `CreateSc "${path.join(desktopDir, 'Attendly.lnk')}", "${startScript}", "Launch Attendly Container Server with Cloudflare"`,
  `CreateSc "${path.join(desktopDir, 'Stop Attendly.lnk')}", "${stopScript}", "Stop Attendly Container Server"`,
  `CreateSc "${path.join(rootDir, 'Attendly.lnk')}", "${startScript}", "Launch Attendly Container Server with Cloudflare"`,
  `CreateSc "${path.join(rootDir, 'Stop Attendly.lnk')}", "${stopScript}", "Stop Attendly Container Server"`,
  '',
  'Sub CreateSc(scPath, targetPath, desc)',
  '  Set sc = WshShell.CreateShortcut(scPath)',
  '  sc.TargetPath = targetPath',
  '  sc.Arguments = ""',
  `  sc.WorkingDirectory = "${rootDir}"`,
  '  sc.Description = desc',
  `  sc.IconLocation = "${iconPath},0"`,
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

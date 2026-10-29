const { execSync } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const rootDir = path.resolve(__dirname, '..');
const desktopDir = path.join(os.homedir(), 'Desktop');
const iconPath = path.join(rootDir, 'attendly.ico');
const targetScript = path.join(rootDir, 'Launch-Attendly.vbs');

// Clean up any old / web shortcuts
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

// Generate the single Attendly (Electron) shortcut
const tempVbs = path.join(os.tmpdir(), `create_attendly_shortcut_${Date.now()}.vbs`);
const vbsLines = [
  'Set WshShell = CreateObject("WScript.Shell")',
  `CreateSc "${path.join(desktopDir, 'Attendly.lnk')}"`,
  `CreateSc "${path.join(rootDir, 'Attendly.lnk')}"`,
  '',
  'Sub CreateSc(scPath)',
  '  Set sc = WshShell.CreateShortcut(scPath)',
  '  sc.TargetPath = "wscript.exe"',
  `  sc.Arguments = """${targetScript}"""`,
  `  sc.WorkingDirectory = "${rootDir}"`,
  '  sc.Description = "Attendly - Academic Attendance Platform (Desktop Electron Edition)"',
  `  sc.IconLocation = "${iconPath},0"`,
  '  sc.Save',
  'End Sub',
];

fs.writeFileSync(tempVbs, vbsLines.join('\r\n'), 'utf-8');

try {
  execSync(`cscript //nologo "${tempVbs}"`, { stdio: 'inherit' });
  console.log(`✓ Created single Electron desktop shortcut on Windows Desktop: ${path.join(desktopDir, 'Attendly.lnk')}`);
  console.log(`✓ Created single Electron desktop shortcut in project folder: ${path.join(rootDir, 'Attendly.lnk')}`);
} catch (err) {
  console.error('Failed to create shortcut:', err.message);
} finally {
  try {
    if (fs.existsSync(tempVbs)) fs.unlinkSync(tempVbs);
  } catch {}
}

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

interface InstallerItem {
  name: string;
  category: 'windows' | 'mac-arm64' | 'mac-intel' | 'linux-appimage' | 'linux-deb' | 'script' | 'other';
  label: string;
  sizeBytes: number;
  sizeFormatted: string;
  downloadUrl: string;
  updatedAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function categorizeInstaller(name: string): { category: InstallerItem['category']; label: string } {
  const lower = name.toLowerCase();
  if (lower.endsWith('.exe')) {
    return { category: 'windows', label: 'Windows (64-bit Installer)' };
  }
  if (lower.includes('arm64') && lower.endsWith('.dmg')) {
    return { category: 'mac-arm64', label: 'macOS Apple Silicon (M1/M2/M3/M4)' };
  }
  if (lower.endsWith('.dmg')) {
    return { category: 'mac-intel', label: 'macOS Intel (x64)' };
  }
  if (lower.endsWith('.appimage')) {
    return { category: 'linux-appimage', label: 'Linux (Universal AppImage)' };
  }
  if (lower.endsWith('.deb')) {
    return { category: 'linux-deb', label: 'Linux Debian / Ubuntu (.deb)' };
  }
  if (lower.endsWith('.bat')) {
    return { category: 'script', label: 'Windows Automated 1-Click Script' };
  }
  if (lower.endsWith('.command')) {
    return { category: 'script', label: 'macOS Automated 1-Click Script' };
  }
  return { category: 'other', label: name };
}

export async function GET() {
  const candidateDirs = [
    '/var/www/downloads',
    path.join(process.cwd(), 'release'),
    path.join(process.cwd(), 'downloads'),
  ];

  const foundFiles = new Map<string, InstallerItem>();

  for (const dir of candidateDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (
          entry.startsWith('.') ||
          entry.endsWith('.tmp') ||
          entry.endsWith('.blockmap') ||
          entry.includes('__uninstaller') ||
          entry.endsWith('.yml') ||
          entry === 'win-unpacked' ||
          entry === 'mac' ||
          entry === 'mac-arm64' ||
          entry === 'mac-universal'
        ) {
          continue;
        }

        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (!stat.isFile()) continue;

        const { category, label } = categorizeInstaller(entry);
        if (!foundFiles.has(entry)) {
          foundFiles.set(entry, {
            name: entry,
            category,
            label,
            sizeBytes: stat.size,
            sizeFormatted: formatBytes(stat.size),
            downloadUrl: `/downloads/${encodeURIComponent(entry)}`,
            updatedAt: stat.mtime.toISOString(),
          });
        }
      }
    } catch {}
  }

  // Also check root scripts in current directory
  const rootScripts = ['Install-Attendly-Windows.bat', 'Install-Attendly-Mac.command'];
  for (const script of rootScripts) {
    const fullPath = path.join(process.cwd(), script);
    if (fs.existsSync(fullPath) && !foundFiles.has(script)) {
      try {
        const stat = fs.statSync(fullPath);
        const { category, label } = categorizeInstaller(script);
        foundFiles.set(script, {
          name: script,
          category,
          label,
          sizeBytes: stat.size,
          sizeFormatted: formatBytes(stat.size),
          downloadUrl: `/downloads/${encodeURIComponent(script)}`,
          updatedAt: stat.mtime.toISOString(),
        });
      } catch {}
    }
  }

  return NextResponse.json({
    installers: Array.from(foundFiles.values()),
    count: foundFiles.size,
    githubReleaseUrl: 'https://github.com/Gheorghe-dev/Attendly/releases/latest',
  });
}

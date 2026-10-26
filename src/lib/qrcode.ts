import QRCode from 'qrcode';
import os from 'os';
import fs from 'fs';
import path from 'path';

let memoryTunnelUrl: string | null = null;

export function setMemoryTunnelUrl(url: string | null) {
  memoryTunnelUrl = url;
}

export function getTunnelUrl(): string | null {
  if (process.env.NODE_ENV === 'test') return null;

  // 1. In-memory cached URL (fastest & most up-to-date)
  if (memoryTunnelUrl && memoryTunnelUrl.startsWith('http')) {
    return memoryTunnelUrl;
  }

  // 2. Direct environment variable
  if (process.env.PUBLIC_TUNNEL_URL?.startsWith('http')) {
    return process.env.PUBLIC_TUNNEL_URL.trim();
  }
  if (process.env.TUNNEL_URL?.startsWith('http')) {
    return process.env.TUNNEL_URL.trim();
  }

  // 3. Scan candidate disk paths across Windows, macOS, and Linux
  const candidates: string[] = [
    path.join(process.cwd(), '.tunnel_url'),
    path.join(process.cwd(), '..', '.tunnel_url'),
  ];

  try {
    const home = os.homedir();
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      candidates.push(path.join(appData, 'Attendly', '.tunnel_url'));
    } else if (process.platform === 'darwin') {
      candidates.push(path.join(home, 'Library', 'Application Support', 'Attendly', '.tunnel_url'));
    } else {
      candidates.push(path.join(home, '.config', 'Attendly', '.tunnel_url'));
    }
  } catch {}

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const stat = fs.statSync(p);
        const ageHours = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60);
        if (ageHours <= 24) {
          const content = fs.readFileSync(p, 'utf-8').trim();
          if (content && content.startsWith('http')) {
            memoryTunnelUrl = content;
            return content;
          }
        }
      }
    } catch {}
  }

  return null;
}

export function getLocalIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  const candidates: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /virtual|vbox|vmnet|pseudo|docker|wsl|loopback/i.test(name);
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (!isVirtual) {
          candidates.unshift(iface.address);
        } else {
          candidates.push(iface.address);
        }
      }
    }
  }

  return candidates[0] || null;
}

export function isLocalUrl(url?: string): boolean {
  if (!url) return true;
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(url.trim());
}

/**
 * Pick the best base URL for QR codes.
 * 1. If accessed from a non-localhost origin (e.g. public tunnel like trycloudflare.com), use it.
 * 2. If a worldwide tunnel is active (.tunnel_url), use it so any phone on 4G/any internet can scan.
 * 3. If APP_URL is explicitly configured to a non-localhost address, use it.
 * 4. If accessed from localhost and no tunnel is active, auto-detect physical LAN IPv4.
 * 5. Fall back to APP_URL, forceOrigin, or localhost.
 */
export function pickBaseUrl(forceOrigin?: string): string {
  if (forceOrigin && !isLocalUrl(forceOrigin)) {
    return forceOrigin.replace(/\/+$/, '');
  }

  const tunnel = getTunnelUrl();
  if (tunnel) {
    return tunnel.replace(/\/+$/, '');
  }

  const app = process.env.APP_URL?.trim();
  if (app && !isLocalUrl(app)) {
    return app.replace(/\/+$/, '');
  }

  const lanIp = getLocalIpAddress();
  if (lanIp) {
    const port = process.env.PORT || '3000';
    return `http://${lanIp}:${port}`;
  }

  if (app) return app.replace(/\/+$/, '');
  if (forceOrigin) return forceOrigin.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

/**
 * Generates high-resolution Base64 PNG data URL with pure black on pure white
 * and a strict quiet zone margin of 4 modules.
 */
export async function generateQRCodeDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'M',
    margin: 4,
    width: 640,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Generates crisp SVG string for high-DPI projection screens.
 */
export async function generateQRCodeSVG(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' },
  });
}

/**
 * Build the attendance URL for a session token.
 */
export function getAttendanceUrl(token: string, forceOrigin?: string): string {
  return `${pickBaseUrl(forceOrigin)}/attend/${token}`;
}

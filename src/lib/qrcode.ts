import QRCode from 'qrcode';
import os from 'os';
import fs from 'fs';
import path from 'path';

let memoryTunnelUrl: string | null = null;

export function setMemoryTunnelUrl(url: string | null) {
  memoryTunnelUrl = url;
}

export function getTunnelUrl(): string | null {
  // 1. In-memory cached URL (fastest & most up-to-date)
  if (memoryTunnelUrl && memoryTunnelUrl.startsWith('http')) {
    return memoryTunnelUrl;
  }

  if (process.env.NODE_ENV === 'test') return null;

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
    path.join(process.cwd(), '..', '..', '.tunnel_url'),
  ];

  try {
    const home = os.homedir();
    const tmp = os.tmpdir();

    // Cross-process temp/home indicators
    candidates.push(path.join(tmp, '.attendly_tunnel'));
    candidates.push(path.join(home, '.attendly_tunnel'));

    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
      candidates.push(path.join(appData, 'Attendly', '.tunnel_url'));
      candidates.push(path.join(localAppData, 'Attendly', '.tunnel_url'));
    } else if (process.platform === 'darwin') {
      candidates.push(path.join(home, 'Library', 'Application Support', 'Attendly', '.tunnel_url'));
    } else {
      candidates.push(path.join(home, '.config', 'Attendly', '.tunnel_url'));
    }

    const procAny = process as unknown as { resourcesPath?: string };
    if (procAny.resourcesPath) {
      candidates.push(path.join(procAny.resourcesPath, 'standalone', '.tunnel_url'));
      candidates.push(path.join(procAny.resourcesPath, 'bin', '.tunnel_url'));
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

/**
 * Asynchronously wait up to maxWaitMs for the Cloudflare tunnel URL to finish handshaking.
 */
export async function waitForTunnelUrl(maxWaitMs = 1500): Promise<string | null> {
  const existing = getTunnelUrl();
  if (existing) return existing;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 200));
    const found = getTunnelUrl();
    if (found) return found;
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
 * Returns true if the URL points to localhost, loopback, or private RFC1918 subnets
 * (e.g. 192.168.x.x, 10.x.x.x, 172.16-31.x.x) which are inaccessible across different
 * Wi-Fi networks or cellular connections.
 */
export function isPrivateOrLocalUrl(url?: string): boolean {
  if (!url) return true;
  const clean = url.trim();
  if (isLocalUrl(clean)) return true;
  try {
    const parsed = new URL(clean.startsWith('http') ? clean : `http://${clean}`);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host.startsWith('10.')) return true;
    if (host.startsWith('192.168.')) return true;
    if (host.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    if (host.endsWith('.local') || host.endsWith('.internal')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Pick the best base URL for QR codes.
 * 1. If a worldwide tunnel (e.g. https://*.trycloudflare.com) is active, ALWAYS use it!
 *    This ensures that students can scan and attend from ANY Wi-Fi (university, eduroam, guest)
 *    and cellular (4G/5G) connections without being blocked by AP client isolation or firewalls.
 * 2. If APP_URL is configured to a non-private public domain, use it.
 * 3. If accessed from an external public domain (reverse proxy), use it.
 * 4. Fall back to local LAN IP or localhost when offline / before tunnel handshake finishes.
 */
export function pickBaseUrl(forceOrigin?: string): string {
  // 1. Worldwide tunnel is #1 top priority for attendance QR codes
  const tunnel = getTunnelUrl();
  if (tunnel) {
    return tunnel.replace(/\/+$/, '');
  }

  // 2. Explicit public domain via APP_URL (if not local or private LAN)
  const app = process.env.APP_URL?.trim();
  if (app && !isPrivateOrLocalUrl(app)) {
    return app.replace(/\/+$/, '');
  }

  // 3. If accessed from a public non-private domain, use it
  if (forceOrigin && !isPrivateOrLocalUrl(forceOrigin)) {
    return forceOrigin.replace(/\/+$/, '');
  }

  // 4. LAN IP fallback when offline or before tunnel connects
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

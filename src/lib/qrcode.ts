import QRCode from 'qrcode';
import os from 'os';
import path from 'path';
import fs from 'fs';

let memoryTunnelUrl: string | null = null;

export function setMemoryTunnelUrl(url: string | null): void {
  memoryTunnelUrl = url && url.startsWith('http') ? url.trim() : null;
}

export function invalidateTunnelUrl(): void {
  memoryTunnelUrl = null;
  cleanCandidateTunnelFiles();
}

export function cleanCandidateTunnelFiles(): void {
  const candidates = [
    path.join(process.cwd(), '.tunnel_url'),
    path.join(os.tmpdir(), '.attendly_tunnel'),
    path.join(os.homedir(), '.attendly_tunnel'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {}
  }
}

export function getTunnelUrl(): string | null {
  // 1. In-memory cached URL (fastest)
  if (memoryTunnelUrl && memoryTunnelUrl.startsWith('http')) {
    return memoryTunnelUrl;
  }

  // 2. Environment variables
  const envUrl = process.env.PUBLIC_TUNNEL_URL || process.env.TUNNEL_URL;
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.trim();
  }

  // In test mode, don't read leftover disk files from previous runs
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  // 3. Candidate files on disk (.tunnel_url in current directory or temp)
  const candidateFiles = [
    path.join(process.cwd(), '.tunnel_url'),
    path.join(os.tmpdir(), '.attendly_tunnel'),
  ];

  for (const file of candidateFiles) {
    try {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf-8').trim();
        if (content && content.startsWith('http')) {
          memoryTunnelUrl = content;
          return content;
        }
      }
    } catch {}
  }

  return null;
}

/**
 * Asynchronously wait up to maxWaitMs for the Cloudflare tunnel URL to finish handshaking.
 * Resolves as soon as the tunnel URL is available without blocking unnecessary time.
 */
export async function waitForTunnelUrl(maxWaitMs = 1500): Promise<string | null> {
  const immediate = getTunnelUrl();
  if (immediate) return immediate;

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 150));
    const found = getTunnelUrl();
    if (found) return found;
  }
  return null;
}

export function stopCloudflareTunnel(): void {
  invalidateTunnelUrl();
}

export function ensureCloudflareTunnel(): void {
  // Handled transparently by desktop runtime (Electron) or container (docker-entrypoint)
}

/**
 * Resolves the primary local network IPv4 address.
 */
export function getLocalIpAddress(): string | null {
  try {
    const interfaces = os.networkInterfaces();
    let fallback: string | null = null;

    for (const name of Object.keys(interfaces)) {
      const isVirtual = /virtual|vbox|vmnet|docker|wsl|loopback/i.test(name);
      const isWifi = /wi-fi|wlan|wireless|airport/i.test(name);

      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          if (isWifi) return iface.address;
          if (!isVirtual && !fallback) fallback = iface.address;
          else if (!fallback) fallback = iface.address;
        }
      }
    }
    return fallback;
  } catch {
    return null;
  }
}

export function getLocalHostBaseUrl(): string {
  const lanIp = getLocalIpAddress();
  const port = process.env.PORT || '3000';
  return lanIp ? `http://${lanIp}:${port}` : `http://127.0.0.1:${port}`;
}

export function isLocalUrl(url?: string): boolean {
  if (!url) return true;
  return /^(https?:\/\/)?(localhost|127\.0\.0\.1)(:\d+)?(\/.*)?$/i.test(url.trim());
}

/**
 * Returns true if the URL points to localhost, loopback, or private RFC1918 subnets.
 */
export function isPrivateOrLocalUrl(url?: string): boolean {
  if (!url) return true;
  const clean = url.trim();
  if (isLocalUrl(clean)) return true;
  try {
    const parsed = new URL(clean.startsWith('http') ? clean : `http://${clean}`);
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    if (host.startsWith('10.') || host.startsWith('192.168.') || host.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
    if (host.endsWith('.local') || host.endsWith('.internal')) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Pick the best base URL for QR codes:
 * 1. Active worldwide tunnel URL (e.g. trycloudflare.com)
 * 2. Public APP_URL (e.g. custom domain)
 * 3. Non-localhost request origin
 * 4. Local LAN IP
 * 5. Localhost fallback
 */
export function pickBaseUrl(forceOrigin?: string): string {
  const tunnel = getTunnelUrl();
  if (tunnel) return tunnel.replace(/\/+$/, '');

  const app = process.env.APP_URL?.trim();
  if (app && !isLocalUrl(app)) return app.replace(/\/+$/, '');

  if (forceOrigin && !isLocalUrl(forceOrigin)) return forceOrigin.replace(/\/+$/, '');

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
 * Generates high-resolution Base64 PNG data URL.
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
 * Generates SVG string for projection screens.
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

import QRCode from 'qrcode';
import os from 'os';
import fs from 'fs';
import path from 'path';

export function getTunnelUrl(): string | null {
  if (process.env.NODE_ENV === 'test') return null;
  try {
    const p = path.join(process.cwd(), '.tunnel_url');
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, 'utf-8').trim();
      if (content && content.startsWith('http')) return content;
    }
  } catch {}
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

export async function generateQRCodeDataURL(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 400,
    color: { dark: '#1e3a5f', light: '#ffffff' },
  });
}

/**
 * Build the attendance URL for a session token.
 */
export function getAttendanceUrl(token: string, forceOrigin?: string): string {
  return `${pickBaseUrl(forceOrigin)}/attend/${token}`;
}

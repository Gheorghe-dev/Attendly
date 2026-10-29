import QRCode from 'qrcode';
import os from 'os';
import path from 'path';

declare const __non_webpack_require__: ((id: string) => typeof import('fs')) | undefined;

function getRuntimeFs(): typeof import('fs') | null {
  try {
    if (typeof __non_webpack_require__ !== 'undefined') {
      return __non_webpack_require__('fs');
    }
    if (typeof window === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const dynamicRequire = eval('require') as (id: string) => typeof import('fs');
      return dynamicRequire('fs');
    }
  } catch {}
  return null;
}

let memoryTunnelUrl: string | null = null;

export function setMemoryTunnelUrl(url: string | null) {
  memoryTunnelUrl = url;
}

export function getCandidateTunnelFilePaths(): string[] {
  if (typeof window !== 'undefined' || process.env.NEXT_PHASE?.includes('build') || process.env.CI) {
    return [];
  }
  const candidates: string[] = [
    path.join(process.cwd(), '.tunnel_url'),
    path.join(process.cwd(), '..', '.tunnel_url'),
    path.join(process.cwd(), '..', '..', '.tunnel_url'),
  ];

  try {
    const home = os.homedir();
    const tmp = os.tmpdir();

    candidates.push(path.join(tmp, '.attendly_tunnel'));
    candidates.push(path.join(home, '.attendly_tunnel'));

    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
      candidates.push(path.join(appData, 'Attendly', '.tunnel_url'));
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

  return candidates;
}

export function cleanCandidateTunnelFiles(): void {
  const fsMod = getRuntimeFs();
  if (!fsMod) return;
  const paths = getCandidateTunnelFilePaths();
  for (const p of paths) {
    try {
      if (fsMod.existsSync(p)) {
        fsMod.unlinkSync(p);
      }
    } catch {}
  }
}

export function invalidateTunnelUrl(): void {
  memoryTunnelUrl = null;
  cleanCandidateTunnelFiles();
}

export function isCloudflaredProcessRunning(): boolean {
  if (activeTunnelProc && activeTunnelProc.exitCode === null && !activeTunnelProc.killed) {
    return true;
  }
  if (process.env.CLOUDFLARE_TUNNEL_ACTIVE === 'true') {
    return true;
  }
  const cpMod = getRuntimeChildProcess();
  if (!cpMod) return false;
  try {
    if (process.platform === 'win32') {
      const out = cpMod.execSync('tasklist', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        windowsHide: true,
        timeout: 1000,
      });
      return out.toLowerCase().includes('cloudflared.exe');
    } else {
      const out = cpMod.execSync('pgrep cloudflared || pidof cloudflared || true', {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1000,
      });
      return out.trim().length > 0;
    }
  } catch {
    return false;
  }
}

export async function isTunnelUrlAlive(url?: string | null, timeoutMs = 2500): Promise<boolean> {
  if (!url || !url.startsWith('http')) return false;
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(`${url.replace(/\/+$/, '')}/api/health`, {
      method: 'GET',
      headers: { 'Cache-Control': 'no-cache' },
      signal: ctrl.signal,
    });
    clearTimeout(id);
    // Cloudflare HTTP 530 indicates Error 1033 (dead / unregistered tunnel)
    return res.status !== 530 && res.status !== 531;
  } catch {
    return false;
  }
}

export function getTunnelUrl(): string | null {
  if (process.env.NODE_ENV === 'test') {
    return memoryTunnelUrl || process.env.PUBLIC_TUNNEL_URL?.trim() || process.env.TUNNEL_URL?.trim() || null;
  }

  // 1. In-memory cached URL (fastest & most up-to-date)
  if (memoryTunnelUrl && memoryTunnelUrl.startsWith('http')) {
    if (memoryTunnelUrl.includes('trycloudflare.com') && !isCloudflaredProcessRunning()) {
      invalidateTunnelUrl();
      return null;
    }
    return memoryTunnelUrl;
  }

  // 2. Direct environment variable
  if (process.env.PUBLIC_TUNNEL_URL?.startsWith('http')) {
    return process.env.PUBLIC_TUNNEL_URL.trim();
  }
  if (process.env.TUNNEL_URL?.startsWith('http')) {
    return process.env.TUNNEL_URL.trim();
  }

  // If cloudflared is not running, any ephemeral quick tunnel file is dead
  if (!isCloudflaredProcessRunning()) {
    cleanCandidateTunnelFiles();
    return null;
  }

  // 3. Scan candidate disk paths across Windows, macOS, and Linux
  const candidates = getCandidateTunnelFilePaths();
  const fsMod = getRuntimeFs();
  if (!fsMod) return null;

  for (const p of candidates) {
    try {
      if (fsMod.existsSync(p)) {
        const stat = fsMod.statSync(p);
        const ageMinutes = (Date.now() - stat.mtimeMs) / (1000 * 60);
        if (ageMinutes <= 15) {
          const content = fsMod.readFileSync(p, 'utf-8').trim();
          if (content && content.startsWith('http')) {
            memoryTunnelUrl = content;
            return content;
          }
        } else {
          try { fsMod.unlinkSync(p); } catch {}
        }
      }
    } catch {}
  }

  return null;
}

function getRuntimeChildProcess(): typeof import('child_process') | null {
  try {
    if (typeof __non_webpack_require__ !== 'undefined') {
      return (__non_webpack_require__ as unknown as (id: string) => typeof import('child_process'))('child_process');
    }
    if (typeof window === 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const dynamicRequire = eval('require') as (id: string) => typeof import('child_process');
      return dynamicRequire('child_process');
    }
  } catch {}
  return null;
}

let activeTunnelProc: import('child_process').ChildProcess | null = null;
let isStartingTunnel = false;

export function stopCloudflareTunnel(): void {
  if (activeTunnelProc) {
    try {
      activeTunnelProc.kill();
    } catch {}
    activeTunnelProc = null;
  }
  isStartingTunnel = false;
  invalidateTunnelUrl();
}

export function ensureCloudflareTunnel(): void {
  if (process.env.NODE_ENV === 'test') return;
  if (isStartingTunnel) return;
  if (memoryTunnelUrl && isCloudflaredProcessRunning()) return;

  const fsMod = getRuntimeFs();
  const cpMod = getRuntimeChildProcess();
  if (!cpMod) return;

  const binName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const binCandidates = [
    path.join(process.cwd(), 'bin', binName),
    path.join(process.cwd(), '..', 'bin', binName),
    path.join(process.cwd(), '..', '..', 'bin', binName),
    path.join(process.cwd(), '..', '..', '..', 'bin', binName),
  ];
  if (process.platform === 'win32') {
    binCandidates.push(path.join(process.env.APPDATA || '', 'Attendly', 'bin', binName));
  }
  const procAny = process as unknown as { resourcesPath?: string };
  if (procAny.resourcesPath) {
    binCandidates.unshift(path.join(procAny.resourcesPath, 'bin', binName));
  }

  let localBin: string | null = null;
  if (fsMod) {
    for (const b of binCandidates) {
      try {
        if (fsMod.existsSync(b)) {
          localBin = b;
          break;
        }
      } catch {}
    }
  }

  isStartingTunnel = true;
  const port = process.env.PORT || '3000';
  console.log('[QR/Cloudflare] Activating Cloudflare worldwide tunnel for QR code scans...');

  try {
    let proc: import('child_process').ChildProcess | null = null;
    if (localBin) {
      proc = cpMod.spawn(localBin, ['tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate', '--protocol', 'http2'], {
        windowsHide: true,
        shell: false,
      });
    } else {
      const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      proc = cpMod.spawn(npxCmd, ['--yes', 'cloudflared', 'tunnel', '--url', `http://127.0.0.1:${port}`, '--no-autoupdate', '--protocol', 'http2'], {
        windowsHide: true,
        shell: true,
      });
    }

    activeTunnelProc = proc;

    const cleanupActiveTunnel = () => {
      isStartingTunnel = false;
      activeTunnelProc = null;
      invalidateTunnelUrl();
    };

    let buffer = '';
    const onData = (chunk: Buffer | string) => {
      buffer += chunk.toString();
      const match = buffer.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match && !memoryTunnelUrl) {
        const url = match[0].trim();
        memoryTunnelUrl = url;
        isStartingTunnel = false;
        console.log('[QR/Cloudflare] Worldwide Cloudflare Tunnel active for QR codes:', url);
        if (fsMod) {
          const writeCandidatePaths = [
            path.join(process.cwd(), '.tunnel_url'),
            path.join(os.tmpdir(), '.attendly_tunnel'),
            path.join(os.homedir(), '.attendly_tunnel'),
          ];
          for (const p of writeCandidatePaths) {
            try { fsMod.writeFileSync(p, url, 'utf-8'); } catch {}
          }
        }
      }
    };

    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('close', cleanupActiveTunnel);
    proc.on('exit', cleanupActiveTunnel);
    proc.on('error', (err: Error) => {
      console.warn('[QR/Cloudflare] Could not launch cloudflared process:', err.message);
      cleanupActiveTunnel();
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[QR/Cloudflare] Launch error:', msg);
    isStartingTunnel = false;
    activeTunnelProc = null;
    invalidateTunnelUrl();
  }
}

/**
 * Asynchronously wait up to maxWaitMs for the Cloudflare tunnel URL to finish handshaking.
 */
export async function waitForTunnelUrl(maxWaitMs = 4000): Promise<string | null> {
  const existing = getTunnelUrl();
  if (existing) {
    if (existing.includes('trycloudflare.com')) {
      const alive = await isTunnelUrlAlive(existing, 1500);
      if (alive) return existing;
      invalidateTunnelUrl();
    } else {
      return existing;
    }
  }

  // Trigger tunnel startup if not already running
  ensureCloudflareTunnel();

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    await new Promise((r) => setTimeout(r, 250));
    const found = getTunnelUrl();
    if (found) return found;
  }
  return null;
}

export function getLocalIpAddress(): string | null {
  const interfaces = os.networkInterfaces();
  const wifiCandidates: string[] = [];
  const physicalCandidates: string[] = [];
  const virtualCandidates: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /virtual|vbox|vmnet|pseudo|docker|wsl|loopback/i.test(name);
    const isWifi = /wi-fi|wlan|wireless|airport/i.test(name);

    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        if (iface.address.startsWith('192.168.56.')) {
          virtualCandidates.push(iface.address);
        } else if (isWifi) {
          wifiCandidates.push(iface.address);
        } else if (!isVirtual) {
          physicalCandidates.push(iface.address);
        } else {
          virtualCandidates.push(iface.address);
        }
      }
    }
  }

  return wifiCandidates[0] || physicalCandidates[0] || virtualCandidates[0] || null;
}

export function getLocalHostBaseUrl(): string {
  const lanIp = getLocalIpAddress();
  const port = process.env.PORT || '3000';
  if (lanIp) {
    return `http://${lanIp}:${port}`;
  }
  return `http://127.0.0.1:${port}`;
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

  // 2. Explicit domain or LAN IP via APP_URL (e.g. from .env) if not localhost
  const app = process.env.APP_URL?.trim();
  if (app && !isLocalUrl(app)) {
    return app.replace(/\/+$/, '');
  }

  // 3. If accessed from a non-localhost origin (e.g. LAN IP or domain), use it
  if (forceOrigin && !isLocalUrl(forceOrigin)) {
    return forceOrigin.replace(/\/+$/, '');
  }

  // 4. Auto-detected LAN IP fallback when offline or before tunnel connects
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

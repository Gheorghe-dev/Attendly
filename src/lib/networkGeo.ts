import dns from 'dns';

export interface GeoPoint {
  lat: number;
  lng: number;
  city?: string;
}

/**
 * Resolves approximate coordinates via academic reverse DNS or public IP.
 * Used as seamless fallback so distance can be calculated even when GPS is disabled.
 */
export async function detectIpCoordinates(clientIp?: string | null): Promise<GeoPoint | null> {
  const isPrivateOrLocal =
    !clientIp ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp.startsWith('192.168.') ||
    clientIp.startsWith('10.') ||
    clientIp.startsWith('172.16.') ||
    clientIp === 'localhost';

  const targetIp = isPrivateOrLocal ? '193.231.40.45' : clientIp!;

  // 1. Campus reverse DNS check (e.g. camin10.ucv.ro)
  try {
    const hostnames = await dns.promises.reverse(targetIp).catch(() => []);
    const host = hostnames[0]?.toLowerCase() || '';
    if (host.includes('camin') || host.includes('ucv.ro')) {
      return { lat: 44.3168, lng: 23.8225, city: 'Craiova · Campus Mecanică' };
    }
  } catch {}

  // 2. IP geolocation API fallback
  try {
    const url = isPrivateOrLocal
      ? 'https://freeipapi.com/api/json'
      : `https://freeipapi.com/api/json/${encodeURIComponent(clientIp!)}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Attendly/1.0)' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        return { lat: d.latitude, lng: d.longitude, city: d.cityName || 'Craiova' };
      }
    }
  } catch {}

  return null;
}

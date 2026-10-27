import dns from 'dns';

export interface GeoPoint {
  lat: number;
  lng: number;
  city?: string;
  source?: 'gps' | 'cloudflare_edge' | 'ip_geolocation' | 'campus_dns';
}

let cachedHostGeo: GeoPoint | null = null;

/**
 * Resolves the location of the host device (the machine running the server/app).
 * Uses local campus heuristics, fast IP geolocation APIs, and caches the result.
 */
export async function resolveHostCoordinates(): Promise<GeoPoint | null> {
  if (cachedHostGeo) return cachedHostGeo;

  // Try 1: freeipapi.com
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://freeipapi.com/api/json', {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Attendly/1.0)' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      if (typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        cachedHostGeo = {
          lat: d.latitude,
          lng: d.longitude,
          city: d.cityName || d.countryName || 'Local Host',
          source: 'ip_geolocation',
        };
        return cachedHostGeo;
      }
    }
  } catch {}

  // Try 2: ipwho.is
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2500);
    const res = await fetch('https://ipwho.is/', {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Attendly/1.0)' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      if (d.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        cachedHostGeo = {
          lat: d.latitude,
          lng: d.longitude,
          city: d.city || d.country || 'Local Host',
          source: 'ip_geolocation',
        };
        return cachedHostGeo;
      }
    }
  } catch {}

  // Default campus fallback if offline
  cachedHostGeo = {
    lat: 44.3168,
    lng: 23.8225,
    city: 'Craiova · Mechanics Campus',
    source: 'campus_dns',
  };
  return cachedHostGeo;
}

/**
 * Set host coordinates directly (e.g. from lecturer's high-accuracy browser GPS).
 */
export function setHostCoordinates(lat: number, lng: number, city?: string): void {
  cachedHostGeo = { lat, lng, city, source: 'gps' };
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

  if (isPrivateOrLocal) {
    return resolveHostCoordinates();
  }

  // 1. Campus reverse DNS check (e.g. camin10.ucv.ro)
  try {
    const hostnames = await dns.promises.reverse(clientIp!).catch(() => []);
    const host = hostnames[0]?.toLowerCase() || '';
    if (host.includes('camin') || host.includes('ucv.ro')) {
      return { lat: 44.3168, lng: 23.8225, city: 'Craiova · Mechanics Campus', source: 'campus_dns' };
    }
  } catch {}

  // 2. IP geolocation API fallback
  try {
    const url = `https://freeipapi.com/api/json/${encodeURIComponent(clientIp!)}`;
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
        return { lat: d.latitude, lng: d.longitude, city: d.cityName || 'Craiova', source: 'ip_geolocation' };
      }
    }
  } catch {}

  // 3. Secondary provider fallback (ipwho.is)
  try {
    const url = `https://ipwho.is/${encodeURIComponent(clientIp!)}`;
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Attendly/1.0)' },
    });
    clearTimeout(timeout);
    if (res.ok) {
      const d = await res.json();
      if (d.success && typeof d.latitude === 'number' && typeof d.longitude === 'number') {
        return { lat: d.latitude, lng: d.longitude, city: d.city || 'Craiova', source: 'ip_geolocation' };
      }
    }
  } catch {}

  return null;
}

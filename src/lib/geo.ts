// Geographic distance helpers. All functions return null on invalid inputs.

const EARTH_RADIUS_M = 6371000;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Haversine distance between two lat/lng points, in meters.
 * Returns null if any input is missing or out of range.
 */
export function haversineMeters(
  a: { lat: number; lng: number } | null | undefined,
  b: { lat: number; lng: number } | null | undefined
): number | null {
  if (!a || !b) return null;
  if (
    typeof a.lat !== 'number' || typeof a.lng !== 'number' ||
    typeof b.lat !== 'number' || typeof b.lng !== 'number' ||
    Number.isNaN(a.lat) || Number.isNaN(a.lng) ||
    Number.isNaN(b.lat) || Number.isNaN(b.lng) ||
    Math.abs(a.lat) > 90 || Math.abs(a.lng) > 180 ||
    Math.abs(b.lat) > 90 || Math.abs(b.lng) > 180
  ) {
    return null;
  }
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_M * c);
}

/**
 * Format a distance in meters for display:  "12 m"  /  "1.2 km"
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

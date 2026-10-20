// Geographic distance helpers. All functions return null or throw on invalid inputs.

export const EARTH_RADIUS_M = 6371e3;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Exact Haversine spherical distance between two coordinates in meters.
 * From QR Attendance System Documentation (Section 4.1).
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = EARTH_RADIUS_M;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
  return Math.round(calculateDistance(a.lat, a.lng, b.lat, b.lng));
}

/**
 * Format a distance in meters for display: "12 m" / "1.2 km"
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export const EARTH_RADIUS_M = 6371e3;

// WGS-84 Ellipsoid constants
export const WGS84_A = 6378137.0; // semi-major axis (meters)
export const WGS84_F = 1 / 298.257223563; // flattening
export const WGS84_B = 6356752.314245; // semi-minor axis (meters)

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Standard Haversine spherical distance formula between two coordinates in meters.
 * Assumes a mean spherical Earth radius (R = 6,371,000 m).
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = EARTH_RADIUS_M;
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Vincenty's inverse geodetic formula on the WGS-84 ellipsoid.
 * Computes exact geodesic distance between two points with millimeter accuracy.
 * Returns null if points are antipodal (does not converge within 100 iterations).
 */
export function vincentyDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number | null {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const a = WGS84_A;
  const f = WGS84_F;
  const b = WGS84_B;

  const L = toRadians(lon2 - lon1);
  const U1 = Math.atan((1 - f) * Math.tan(toRadians(lat1)));
  const U2 = Math.atan((1 - f) * Math.tan(toRadians(lat2)));
  const sinU1 = Math.sin(U1);
  const cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2);
  const cosU2 = Math.cos(U2);

  let lambda = L;
  let lambdaP = 2 * Math.PI;
  let iterLimit = 100;
  let cosSqAlpha = 0;
  let sinSigma = 0;
  let cos2SigmaM = 0;
  let cosSigma = 0;
  let sigma = 0;

  while (Math.abs(lambda - lambdaP) > 1e-12 && --iterLimit > 0) {
    const sinLambda = Math.sin(lambda);
    const cosLambda = Math.cos(lambda);
    sinSigma = Math.sqrt(
      (cosU2 * sinLambda) ** 2 + (cosU1 * sinU2 - sinU1 * cosU2 * cosLambda) ** 2
    );
    if (sinSigma === 0) return 0; // coincident points

    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlpha = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cosSqAlpha = 1 - sinAlpha ** 2;
    cos2SigmaM = cosSqAlpha !== 0 ? cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha : 0;

    const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
    lambdaP = lambda;
    lambda =
      L +
      (1 - C) *
        f *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
  }

  // Fallback if formula did not converge (nearly antipodal points)
  if (iterLimit === 0) return null;

  const uSq = (cosSqAlpha * (a ** 2 - b ** 2)) / b ** 2;
  const A =
    1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
  const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));
  const deltaSigma =
    B *
    sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (B / 6) *
            cos2SigmaM *
            (-3 + 4 * sinSigma ** 2) *
            (-3 + 4 * cos2SigmaM ** 2)));

  return Math.round(b * A * (sigma - deltaSigma));
}

/**
 * Calculates the exact geodetic distance in meters between:
 * 1. The device that hosts the app (hostLat, lon1)
 * 2. The device that scans the QR code (studentLat, lon2)
 *
 * Uses Vincenty's inverse geodesic formula on the WGS-84 ellipsoid for millimeter accuracy,
 * with the Haversine formula as a robust fallback.
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const vincenty = vincentyDistance(lat1, lon1, lat2, lon2);
  if (vincenty !== null) {
    return vincenty;
  }
  return haversineDistance(lat1, lon1, lat2, lon2);
}

/**
 * Format distance in meters for display: "14 m" | "1.2 km" | "200 km"
 */
export function formatDistance(meters: number | null | undefined): string {
  if (meters == null || Number.isNaN(meters)) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(1).replace(/\.0$/, '');
  return `${km} km`;
}

/**
 * Format distance telemetry for display: purely returns formatted distance (e.g. "14 m", "200 km").
 */
export function formatDistanceWithCity(
  meters: number | null | undefined,
  ...args: unknown[]
): string {
  void args;
  return formatDistance(meters);
}

/**
 * Categorize distance to help instructors quickly identify on-site vs remote scans.
 */
export function getDistanceCategory(meters: number | null | undefined): {
  label: string;
  category: 'room' | 'campus' | 'remote' | 'unknown';
  badgeClass: string;
} {
  if (meters == null || Number.isNaN(meters)) {
    return {
      label: 'Location not shared',
      category: 'unknown',
      badgeClass: 'text-muted-foreground bg-muted/60 border-border',
    };
  }

  if (meters <= 75) {
    return {
      label: `In room (${formatDistance(meters)})`,
      category: 'room',
      badgeClass: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    };
  }

  if (meters <= 350) {
    return {
      label: `On campus (${formatDistance(meters)})`,
      category: 'campus',
      badgeClass: 'text-accent bg-accent-soft border-accent/20',
    };
  }

  return {
    label: `Remote (${formatDistance(meters)})`,
    category: 'remote',
    badgeClass: 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20',
  };
}

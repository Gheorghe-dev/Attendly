export const EARTH_RADIUS_M = 6371e3;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Exact Haversine spherical distance between two coordinates in meters.
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
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

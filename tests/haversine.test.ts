import { calculateDistance, haversineMeters, formatDistance, EARTH_RADIUS_M } from '@/lib/geo';

describe('Haversine formula distance verification', () => {
  it('computes 0 meters for identical coordinates', () => {
    const lat = 44.435;
    const lon = 26.102;
    const d = calculateDistance(lat, lon, lat, lon);
    expect(d).toBeCloseTo(0, 5);
    expect(haversineMeters({ lat, lng: lon }, { lat, lng: lon })).toBe(0);
  });

  it('accurately calculates small classroom perimeter distance (~50m)', () => {
    // Latitude 44.435000 to 44.435450 (~50 meters north)
    const lat1 = 44.435;
    const lon1 = 26.102;
    const lat2 = 44.43545; // ~0.00045 degrees lat is ~50 meters
    const lon2 = 26.102;

    const d = calculateDistance(lat1, lon1, lat2, lon2);
    expect(d).toBeGreaterThan(45);
    expect(d).toBeLessThan(55);
  });

  it('matches known geodesic benchmark between London and Paris (~343 km)', () => {
    const london = { lat: 51.5074, lng: -0.1278 };
    const paris = { lat: 48.8566, lng: 2.3522 };

    const distance = haversineMeters(london, paris);
    expect(distance).toBeDefined();
    // Benchmark is approximately 343-344 km
    expect(distance!).toBeGreaterThan(340000);
    expect(distance!).toBeLessThan(346000);
  });

  it('rejects out of range latitude/longitude gracefully with null', () => {
    expect(haversineMeters({ lat: 95, lng: 20 }, { lat: 10, lng: 20 })).toBeNull();
    expect(haversineMeters({ lat: 10, lng: 200 }, { lat: 10, lng: 20 })).toBeNull();
    expect(haversineMeters(null, { lat: 10, lng: 20 })).toBeNull();
  });

  it('formats distance in human readable format', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(12.4)).toBe('12 m');
    expect(formatDistance(49)).toBe('49 m');
    expect(formatDistance(1200)).toBe('1.2 km');
    expect(formatDistance(343500)).toBe('343.5 km');
  });

  it('uses Earth radius 6371e3 meters', () => {
    expect(EARTH_RADIUS_M).toBe(6371000);
  });
});

import {
  calculateDistance,
  haversineDistance,
  vincentyDistance,
  formatDistance,
  formatDistanceWithCity,
  getDistanceCategory,
} from '@/lib/distance';

describe('Distance calculation & formatting', () => {
  it('calculates spherical distance correctly using Haversine formula', () => {
    // Craiova university campus (approx 44.3168, 23.8225) to Bucharest (approx 44.4323, 26.1063)
    const distMeters = calculateDistance(44.3168, 23.8225, 44.4323, 26.1063);
    // ~182 km
    expect(distMeters).toBeGreaterThan(175000);
    expect(distMeters).toBeLessThan(190000);

    // Identical coords should be 0
    expect(calculateDistance(44.3168, 23.8225, 44.3168, 23.8225)).toBe(0);
  });

  it('calculates exact geodetic distance between host and scanning device using Vincenty algorithm', () => {
    // Exact distance on WGS-84 ellipsoid
    const vincenty = vincentyDistance(44.3168, 23.8225, 44.4323, 26.1063);
    expect(vincenty).not.toBeNull();
    expect(vincenty).toBe(182465); // exactly 182,465 meters

    // In-room proximity test (~10 meters apart)
    const inRoomDist = calculateDistance(44.3168, 23.8225, 44.31689, 23.8225);
    expect(inRoomDist).toBe(10);
    expect(getDistanceCategory(inRoomDist).category).toBe('room');
  });

  it('formats distance in meters and kilometers properly', () => {
    expect(formatDistance(null)).toBe('—');
    expect(formatDistance(undefined)).toBe('—');
    expect(formatDistance(14)).toBe('14 m');
    expect(formatDistance(75.4)).toBe('75 m');
    expect(formatDistance(1200)).toBe('1.2 km');
    expect(formatDistance(200000)).toBe('200 km');
  });

  it('formats distance cleanly without disclosing location', () => {
    expect(formatDistanceWithCity(200000, 'Timisoara')).toBe('200 km');
    expect(formatDistanceWithCity(15, 'Craiova')).toBe('15 m');
    expect(formatDistanceWithCity(15, null)).toBe('15 m');
    expect(formatDistanceWithCity(null, 'Timisoara')).toBe('—');
    expect(formatDistanceWithCity(null, null)).toBe('—');
  });

  it('categorizes distance into room, campus, remote, and unknown', () => {
    expect(getDistanceCategory(15).category).toBe('room');
    expect(getDistanceCategory(75).category).toBe('room');
    expect(getDistanceCategory(120).category).toBe('campus');
    expect(getDistanceCategory(350).category).toBe('campus');
    expect(getDistanceCategory(351).category).toBe('remote');
    expect(getDistanceCategory(200000).category).toBe('remote');
    expect(getDistanceCategory(null).category).toBe('unknown');
  });
});

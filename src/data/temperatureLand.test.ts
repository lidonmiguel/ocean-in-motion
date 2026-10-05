import { describe, expect, it } from 'vitest';
import landRaw from './temperatureLand.geojson?raw';
import { recordsByYear, seaAreas, seaSeries } from './seaTemperatures';

const land = JSON.parse(landRaw) as { features: { geometry: { coordinates: number[][][] } }[] };
function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function onLand(lon: number, lat: number): boolean {
  return land.features.some(({ geometry: { coordinates: [outer, ...holes] } }) =>
    inRing(lon, lat, outer) && !holes.some(hole => inRing(lon, lat, hole)));
}

describe('temperature coast and island cover', () => {
  it('covers Mediterranean and Atlantic islands with land', () => {
    for (const [lon, lat] of [[14.44, 35.9], [1.43, 38.98], [-16.57, 28.29], [-25.5, 37.78]]) {
      expect(onLand(lon, lat), `island at ${lon}, ${lat}`).toBe(true);
    }
  });
  it('keeps the Black Sea selectable water with complete annual temperatures', () => {
    expect(onLand(34, 43)).toBe(false);
    const black = seaAreas.features.find(area => area.properties.id === 'black');
    expect(black?.properties.name).toBe('Mar Negro');
    expect(seaSeries('black')).toHaveLength(44);
    for (const records of recordsByYear.values()) expect(records.get('black')?.cells).toBeGreaterThanOrEqual(2);
  });
  it('preserves open Atlantic water and seam-safe polygons', () => {
    expect(onLand(-40, 45)).toBe(false);
    expect(onLand(-100, 40)).toBe(true);
    expect(onLand(10, 50)).toBe(true);
    const jumps = land.features.flatMap(({ geometry }) => geometry.coordinates.flatMap(ring =>
      ring.slice(1).filter((point, index) => Math.abs(point[0] - ring[index][0]) > 180)));
    expect(jumps).toEqual([]);
  });
});

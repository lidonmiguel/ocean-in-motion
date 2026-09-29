import { describe, expect, it } from 'vitest';
import landRaw from './landNoSeams.geojson?raw';

type Polygon = number[][][];
type Geometry = { type: 'Polygon'; coordinates: Polygon } |
  { type: 'MultiPolygon'; coordinates: Polygon[] };
const land = JSON.parse(landRaw) as {
  features: { geometry: Geometry }[];
};

function inRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function onLand(lon: number, lat: number): boolean {
  return land.features.some(({ geometry }) => {
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    return polygons.some(([outer, ...holes]) =>
      inRing(lon, lat, outer) && !holes.some(hole => inRing(lon, lat, hole)));
  });
}

describe('land cover across the Atlantic', () => {
  it('leaves the ocean open while retaining North America and Europe', () => {
    expect(onLand(-40, 45)).toBe(false);
    expect(onLand(-100, 40)).toBe(true);
    expect(onLand(10, 50)).toBe(true);
  });

  it('has no polygon edge that jumps across the date line', () => {
    for (const { geometry } of land.features) {
      const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
      for (const polygon of polygons) {
        for (const ring of polygon) {
          for (let i = 1; i < ring.length; i++) {
            expect(Math.abs(ring[i][0] - ring[i - 1][0])).toBeLessThanOrEqual(180);
          }
        }
      }
    }
  });
});

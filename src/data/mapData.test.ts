import { describe, expect, it } from 'vitest';
import tuna from './species/tuna.json';
import { cellPolygons, displayCells, suitabilityColor } from './mapData';
import { parseSpeciesDataset } from './schema';

describe('map data handling', () => {
  it('selects each period without mixing the current and future values', () => {
    const dataset = parseSpeciesDataset(tuna);
    const current = displayCells(dataset, 'current');
    const future = displayCells(dataset, 'future');
    expect(current[0].suitability).toBe(0.84);
    expect(future[0].suitability).toBe(0.48);
    expect(current[0].polygon[0]).not.toEqual(future[0].polygon[0]);
  });

  it('splits cells at both sides of the antimeridian', () => {
    for (const lon of [179, -179]) {
      const polygons = cellPolygons({ id: 'edge', center: [lon, 0], widthDeg: 8, heightDeg: 6, suitability: 0.5, uncertainty: 0.2 });
      expect(polygons).toHaveLength(2);
      for (const polygon of polygons) {
        expect(polygon[0]).toEqual(polygon.at(-1));
        expect(polygon.every(([x, y]) => x >= -180 && x <= 180 && y >= -85 && y <= 85)).toBe(true);
        expect(Math.abs(polygon[1][0] - polygon[0][0])).toBeLessThanOrEqual(8);
      }
    }
  });

  it('uses ordered low, middle, high color bands', () => {
    expect(suitabilityColor(0.2)).toEqual([40, 120, 155, 125]);
    expect(suitabilityColor(0.5)).toEqual([33, 190, 204, 158]);
    expect(suitabilityColor(0.9)).toEqual([105, 237, 226, 190]);
  });
});

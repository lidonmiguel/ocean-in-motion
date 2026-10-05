import { describe, expect, it } from 'vitest';
import { availableYears, formatTemperature, recordsByYear, seaAreas, seaSeries, temperatureColor } from './seaTemperatures';

describe('annual sea surface temperature snapshot', () => {
  it('has complete annual values with observed and estimated origins identified', () => {
    expect(availableYears[0]).toBe(1982);
    expect(availableYears.at(-1)).toBe(2025);
    expect(seaAreas.features).toHaveLength(102);
    for (const year of availableYears) {
      let observed = 0;
      let estimated = 0;
      for (const area of seaAreas.features) {
        const row = recordsByYear.get(year)?.get(area.properties.id);
        expect(row, `${year} ${area.properties.name}`).toBeDefined();
        expect(row!.celsius).toBeGreaterThan(-5);
        expect(row!.celsius).toBeLessThan(45);
        if (row!.method === 'estimated') {
          estimated++;
          expect(row!.cells).toBe(0);
          expect(row!.estimatedFrom?.length).toBeGreaterThanOrEqual(1);
          for (const donor of row!.estimatedFrom!) {
            expect(recordsByYear.get(year)?.get(donor)?.cells).toBeGreaterThanOrEqual(2);
          }
        } else {
          observed++;
          expect(row!.cells).toBeGreaterThanOrEqual(2);
        }
      }
      expect(observed).toBe(82);
      expect(estimated).toBe(20);
    }
    expect(seaSeries('med-west').length).toBe(availableYears.length);
  });

  it('keeps temperatures above the warm end of the legend warm', () => {
    expect(temperatureColor(34)).toEqual(temperatureColor(32));
  });

  it('marks estimates and shows only their stored precision', () => {
    expect(formatTemperature({ year: 2025, areaId: 'x', celsius: 13.8, cells: 0, method: 'estimated' })).toBe('≈ 13.8 °C');
    expect(formatTemperature({ year: 2025, areaId: 'y', celsius: 20.36, cells: 12 })).toBe('20.36 °C');
  });
});

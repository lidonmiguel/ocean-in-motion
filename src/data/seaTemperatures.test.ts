import { describe, expect, it } from 'vitest';
import { availableYears, recordsByYear, seaAreas, seaSeries, temperatureColor } from './seaTemperatures';

describe('annual sea surface temperature snapshot', () => {
  it('has complete, plausible annual values for every displayed area', () => {
    expect(availableYears[0]).toBe(1982);
    expect(availableYears.at(-1)).toBe(2025);
    for (const year of availableYears) {
      for (const area of seaAreas.features) {
        const row = recordsByYear.get(year)?.get(area.properties.id);
        expect(row, `${year} ${area.properties.name}`).toBeDefined();
        expect(row!.cells).toBeGreaterThanOrEqual(2);
        expect(row!.celsius).toBeGreaterThan(-5);
        expect(row!.celsius).toBeLessThan(45);
      }
    }
    expect(seaSeries('med-west').length).toBe(availableYears.length);
  });

  it('keeps temperatures above the warm end of the legend warm', () => {
    expect(temperatureColor(34)).toEqual(temperatureColor(32));
  });
});

import { describe, expect, it } from 'vitest';
import { buildComparisonCsv, comparisonProvenance, comparisonRegions, comparisonSummary, comparisonValue, normalizeRegionName, periodMean } from './temperatureComparison';
import { seaSeries, type TemperatureRecord } from './seaTemperatures';
import { timelineSeries } from './temperatureForecasts';

const row = (year: number, celsius: number, method?: TemperatureRecord['method']): TemperatureRecord => ({ year, celsius, method, areaId: 'test', cells: 1 });
describe('regional comparison definitions and provenance', () => {
  it('requires complete unique finite historical periods and excludes forecasts', () => {
    expect(periodMean([row(1982, 1), row(1983, 3), row(1984, 500, 'forecast')], 1982, 1983)).toBe(2);
    expect(periodMean([row(1982, 1), row(1983, 3, 'forecast')], 1982, 1983)).toBeUndefined();
    expect(periodMean([row(1982, 1), row(1982, 3)], 1982, 1983)).toBeUndefined();
    expect(periodMean([row(1982, NaN), row(1983, 3)], 1982, 1983)).toBeUndefined();
    expect(periodMean([row(1982, 1)], 1982, 1983)).toBeUndefined();
  });
  it('has a complete fixed 29-year baseline and ten-year comparisons for every region', () => {
    expect(comparisonRegions).toHaveLength(102);
    for (const region of comparisonRegions) {
      const history = seaSeries(region.id);
      const summary = comparisonSummary(region.id);
      const reference = history.filter(row => row.year <= 2010);
      expect(reference).toHaveLength(29);
      expect(summary.baseline).toBeCloseTo(reference.reduce((sum, row) => sum + row.celsius, 0) / 29, 12);
      expect(summary.change).toBeCloseTo(periodMean(history, 2016, 2025)! - periodMean(history, 1982, 1991)!, 12);
      expect(reference.reduce((sum, row) => sum + comparisonValue(row, 'anomaly', summary.baseline)!, 0)).toBeCloseTo(0, 10);
    }
  });
  it('subtracts the local reference without changing absolute values or prediction provenance', () => {
    expect(comparisonValue(row(2025, 12), 'temperature', 10)).toBe(12);
    expect(comparisonValue(row(2025, 8), 'anomaly', 10)).toBe(-2);
    expect(comparisonValue(row(2025, 8), 'anomaly')).toBeUndefined();
    expect(comparisonProvenance(row(2025, 8))).toBe('Reconstructed NOAA history');
    expect(comparisonProvenance(row(2025, 8, 'estimated'))).toBe('Estimated history');
    expect(comparisonProvenance({ ...row(2026, 8, 'forecast'), forecastBasis: 'estimated-history' })).toBe('Forecast · estimated basis');
  });
  it('classifies all regions without aggregation and preserves actual historical sources', () => {
    expect(comparisonRegions.filter(region => region.kind === 'ocean')).toHaveLength(7);
    expect(comparisonRegions.filter(region => !region.estimated)).toHaveLength(22);
    expect(comparisonRegions.filter(region => region.estimated)).toHaveLength(80);
    expect(comparisonRegions.find(region => region.id === 'caspian')?.kind).toBe('sea');
    expect(comparisonRegions.find(region => region.id === 'med-west')?.kind).toBe('sea');
    expect(comparisonRegions.find(region => region.id === 'gulf-mexico')?.kind).toBe('other');
    expect(normalizeRegionName('  ÁRCTIC Ocean ')).toBe('arctic ocean');
  });
  it('exports only the selected regions and interval while retaining fixed references and forecast metadata', () => {
    const csv = buildComparisonCsv(['caspian', 'iho-adriatic-sea'], 2025, 2026);
    const rows = csv.split('\n');
    expect(rows).toHaveLength(5);
    expect(rows[0]).toContain('"anomaly_c","reference_start","reference_end"');
    expect(rows[1]).toContain('"2025","caspian","Caspian Sea"');
    expect(rows[1]).toContain('"1982","2010"');
    expect(rows[2]).toContain('"Forecast · NOAA basis"');
    expect(rows[2]).toContain('"calibrated","0.9","persistence","2025"');
    expect(rows[3]).toContain('"Estimated history"');
    expect(rows[4]).toContain('"Forecast · estimated basis"');
    expect(rows[4]).toContain('"donor-derived-range","","persistence","2025"');
    expect(csv).not.toContain('"2024"');
    expect(csv).not.toContain('North Atlantic Ocean');
    const full = buildComparisonCsv(['caspian'], 1982, 2030).split('\n');
    expect(full).toHaveLength(50);
    expect(timelineSeries('caspian')).toHaveLength(49);
  });
});

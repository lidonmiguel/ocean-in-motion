import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemperaturePage } from './TemperaturePage';
import { buildTemperatureCsv, forecastsByYear, forecastMetadata, forecastModelLabel, forecastSeries, forecastYears, timelineByYear, timelineSeries, timelineYears } from './data/temperatureForecasts';
import { recordsByYear } from './data/seaTemperatures';

describe('reviewed temperature forecasts', () => {
  it('covers all historical regions at all five future horizons with their actual provenance', () => {
    expect(forecastYears).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(forecastMetadata.records).toHaveLength(510);
    for (const year of forecastYears) {
      const records = forecastsByYear.get(year)!;
      expect(records.size).toBe(102);
      expect([...records.keys()].sort()).toEqual([...recordsByYear.get(2025)!.keys()].sort());
      for (const [area, row] of records) {
        const history = recordsByYear.get(2025)!.get(area)!;
        expect(row.forecastBasis).toBe(history.method === 'estimated' ? 'estimated-history' : 'noaa-history');
        expect(row.intervalKind).toBe(history.method === 'estimated' ? 'donor-derived-range' : 'calibrated');
        expect(row.estimatedFrom).toEqual(history.estimatedFrom ?? []);
        expect(row.method).toBe('forecast');
        expect(row.lower).toBeLessThanOrEqual(row.celsius);
        expect(row.upper).toBeGreaterThanOrEqual(row.celsius);
        if (forecastMetadata.model === 'persistence') expect(row.celsius).toBe(history.celsius);
      }
    }
    expect(forecastSeries('caspian')).toHaveLength(5);
  });

  it('shows one continuous timeline and the full history and future without mode controls', () => {
    const html = renderToStaticMarkup(<TemperaturePage />);
    expect(html).toContain('HISTORY AND FORECAST · 1982–2030');
    expect(html).toContain('102 REGIONS');
    expect(html).toContain('min="1982" max="2030"');
    expect(html).toContain('YEAR · 2025 · HISTORY');
    expect(html).not.toContain('aria-label="Forecast quality"');
    expect(html).not.toContain('aria-label="Temperature type"');
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('1982</td>');
    expect(html).toContain('2030 · forecast');
    expect(html).toContain('Show paths toward cooler seas');
    expect(html).toContain('Pause paths');
    expect(html).toContain('neighbors touching its current region');
    expect(html).toContain('Without a cooler neighbor, it loops locally and fades away');
    expect(timelineYears).toEqual(Array.from({ length: 49 }, (_, i) => 1982+i));
    expect(timelineSeries('iho-gulf-of-oman')).toHaveLength(49);
  });

  it('identifies the future as an experiment with measured evaluation and uncertainty', () => {
    const html = renderToStaticMarkup(<TemperaturePage initialYear={2030} />);
    expect(html).toContain('min="1982" max="2030"');
    expect(html).toContain('102 REGIONS');
    expect(html).toContain('YEAR · 2030 · FORECAST');
    expect(html).toContain(forecastModelLabel);
    expect(html).toContain('Nominal 90% interval');
    expect(html).toContain('Future coverage is not guaranteed');
    expect(html).toContain('Test 2021–2025');
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('<polygon');
    expect(html).toContain('2030 · forecast');
    expect(html).toContain('Download history and forecasts');
    expect(html).not.toContain('NOAA · 2026');
  });

  it('keeps an estimated sea selected in the future without claiming local validation', () => {
    const html = renderToStaticMarkup(<TemperaturePage initialYear={2026} initialAreaId="iho-gulf-of-oman" />);
    expect(html).toContain('Gulf of Oman');
    expect(html).toContain('FORECAST · ESTIMATED BASIS');
    expect(html).toContain('Donor-derived range');
    expect(html).toContain('No validated local coverage');
    expect(html).not.toContain('Nominal 90% interval:');
    expect(html).not.toContain('Error for this region over the five test years');
    expect(timelineByYear.get(2025)!.has('iho-gulf-of-oman')).toBe(true);
    expect(timelineByYear.get(2026)!.has('iho-gulf-of-oman')).toBe(true);
  });

  it('exports one table with origins and uncertainty kinds distinguished per row', () => {
    const lines = buildTemperatureCsv().split('\n');
    expect(lines).toHaveLength(1 + 102*49);
    expect(lines[0]).toContain('type,basis');
    expect(lines.some(line => line.startsWith('2025,"Gulf of Oman"') && line.includes(',history,estimated,'))).toBe(true);
    const derived = lines.find(line => line.startsWith('2030,"Gulf of Oman"'))!;
    expect(derived).toContain(',forecast,estimated,');
    expect(derived).toContain(`,donor-derived-range,,${forecastMetadata.model},2025,`);
    const direct = lines.find(line => line.startsWith('2030,"Caspian Sea"'))!;
    expect(direct).toContain(`,calibrated,0.9,${forecastMetadata.model},2025,`);
  });
});

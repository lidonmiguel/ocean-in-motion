import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemperaturePage } from './TemperaturePage';
import { forecastsByYear, forecastMetadata, forecastSeries, forecastYears } from './data/temperatureForecasts';
import { recordsByYear } from './data/seaTemperatures';

describe('reviewed temperature forecasts', () => {
  it('limits forecasts to five future years and regions with NOAA histories', () => {
    expect(forecastYears).toEqual([2026, 2027, 2028, 2029, 2030]);
    expect(forecastMetadata.records).toHaveLength(110);
    for (const year of forecastYears) {
      const records = forecastsByYear.get(year)!;
      expect(records.size).toBe(22);
      for (const [area, row] of records) {
        const history = recordsByYear.get(2025)!.get(area)!;
        expect(history.method).not.toBe('estimated');
        expect(row.method).toBe('forecast');
        expect(row.lower).toBeLessThanOrEqual(row.celsius);
        expect(row.upper).toBeGreaterThanOrEqual(row.celsius);
        if (forecastMetadata.model === 'persistence') expect(row.celsius).toBe(history.celsius);
      }
    }
    expect(forecastSeries('caspian')).toHaveLength(5);
  });

  it('opens on history and preserves the full historical region list', () => {
    const html = renderToStaticMarkup(<TemperaturePage onBack={() => {}} />);
    expect(html).toContain('NOAA · 1982–2025');
    expect(html).toContain('102 ZONAS');
    expect(html).toContain('min="1982" max="2025"');
    expect(html).not.toContain('aria-label="Calidad de la predicción"');
    expect(html).not.toContain('stroke-dasharray="4 3"');
  });

  it('identifies the future as an experiment with measured evaluation and uncertainty', () => {
    const html = renderToStaticMarkup(<TemperaturePage onBack={() => {}} initialForecast />);
    expect(html).toContain('min="2026" max="2030"');
    expect(html).toContain('22 ZONAS');
    expect(html).toContain('Las otras 80 zonas estimadas no tienen previsión');
    expect(html).toContain('Persistencia: última temperatura conocida');
    expect(html).toContain('Intervalo nominal 90 %');
    expect(html).toContain('Su cobertura futura no está garantizada');
    expect(html).toContain('Prueba 2021–2025');
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('<polygon');
    expect(html).toContain('2030 · pred.');
    expect(html).toContain('Descargar predicciones e intervalos');
    expect(html).not.toContain('NOAA · 2026');
  });
});

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { TemperaturePage } from './TemperaturePage';
import { buildTemperatureCsv, forecastsByYear, forecastMetadata, forecastSeries, forecastYears, timelineByYear, timelineSeries, timelineYears } from './data/temperatureForecasts';
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
    const html = renderToStaticMarkup(<TemperaturePage onBack={() => {}} />);
    expect(html).toContain('HISTÓRICO Y PREVISIÓN · 1982–2030');
    expect(html).toContain('102 ZONAS');
    expect(html).toContain('min="1982" max="2030"');
    expect(html).toContain('AÑO · 2025 · HISTÓRICO');
    expect(html).not.toContain('aria-label="Calidad de la predicción"');
    expect(html).not.toContain('aria-label="Tipo de temperatura"');
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('1982</td>');
    expect(html).toContain('2030 · pred.');
    expect(html).toContain('Mostrar recorridos hacia mares más fríos');
    expect(html).toContain('Pausar recorridos');
    expect(html).toContain('Sin otro más fresco, gira y se desvanece');
    expect(timelineYears).toEqual(Array.from({ length: 49 }, (_, i) => 1982+i));
    expect(timelineSeries('iho-adriatic-sea')).toHaveLength(49);
  });

  it('identifies the future as an experiment with measured evaluation and uncertainty', () => {
    const html = renderToStaticMarkup(<TemperaturePage onBack={() => {}} initialYear={2030} />);
    expect(html).toContain('min="1982" max="2030"');
    expect(html).toContain('102 ZONAS');
    expect(html).toContain('AÑO · 2030 · PREDICCIÓN');
    expect(html).toContain('Persistencia: última temperatura conocida');
    expect(html).toContain('Intervalo nominal 90 %');
    expect(html).toContain('Su cobertura futura no está garantizada');
    expect(html).toContain('Prueba 2021–2025');
    expect(html).toContain('stroke-dasharray="4 3"');
    expect(html).toContain('<polygon');
    expect(html).toContain('2030 · pred.');
    expect(html).toContain('Descargar histórico y predicciones');
    expect(html).not.toContain('NOAA · 2026');
  });

  it('keeps an estimated sea selected in the future without claiming local validation', () => {
    const html = renderToStaticMarkup(<TemperaturePage onBack={() => {}} initialYear={2026} initialAreaId="iho-adriatic-sea" />);
    expect(html).toContain('Mar Adriático');
    expect(html).toContain('PREDICCIÓN · BASE ESTIMADA');
    expect(html).toContain('Rango derivado de las zonas base');
    expect(html).toContain('Sin cobertura local validada');
    expect(html).not.toContain('Intervalo nominal 90 %:');
    expect(html).not.toContain('Error de esta zona en los cinco años de prueba');
    expect(timelineByYear.get(2025)!.has('iho-adriatic-sea')).toBe(true);
    expect(timelineByYear.get(2026)!.has('iho-adriatic-sea')).toBe(true);
  });

  it('exports one table with origins and uncertainty kinds distinguished per row', () => {
    const lines = buildTemperatureCsv().split('\n');
    expect(lines).toHaveLength(1 + 102*49);
    expect(lines[0]).toContain('tipo,base');
    expect(lines.some(line => line.startsWith('2025,"Mar Adriático"') && line.includes(',histórico,estimada,'))).toBe(true);
    const derived = lines.find(line => line.startsWith('2030,"Mar Adriático"'))!;
    expect(derived).toContain(',predicción,estimada,');
    expect(derived).toContain(',donor-derived-range,,persistence,2025,');
    const direct = lines.find(line => line.startsWith('2030,"Mar Caspio"'))!;
    expect(direct).toContain(',calibrated,0.9,persistence,2025,');
  });
});

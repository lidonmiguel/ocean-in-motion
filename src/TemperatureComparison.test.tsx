import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TemperatureComparison } from './TemperatureComparison';

describe('ocean comparison presentation', () => {
  it('starts with three regions, one continuous timeline, and explicit historical sources', () => {
    const html = renderToStaticMarkup(<TemperatureComparison areaId="med-west" year={2025} onYearChange={() => {}} />);
    expect(html).toContain('id="comparison-title"');
    expect(html).toContain('Mediterráneo occidental');
    expect(html).toContain('Atlántico norte');
    expect(html).toContain('Mar Caspio');
    expect(html).toContain('3/5 regiones');
    expect(html).toContain('stroke-dasharray="6 5"');
    expect(html).toContain('PREDICCIÓN DESDE 2026');
    expect(html).toContain('Histórico NOAA reconstruido');
    expect(html).toContain('1982–2010');
    expect(html).toContain('Media 2016–2025 menos media 1982–1991');
    expect(html).toContain('Descargar comparación (CSV)');
    expect(html).toContain('aria-controls="comparison-table"');
    expect(html).not.toContain('NaN');
  });
  it('retains estimated and predicted provenance in the same comparison', () => {
    const html = renderToStaticMarkup(<TemperatureComparison areaId="iho-adriatic-sea" year={2030} onYearChange={() => {}} />);
    expect(html).toContain('≈ Histórico estimado');
    expect(html).toContain('Predicción · base estimada');
    expect(html).toContain('Predicción · base NOAA');
    expect(html).toContain('El cambio también es estimado');
    expect(html).toContain('Comparación en 2030');
    expect(html).not.toContain('NaN');
  });
  it('does not duplicate an ocean initially selected on the map', () => {
    const html = renderToStaticMarkup(<TemperatureComparison areaId="atlantic-north" year={1982} onYearChange={() => {}} />);
    expect(html).toContain('3/5 regiones');
    expect(html).toContain('Comparación en 1982');
    expect(html).toContain('Añadir zona del mapa');
  });
});

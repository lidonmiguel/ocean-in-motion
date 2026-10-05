import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TemperatureComparison } from './TemperatureComparison';

describe('ocean comparison presentation', () => {
  it('starts with three regions, one continuous timeline, and explicit historical sources', () => {
    const html = renderToStaticMarkup(<TemperatureComparison areaId="med-west" year={2025} onYearChange={() => {}} />);
    expect(html).toContain('id="comparison-title"');
    expect(html).toContain('Mediterranean Sea - Western Basin');
    expect(html).toContain('North Atlantic Ocean');
    expect(html).toContain('Caspian Sea');
    expect(html).toContain('3/5 regions');
    expect(html).toContain('stroke-dasharray="6 5"');
    expect(html).toContain('FORECAST FROM 2026');
    expect(html).toContain('Reconstructed NOAA history');
    expect(html).toContain('1982–2010');
    expect(html).toContain('Mean 2016–2025 minus mean 1982–1991');
    expect(html).toContain('Download comparison (CSV)');
    expect(html).toContain('aria-controls="comparison-table"');
    expect(html).not.toContain('NaN');
  });
  it('retains estimated and predicted provenance in the same comparison', () => {
    const html = renderToStaticMarkup(<TemperatureComparison areaId="iho-adriatic-sea" year={2030} onYearChange={() => {}} />);
    expect(html).toContain('≈ Estimated history');
    expect(html).toContain('Forecast · estimated basis');
    expect(html).toContain('Forecast · NOAA basis');
    expect(html).toContain('The change is also estimated');
    expect(html).toContain('Comparison in 2030');
    expect(html).not.toContain('NaN');
  });
  it('does not duplicate an ocean initially selected on the map', () => {
    const html = renderToStaticMarkup(<TemperatureComparison areaId="atlantic-north" year={1982} onYearChange={() => {}} />);
    expect(html).toContain('3/5 regions');
    expect(html).toContain('Comparison in 1982');
    expect(html).toContain('Add map region');
  });
});

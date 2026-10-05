import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('ocean temperature explorer', () => {
  it('opens directly on the complete ocean timeline with no species navigation', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('HISTORY AND FORECAST · 1982–2030');
    expect(html).toContain('102 REGIONS');
    expect(html).toContain('Temperature controls');
    expect(html).toContain('Show paths toward cooler seas');
    expect(html).toContain('Download history and forecasts');
    expect(html).not.toContain('Back to species');
    expect(html).not.toContain('Species selection');
    expect(html).not.toContain('OBIS');
    expect(html).not.toContain('2050');
  });
});

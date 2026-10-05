import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('ocean temperature explorer', () => {
  it('opens directly on the complete ocean timeline with no species navigation', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('HISTÓRICO Y PREVISIÓN · 1982–2030');
    expect(html).toContain('102 ZONAS');
    expect(html).toContain('Controles de temperaturas');
    expect(html).toContain('Mostrar recorridos hacia mares más fríos');
    expect(html).toContain('Descargar histórico y predicciones');
    expect(html).not.toContain('Volver a especies');
    expect(html).not.toContain('Selección de especie');
    expect(html).not.toContain('OBIS');
    expect(html).not.toContain('2050');
  });
});

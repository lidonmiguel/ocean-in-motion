import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('map display controls', () => {
  it('offers category views and an accessible box visibility control', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Mostrar cajas');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('checked=""');
    expect(html).toContain('Todos los peces');
    expect(html).toContain('Todos los mamíferos marinos');
    expect(html).toContain('Todos los reptiles marinos');
    expect(html).toContain('Zonas documentadas');
  });
});

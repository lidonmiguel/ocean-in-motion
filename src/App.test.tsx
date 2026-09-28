import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import App from './App';

describe('map display controls', () => {
  it('opens on documented observations with an explicit, unchecked illustration control', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Mostrar cajas');
    expect(html).toMatch(/<input type="checkbox" checked=""[^>]*><span>Mostrar cajas<\/span>/);
    expect(html).toMatch(/<input type="checkbox"[^>]*><span>Mostrar ejemplo ilustrativo<\/span>/);
    expect(html).toContain('SOLO ZONAS DOCUMENTADAS');
    expect(html).not.toContain('DESTINOS ILUSTRATIVOS</span>');
    expect(html).not.toContain('2050');
    expect(html).toContain('Todos los peces');
    expect(html).toContain('Todos los mamíferos marinos');
    expect(html).toContain('Todos los reptiles marinos');
    expect(html).toContain('Zonas documentadas');
  });
});

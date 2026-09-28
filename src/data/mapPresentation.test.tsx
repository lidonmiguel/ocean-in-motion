import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MapView } from '../MapView';
import { categories } from './categoryViews';
import { species } from './index';
import { mapPresentation } from './mapPresentation';

describe('observation-first map presentation', () => {
  it('hides every illustrative destination until explicitly requested, including grouped views', () => {
    for (const dataset of [...species, ...categories.map(category => category.view)]) {
      const initial = mapPresentation(dataset, false);
      const example = mapPresentation(dataset, true);
      expect(initial.kind).toBe('observations');
      expect(example.kind).toBe('observations');
      if (initial.kind !== 'observations' || example.kind !== 'observations') continue;
      expect(initial.observedAreas).toHaveLength(dataset.occurrence!.sources.length);
      expect(initial.illustrativeDestinations).toHaveLength(0);
      expect(example.illustrativeDestinations).toHaveLength(dataset.habitat.future.length);
    }
  });

  it('names the default map as observations and the enabled example as illustration', () => {
    const selected = species.find(item => item.id === 'loggerhead-turtle')!;
    const initial = renderToStaticMarkup(<MapView selected={selected} />);
    const example = renderToStaticMarkup(<MapView selected={selected} showIllustration />);
    expect(initial).toContain('solo se muestran las zonas documentadas');
    expect(initial).not.toContain('destinos y trazos ilustrativos');
    expect(example).toContain('destinos y trazos ilustrativos, sin predicción científica');
    expect(initial).not.toContain('2050');
    expect(example).not.toContain('2050');
  });
});

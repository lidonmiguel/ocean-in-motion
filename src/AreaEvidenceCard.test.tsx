import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AreaEvidenceCard } from './AreaEvidenceCard';
import { species } from './data';
import { categories } from './data/categoryViews';

describe('selected area evidence', () => {
  it('traces a grouped area to the member species, scope, accepted IDs and both rights fields', () => {
    const source = categories.find(item => item.group === 'cetacean')!.view.occurrence!.sources
      .find(item => item.scopeId === 'bottlenose-california')!;
    const html = renderToStaticMarkup(<AreaEvidenceCard source={source} />);
    expect(source.recordIds).toHaveLength(source.count);
    expect(html).toContain('bottlenose-dolphin.json');
    expect(html).toContain('bottlenose-california.manifest.json');
    expect(html).toContain('CC BY-NC 4.0');
    expect(html).toContain('CC0 1.0: 215');
    expect(html).toContain('CC BY-SA 4.0: 1');
    expect(html).toContain(`IDs OBIS de esta caja (${source.count})`);
    expect(html).toContain(source.recordIds[0]);
    expect(html).toContain('No se ofrece descarga');
  });

  it('does not silently treat an absent record license as the dataset grant', () => {
    const source = species.find(item => item.id === 'bottlenose-dolphin')!.occurrence!.sources
      .find(item => item.scopeId === 'bottlenose-west-med')!;
    const html = renderToStaticMarkup(<AreaEvidenceCard source={source} />);
    expect(html).toContain('ausente: 84 de 84');
    expect(html).toContain('Los campos difieren o faltan');
    expect(html).toContain('visual observation from ferries: 84');
  });

  it('links the pilot scope to its differently named original manifest', () => {
    const source = species.find(item => item.id === 'loggerhead-turtle')!.occurrence!.sources
      .find(item => item.scopeId === 'loggerhead-west-med')!;
    const html = renderToStaticMarkup(<AreaEvidenceCard source={source} />);
    expect(html).toContain('loggerhead-west-med-2013-2017.manifest.json');
    expect(html).toContain('loggerhead-turtle.json');
  });
});
